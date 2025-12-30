import {HumanMessage, SystemMessage, AIMessage, BaseMessage} from '@langchain/core/messages';
import {loggers} from '@puppy-store/shared';
import type {RecommendationResponse} from '@puppy-store/shared';
import {createLLM} from '../../../llm';
import type {AgentStateType} from '../types';
import {
  UpdatePreferencesTool,
  CheckBreedAvailabilityTool,
  SetBreedStrictnessTool,
  RegenerateRecommendationsTool,
} from '../tools';
import {ADOPTION_PROMPT} from '../prompts';
import {
  type ExtractedPreferences,
  hasAllRequiredPreferences,
  getMissingFields,
  saveUserPreferences,
} from '../../preferences';
import {scorePuppies} from '../../scoringService';
import {selectAndExplain} from '../../selectionService';
import {
  containsBlockedContent,
  sanitizeInput,
  getRefusalMessage,
} from '../../../prompts';

/**
 * Handle messages after recommendations have been shown
 * Uses LLM to determine if user wants new recommendations or just has questions
 */
async function handlePostRecommendationMessage(
  userMessage: string,
  history: BaseMessage[],
  preferences: ExtractedPreferences,
  userId: string | null,
  currentRecommendations: RecommendationResponse | null
): Promise<{
  response: string;
  preferences?: ExtractedPreferences;
  recommendations?: RecommendationResponse;
}> {
  const cleanMessage = sanitizeInput(userMessage);

  if (containsBlockedContent(cleanMessage)) {
    return {response: getRefusalMessage()};
  }

  // Get IDs of previously shown puppies
  const previousPuppyIds = currentRecommendations?.recommendations.map(r => r.puppy.id) ?? [];

  const regenTool = new RegenerateRecommendationsTool(preferences, userId, previousPuppyIds);
  const llm = createLLM({temperature: 0.7});
  const llmWithTools = llm.bindTools([regenTool]);

  const systemPrompt = `You are a friendly puppy adoption assistant. The user has already received puppy recommendations.

Current user preferences:
${JSON.stringify(preferences, null, 2)}

Your role:
1. If the user wants DIFFERENT or NEW recommendations (e.g., "show me others", "I want to see more options", "what about other breeds"), call the regenerateRecommendations tool
2. If the user has QUESTIONS about dogs, breeds, care, or the recommendations, answer them directly
3. If unsure, ask the user to clarify

When calling regenerateRecommendations:
- Set keepBreedStrict=true if user wants ONLY their preferred breed (e.g., "only golden retrievers", "just labradors")
- Set keepBreedStrict=false if user wants to see other breeds or broaden their search
- Set excludePrevious=true if user wants to see DIFFERENT puppies than before (default to true when regenerating)

Respond naturally and conversationally. Do NOT include JSON or technical details.`;

  const llmMessages: BaseMessage[] = [new SystemMessage(systemPrompt)];
  for (const msg of history.slice(-10)) {
    if (msg instanceof HumanMessage || msg instanceof AIMessage) {
      llmMessages.push(msg);
    }
  }
  llmMessages.push(new HumanMessage(cleanMessage));

  try {
    const response = await llmWithTools.invoke(llmMessages);

    // Check if tool was called
    if (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.name === 'regenerateRecommendations') {
          await regenTool.invoke(toolCall.args);

          if (regenTool.result) {
            const matchList = regenTool.result.recommendations.recommendations
              .map((r, i) => `${i + 1}. **${r.puppy.name}** - ${r.reasons[0]}`)
              .join('\n');

            return {
              response: `Here are some other great matches for you:\n\n${matchList}\n\n${regenTool.result.recommendations.explanation}`,
              preferences: regenTool.result.preferences,
              recommendations: regenTool.result.recommendations,
            };
          }
        }
      }
    }

    // No tool call - just a conversational response
    const responseContent = typeof response.content === 'string'
      ? response.content
      : 'Is there anything else you would like to know about these puppies?';

    return {response: responseContent};
  } catch (error) {
    loggers.adoption.error({err: error}, 'Post-recommendation error');
    return {response: 'I had trouble with that. Could you rephrase your question?'};
  }
}

/**
 * Adoption agent node - collects preferences and generates recommendations
 */
export async function adoptionNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || !(lastMessage instanceof HumanMessage)) {
    return {response: 'How can I help you find your perfect puppy?'};
  }

  const userMessage = typeof lastMessage.content === 'string' ? lastMessage.content : '';

  // If adoption is complete and we have recommendations, handle via expert
  // but give the expert tools to regenerate if user wants different recommendations
  if (state.adoptionComplete && state.recommendations) {
    const expertResponse = await handlePostRecommendationMessage(
      userMessage,
      messages,
      state.preferences,
      state.userId,
      state.recommendations
    );

    return {
      preferences: expertResponse.preferences ?? state.preferences,
      recommendations: expertResponse.recommendations ?? state.recommendations,
      response: expertResponse.response,
      messages: [new AIMessage(expertResponse.response)],
    };
  }

  // Set up tools
  const prefsTool = new UpdatePreferencesTool(state.preferences, state.userId);
  const breedCheckTool = new CheckBreedAvailabilityTool();
  const breedStrictTool = new SetBreedStrictnessTool(state.preferences, state.userId);

  const llm = createLLM({temperature: 0.7});
  const llmWithTools = llm.bindTools([prefsTool, breedCheckTool, breedStrictTool], {
    tool_choice: 'required',
  });

  const missingFields = getMissingFields(state.preferences);
  const systemPrompt = ADOPTION_PROMPT
    .replace('{currentPreferences}', JSON.stringify(state.preferences, null, 2))
    .replace('{missingFields}', missingFields.length > 0 ? missingFields.join(', ') : 'None - all collected!');

  // Build message history for context
  const llmMessages: BaseMessage[] = [new SystemMessage(systemPrompt)];
  for (const msg of messages.slice(-10)) {  // Last 10 messages for context
    if (msg instanceof HumanMessage || msg instanceof AIMessage) {
      llmMessages.push(msg);
    }
  }

  try {
    const response = await llmWithTools.invoke(llmMessages);

    loggers.adoption.info({
      hasToolCalls: !!(response.tool_calls && response.tool_calls.length > 0),
      toolCalls: response.tool_calls?.map(t => t.name),
      content: typeof response.content === 'string' ? response.content.slice(0, 100) : null,
    }, 'Adoption LLM response');

    let updatedPrefs = state.preferences;
    const toolResults: string[] = [];

    // Process tool calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.name === 'updateUserPreferences') {
          const result = await prefsTool.invoke(toolCall.args);
          toolResults.push(result);
          if (prefsTool.updatedPrefs) {
            updatedPrefs = prefsTool.updatedPrefs;
          }
        } else if (toolCall.name === 'checkBreedAvailability') {
          const result = await breedCheckTool.invoke(toolCall.args);
          toolResults.push(result);
        } else if (toolCall.name === 'setBreedStrictness') {
          // Re-create with latest prefs and userId
          const strictTool = new SetBreedStrictnessTool(updatedPrefs, state.userId);
          const result = await strictTool.invoke(toolCall.args);
          toolResults.push(result);
          if (strictTool.updatedPrefs) {
            updatedPrefs = strictTool.updatedPrefs;
          }
        }
      }
    }

    // Check if we have all required preferences
    const allPrefsComplete = hasAllRequiredPreferences(updatedPrefs);

    // Generate recommendations if all required prefs are complete
    // Priority: generate recommendations immediately when ready
    if (allPrefsComplete) {
      if (state.userId) {
        await saveUserPreferences(state.userId, updatedPrefs);
      }
      const scoredPuppies = await scorePuppies(updatedPrefs, 10);
      const recommendations = await selectAndExplain(scoredPuppies, updatedPrefs);

      const matchList = recommendations.recommendations
        .map((r, i) => `${i + 1}. **${r.puppy.name}** - ${r.reasons[0]}`)
        .join('\n');

      const responseText = `Great! Based on what you've told me, here are my top recommendations:\n\n${matchList}\n\n${recommendations.explanation}`;

      return {
        preferences: updatedPrefs,
        recommendations,
        adoptionComplete: true,
        response: responseText,
        messages: [new AIMessage(responseText)],
      };
    }

    // If we had tool calls but NOT all prefs are complete yet, get a follow-up response
    // (If allPrefsComplete was true, we already returned above with recommendations)
    if (toolResults.length > 0) {
      // Update system prompt with new preferences
      const updatedMissing = getMissingFields(updatedPrefs);
      const updatedSystemPrompt = ADOPTION_PROMPT
        .replace('{currentPreferences}', JSON.stringify(updatedPrefs, null, 2))
        .replace('{missingFields}', updatedMissing.length > 0 ? updatedMissing.join(', ') : 'None - all collected!');

      // Ask LLM to respond based on tool results
      const followUpMessages: BaseMessage[] = [
        new SystemMessage(updatedSystemPrompt + `

IMPORTANT: Respond in plain, conversational English only. Do NOT include:
- JSON objects or code blocks
- Technical details about preferences or tool results
- Raw data structures

Just speak naturally to the user about what you learned and what you need to know next.`),
        ...llmMessages.slice(1), // Skip old system message
        new AIMessage(`I've processed the user's information. ${toolResults.join(' ')}`),
        new HumanMessage('Continue the conversation naturally based on what you just learned.'),
      ];

      const followUpResponse = await llm.invoke(followUpMessages);
      const responseContent = typeof followUpResponse.content === 'string'
        ? followUpResponse.content
        : 'Could you tell me more about your preferences?';

      return {
        preferences: updatedPrefs,
        response: responseContent,
        messages: [new AIMessage(responseContent)],
      };
    }

    // Still missing required preferences - use the LLM's response
    const responseContent = typeof response.content === 'string' && response.content.trim()
      ? response.content
      : 'Could you tell me more about your living situation?';

    return {
      preferences: updatedPrefs,
      response: responseContent,
      messages: [new AIMessage(responseContent)],
    };
  } catch (error) {
    loggers.adoption.error({err: error}, 'Adoption error');
    return {
      response: 'I had trouble processing that. Could you tell me about your living situation?',
      messages: [new AIMessage('I had trouble processing that. Could you tell me about your living situation?')],
    };
  }
}

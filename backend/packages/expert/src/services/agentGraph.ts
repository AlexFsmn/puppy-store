import {Annotation, StateGraph, END} from '@langchain/langgraph';
import {HumanMessage, SystemMessage, AIMessage, BaseMessage} from '@langchain/core/messages';
import {LangChainTracer} from '@langchain/core/tracers/tracer_langchain';
import {RunCollectorCallbackHandler} from '@langchain/core/tracers/run_collector';
import {z} from 'zod';
import {StructuredTool} from '@langchain/core/tools';
import {createLLM} from '../llm';
import {prisma, loggers} from '@puppy-store/shared';
import type {RecommendationResponse} from '@puppy-store/shared';
import {
  type ExtractedPreferences,
  hasAllRequiredPreferences,
  getMissingFields,
  saveUserPreferences,
  PreferencesSchema,
} from './adoptionAgent';
import {scorePuppies} from './scoringService';
import {selectAndExplain} from './selectionService';
import {
  containsBlockedContent,
  sanitizeInput,
  getRefusalMessage,
} from '../prompts';

/**
 * Agent types
 */
export type AgentType = 'router' | 'adoption' | 'expert';

/**
 * Create a LangSmith tracer for observability
 * Traces the full LangGraph execution including state transitions, tool calls, and routing decisions
 */
function createLangSmithTracer(metadata?: {
  userId?: string | null;
  sessionId?: string;
  conversationTurn?: number;
}): LangChainTracer | null {
  // Only create tracer if LangSmith tracing is enabled
  if (process.env.LANGCHAIN_TRACING_V2 !== 'true') {
    return null;
  }

  return new LangChainTracer({
    projectName: process.env.LANGCHAIN_PROJECT || 'puppy-store',
  });
}

/**
 * LangGraph state annotation
 */
const AgentState = Annotation.Root({
  // Message history
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  // Current active agent
  currentAgent: Annotation<AgentType>({
    reducer: (_, y) => y,
    default: () => 'router',
  }),
  // User preferences (for adoption)
  preferences: Annotation<ExtractedPreferences>({
    reducer: (_, y) => y,
    default: () => ({
      livingSpace: null,
      activityLevel: null,
      hasChildren: null,
      childAge: null,
      hasOtherPets: null,
      otherPetTypes: null,
      experienceLevel: null,
      budget: null,
      breedPreference: null,
      breedStrict: null,
      location: null,
      additionalContext: null,
    }),
  }),
  // User ID for persistence
  userId: Annotation<string | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  // Recommendations (after adoption completes)
  recommendations: Annotation<RecommendationResponse | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  // Response to return to user
  response: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),
  // Whether adoption flow is complete
  adoptionComplete: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),
});

type AgentStateType = typeof AgentState.State;

/**
 * Router system prompt - classifies intent to route to appropriate agent
 */
const ROUTER_PROMPT = `You are a router that determines which agent should handle the user's message.

Available agents:
1. **adoption** - Helps users find their perfect puppy match. Use when user wants to:
   - Find a puppy
   - Get recommendations
   - Find a match
   - Adopt a dog
   - Look for a specific breed

2. **expert** - Answers general questions about dogs. Use when user:
   - Has questions about breeds, care, training, health, behavior
   - Wants to learn about dogs
   - Is asking factual questions

Analyze the user's message and call the routeToAgent tool with your decision.`;

// Schema for routing tool
const routeSchema = z.object({
  agent: z.enum(['adoption', 'expert']).describe('Which agent should handle this message'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Confidence in this routing decision'),
  reasoning: z.string().describe('Brief explanation of why this agent was chosen'),
});

/**
 * Tool for routing decisions
 */
// @ts-ignore - LangChain StructuredTool type inference issues
class RouteToAgentTool extends StructuredTool {
  name = 'routeToAgent';
  description = 'Route the user message to the appropriate agent';
  schema = routeSchema;

  private result: {agent: AgentType; confidence: string} | null = null;

  async _call(input: z.infer<typeof routeSchema>): Promise<string> {
    this.result = {agent: input.agent, confidence: input.confidence};
    return `Routing to ${input.agent} (${input.confidence} confidence): ${input.reasoning}`;
  }

  getResult() {
    return this.result;
  }
}

/**
 * Router node - determines which agent should handle the message
 */
async function routerNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || !(lastMessage instanceof HumanMessage)) {
    return {currentAgent: 'expert'};
  }

  const userMessage = typeof lastMessage.content === 'string'
    ? lastMessage.content
    : '';

  const tool = new RouteToAgentTool();
  const llm = createLLM({temperature: 0});
  const llmWithTools = llm.bindTools([tool], {tool_choice: 'routeToAgent'});

  // Include recent conversation context for better routing
  const contextMessages = messages.slice(-6).map(m => {
    if (m instanceof HumanMessage) return `User: ${m.content}`;
    if (m instanceof AIMessage) return `Assistant: ${m.content}`;
    return '';
  }).filter(Boolean).join('\n');

  const routerMessages = [
    new SystemMessage(ROUTER_PROMPT),
    new HumanMessage(`Recent conversation:\n${contextMessages}\n\nRoute this latest message: "${userMessage}"`),
  ];

  try {
    const response = await llmWithTools.invoke(routerMessages);

    if (response.tool_calls && response.tool_calls.length > 0) {
      await tool.invoke(response.tool_calls[0].args);
      const result = tool.getResult();
      if (result) {
        loggers.adoption.debug({agent: result.agent, confidence: result.confidence}, 'Router decision');
        return {currentAgent: result.agent};
      }
    }
  } catch (error) {
    loggers.adoption.error({err: error}, 'Router error');
  }

  // Default to expert
  return {currentAgent: 'expert'};
}

/**
 * Adoption agent system prompt
 */
const ADOPTION_PROMPT = `You are a friendly puppy adoption assistant helping users find their perfect match.

Your job is to have a natural conversation to collect the following information:

REQUIRED (must collect all 5):
1. Living situation (apartment, house, or house with yard)
2. Activity level / lifestyle (low, medium, or high)
3. Whether they have children (yes or no)
4. Whether they have other pets (yes or no)
5. Dog ownership experience level - you MUST explicitly ask: "Have you owned a dog before?"

OPTIONAL (ask once after required info, but don't push if they skip):
6. Budget for adoption fee (low/medium/high)
7. Breed preferences

BREED PREFERENCE HANDLING:
When a user mentions a breed they like (e.g., "I love golden retrievers"):
1. IMMEDIATELY call checkBreedAvailability to see how many are available
2. Based on the result, inform the user:
   - If none available: "I don't have any [breed] puppies right now, but I can show you similar breeds or other great matches. What would you prefer?"
   - If some available: "Great news! I have [N] [breed] puppy/puppies available! Would you like to see ONLY [breed]s, or would you prefer a mix that includes [breed]s along with other breeds that might be a great fit?"
3. After the user responds to the breed question, you MUST call setBreedStrictness with strict=true (only that breed) or strict=false (prefer but mix)

CRITICAL RULES:
- You MUST collect ALL 5 required pieces before generating recommendations
- When the user shares preference info, call updateUserPreferences with ONLY the fields they mentioned
- NEVER guess or infer experienceLevel - you MUST ask them directly
- For "no kids", "no pets" - explicitly set boolean to FALSE
- Activity level CAN be inferred from lifestyle (busy nurse = low, marathon runner = high)
- Keep asking until ALL required fields are filled
- Do NOT rush to recommendations

Current preferences collected:
{currentPreferences}

STILL MISSING:
{missingFields}`;

// Schema for updating preferences
const updatePrefsSchema = z.object({
  livingSpace: z.enum(['apartment', 'house', 'house_with_yard']).optional(),
  activityLevel: z.enum(['low', 'medium', 'high']).optional(),
  hasChildren: z.boolean().optional(),
  childAge: z.number().optional(),
  hasOtherPets: z.boolean().optional(),
  otherPetTypes: z.array(z.string()).optional(),
  experienceLevel: z.enum(['first_time', 'some_experience', 'experienced']).optional(),
  budget: z.enum(['low', 'medium', 'high']).optional(),
  breedPreference: z.array(z.string()).optional(),
  location: z.string().optional(),
  additionalContext: z.string().optional(),
});

/**
 * Tool for updating preferences during adoption
 */
// @ts-ignore
class UpdatePreferencesTool extends StructuredTool {
  name = 'updateUserPreferences';
  description = 'Update user preferences based on information explicitly stated by the user. Only include fields they mentioned.';
  schema = updatePrefsSchema;

  private currentPrefs: ExtractedPreferences;
  private userId: string | null;
  public updatedPrefs: ExtractedPreferences | null = null;

  constructor(currentPrefs: ExtractedPreferences, userId: string | null) {
    super();
    this.currentPrefs = currentPrefs;
    this.userId = userId;
  }

  async _call(input: z.infer<typeof updatePrefsSchema>): Promise<string> {
    const invalidStrings = ['unknown', 'none', 'n/a', 'not specified', ''];
    const isValidString = (val: string | undefined): val is string =>
      val !== undefined && !invalidStrings.includes(val.toLowerCase().trim());

    // Merge with current preferences
    this.updatedPrefs = {
      livingSpace: input.livingSpace ?? this.currentPrefs.livingSpace,
      activityLevel: input.activityLevel ?? this.currentPrefs.activityLevel,
      hasChildren: input.hasChildren !== undefined ? input.hasChildren : this.currentPrefs.hasChildren,
      childAge: input.childAge ?? this.currentPrefs.childAge,
      hasOtherPets: input.hasOtherPets !== undefined ? input.hasOtherPets : this.currentPrefs.hasOtherPets,
      otherPetTypes: input.otherPetTypes ?? this.currentPrefs.otherPetTypes,
      experienceLevel: input.experienceLevel ?? this.currentPrefs.experienceLevel,
      budget: input.budget ?? this.currentPrefs.budget,
      breedPreference: input.breedPreference ?? this.currentPrefs.breedPreference,
      breedStrict: this.currentPrefs.breedStrict,
      location: isValidString(input.location) ? input.location : this.currentPrefs.location,
      additionalContext: isValidString(input.additionalContext) ? input.additionalContext : this.currentPrefs.additionalContext,
    };

    // Save to database if we have a user ID
    if (this.userId) {
      try {
        await saveUserPreferences(this.userId, this.updatedPrefs);
      } catch (err) {
        loggers.adoption.error({err, userId: this.userId}, 'Failed to save preferences');
      }
    }

    const missing = getMissingFields(this.updatedPrefs);
    if (missing.length === 0) {
      return 'All required preferences collected. Ready to generate recommendations.';
    }
    return `Preferences updated. Still need: ${missing.join(', ')}`;
  }
}

// Schema for checking breed availability
const checkBreedSchema = z.object({
  breed: z.string().describe('The breed name to check availability for'),
});

/**
 * Tool for checking breed availability in the database
 */
// @ts-ignore
class CheckBreedAvailabilityTool extends StructuredTool {
  name = 'checkBreedAvailability';
  description = 'Check how many puppies of a specific breed are available. Call this when the user mentions a breed preference.';
  schema = checkBreedSchema;

  async _call(input: z.infer<typeof checkBreedSchema>): Promise<string> {
    const breed = input.breed.toLowerCase();

    const count = await prisma.puppy.count({
      where: {
        status: 'AVAILABLE',
        breed: {
          contains: breed,
          mode: 'insensitive',
        },
      },
    });

    if (count === 0) {
      return `No ${input.breed} puppies are currently available. The user should be informed and asked if they want to see similar breeds or all available puppies.`;
    } else if (count === 1) {
      return `There is 1 ${input.breed} available! Ask the user if they want to see ONLY ${input.breed}s, or if they'd like to see a mix including other breeds.`;
    } else {
      return `There are ${count} ${input.breed} puppies available! Ask the user if they want to see ONLY ${input.breed}s, or if they'd like to see a mix including other breeds.`;
    }
  }
}

// Schema for setting breed strictness
const setBreedStrictnessSchema = z.object({
  strict: z.boolean().describe('true = only show this breed, false = prefer this breed but include others'),
});

/**
 * Tool for setting whether breed preference is strict or flexible
 */
// @ts-ignore
class SetBreedStrictnessTool extends StructuredTool {
  name = 'setBreedStrictness';
  description = 'Set whether to ONLY show the preferred breed or include other breeds too. Call after the user answers the breed strictness question.';
  schema = setBreedStrictnessSchema;

  private currentPrefs: ExtractedPreferences;
  private userId: string | null;
  public updatedPrefs: ExtractedPreferences | null = null;

  constructor(currentPrefs: ExtractedPreferences, userId: string | null = null) {
    super();
    this.currentPrefs = currentPrefs;
    this.userId = userId;
  }

  async _call(input: z.infer<typeof setBreedStrictnessSchema>): Promise<string> {
    this.updatedPrefs = {
      ...this.currentPrefs,
      breedStrict: input.strict,
    };

    // Save to database if we have a user ID
    if (this.userId) {
      try {
        await saveUserPreferences(this.userId, this.updatedPrefs);
        loggers.adoption.debug({userId: this.userId}, 'Breed strictness saved');
      } catch (err) {
        loggers.adoption.error({err, userId: this.userId}, 'Failed to save breed strictness');
      }
    }

    loggers.adoption.debug({strict: input.strict, breeds: this.currentPrefs.breedPreference}, 'SetBreedStrictness');

    if (input.strict) {
      return `Breed preference set to STRICT - will only show ${this.currentPrefs.breedPreference?.join(', ')} puppies. Ready to generate recommendations.`;
    } else {
      return `Breed preference set to FLEXIBLE - will prefer ${this.currentPrefs.breedPreference?.join(', ')} but also show other great matches. Ready to generate recommendations.`;
    }
  }
}

/**
 * Adoption agent node - collects preferences and generates recommendations
 */
async function adoptionNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
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
  const llmWithTools = llm.bindTools([prefsTool, breedCheckTool, breedStrictTool]);

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

    let updatedPrefs = state.preferences;
    const toolResults: string[] = [];

    // Process tool calls
    let breedStrictnessSet = false;
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
            breedStrictnessSet = true;
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

    // No tool calls - but still check if we should generate recommendations
    // (e.g., returning user with all prefs already filled)
    if (hasAllRequiredPreferences(updatedPrefs)) {
      if (state.userId) {
        await saveUserPreferences(state.userId, updatedPrefs);
      }
      const scoredPuppies = await scorePuppies(updatedPrefs, 10);
      const recommendations = await selectAndExplain(scoredPuppies, updatedPrefs);

      const matchList = recommendations.recommendations
        .map((r, i) => `${i + 1}. **${r.puppy.name}** - ${r.reasons[0]}`)
        .join('\n');

      const responseText = `Great! Based on your preferences, here are my top recommendations:\n\n${matchList}\n\n${recommendations.explanation}`;

      return {
        preferences: updatedPrefs,
        recommendations,
        adoptionComplete: true,
        response: responseText,
        messages: [new AIMessage(responseText)],
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

// Schema for regenerating recommendations
const regenerateRecsSchema = z.object({
  reason: z.string().describe('Brief reason why user wants new recommendations'),
  keepBreedStrict: z.boolean().describe('true if user wants ONLY their preferred breed, false if they want to see other breeds too'),
  excludePrevious: z.boolean().describe('true if user wants to see DIFFERENT puppies than before, false to include previously shown puppies'),
});

/**
 * Tool for regenerating recommendations with different settings
 */
// @ts-ignore
class RegenerateRecommendationsTool extends StructuredTool {
  name = 'regenerateRecommendations';
  description = `Regenerate puppy recommendations when the user wants different results.
Call this when the user:
- Wants to see other/different puppies
- Wants to broaden their search
- Is not satisfied with current recommendations
- Wants to remove breed restrictions`;
  schema = regenerateRecsSchema;

  private prefs: ExtractedPreferences;
  private userId: string | null;
  private previousPuppyIds: string[];
  public result: {preferences: ExtractedPreferences; recommendations: RecommendationResponse} | null = null;

  constructor(prefs: ExtractedPreferences, userId: string | null, previousPuppyIds: string[] = []) {
    super();
    this.prefs = prefs;
    this.userId = userId;
    this.previousPuppyIds = previousPuppyIds;
  }

  async _call(input: z.infer<typeof regenerateRecsSchema>): Promise<string> {
    const updatedPrefs = {
      ...this.prefs,
      breedStrict: input.keepBreedStrict,
    };

    if (this.userId) {
      try {
        await saveUserPreferences(this.userId, updatedPrefs);
      } catch (err) {
        loggers.adoption.error({err, userId: this.userId}, 'Failed to save preferences');
      }
    }

    // Get more candidates to allow for exclusion
    const limit = input.excludePrevious && this.previousPuppyIds.length > 0 ? 20 : 10;
    let scoredPuppies = await scorePuppies(updatedPrefs, limit);

    // Exclude previously shown puppies if requested
    if (input.excludePrevious && this.previousPuppyIds.length > 0) {
      scoredPuppies = scoredPuppies.filter(p => !this.previousPuppyIds.includes(p.puppy.id));
    }

    const recommendations = await selectAndExplain(scoredPuppies.slice(0, 10), updatedPrefs);

    this.result = {preferences: updatedPrefs, recommendations};

    const matchList = recommendations.recommendations
      .map((r, i) => `${i + 1}. ${r.puppy.name} - ${r.reasons[0]}`)
      .join('\n');

    return `Generated new recommendations:\n${matchList}`;
  }
}

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
 * Expert agent system prompt
 */
const EXPERT_PROMPT = `You are a friendly and knowledgeable puppy expert at a dog adoption center. You help potential adopters understand different breeds, puppy care, and what to expect when bringing a new dog home.

Guidelines:
- Keep your answers concise but informative
- Use a warm, approachable tone
- If the question is about a specific breed, include relevant characteristics
- You can reference previous messages in the conversation for context
- If the user asks about finding a puppy or getting recommendations, let them know they can ask you to help find a match

Do NOT discuss:
- Non-dog related topics
- Medical advice (recommend consulting a vet instead)
- Anything unethical regarding animal treatment`;

/**
 * Helper to call expert agent
 */
async function callExpertAgent(
  userMessage: string,
  history: BaseMessage[]
): Promise<string> {
  const cleanMessage = sanitizeInput(userMessage);

  if (containsBlockedContent(cleanMessage)) {
    return getRefusalMessage();
  }

  const llm = createLLM({temperature: 0.7});

  const llmMessages: BaseMessage[] = [new SystemMessage(EXPERT_PROMPT)];
  for (const msg of history.slice(-10)) {
    if (msg instanceof HumanMessage || msg instanceof AIMessage) {
      llmMessages.push(msg);
    }
  }

  try {
    const response = await llm.invoke(llmMessages);
    return typeof response.content === 'string'
      ? response.content
      : 'I apologize, but I encountered an issue. Could you please rephrase your question?';
  } catch (error) {
    loggers.llm.error({err: error}, 'Expert agent error');
    return 'I apologize, but I encountered an issue. Could you please rephrase your question?';
  }
}

/**
 * Expert agent node - handles Q&A about dogs
 */
async function expertNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || !(lastMessage instanceof HumanMessage)) {
    return {response: 'What would you like to know about dogs?'};
  }

  const userMessage = typeof lastMessage.content === 'string' ? lastMessage.content : '';
  const responseText = await callExpertAgent(userMessage, messages);

  return {
    response: responseText,
    messages: [new AIMessage(responseText)],
  };
}

/**
 * Conditional edge - route from router to appropriate agent
 */
function routeFromRouter(state: AgentStateType): string {
  return state.currentAgent === 'adoption' ? 'adoption' : 'expert';
}

/**
 * Create and compile the agent graph
 */
export function createAgentGraph() {
  const graph = new StateGraph(AgentState)
    // Add nodes
    .addNode('router', routerNode)
    .addNode('adoption', adoptionNode)
    .addNode('expert', expertNode)
    // Start with router
    .addEdge('__start__', 'router')
    // Router routes to the appropriate agent
    .addConditionalEdges('router', routeFromRouter, {
      adoption: 'adoption',
      expert: 'expert',
    })
    // Agents end after processing
    .addEdge('adoption', END)
    .addEdge('expert', END);

  return graph.compile();
}

/**
 * Agent graph instance (singleton)
 */
let graphInstance: ReturnType<typeof createAgentGraph> | null = null;

export function getAgentGraph() {
  if (!graphInstance) {
    graphInstance = createAgentGraph();
  }
  return graphInstance;
}

/**
 * Process a message through the agent graph
 */
export async function processMessage(
  userMessage: string,
  currentState: {
    messages: Array<{role: 'user' | 'assistant'; content: string}>;
    preferences: ExtractedPreferences;
    userId: string | null;
    recommendations: RecommendationResponse | null;
    adoptionComplete: boolean;
    currentAgent: AgentType;
  },
  options?: {
    sessionId?: string;
  }
): Promise<{
  response: string;
  preferences: ExtractedPreferences;
  recommendations: RecommendationResponse | null;
  adoptionComplete: boolean;
  currentAgent: AgentType;
  runId: string | undefined;
}> {
  const graph = getAgentGraph();

  // Convert history to LangChain messages
  const messages: BaseMessage[] = currentState.messages.map(m =>
    m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
  );
  messages.push(new HumanMessage(userMessage));

  // Build initial state
  const initialState = {
    messages,
    preferences: currentState.preferences,
    userId: currentState.userId,
    recommendations: currentState.recommendations,
    adoptionComplete: currentState.adoptionComplete,
    currentAgent: currentState.currentAgent,
    response: '',
  };

  // Create LangSmith tracer for full graph execution visibility
  const tracer = createLangSmithTracer({
    userId: currentState.userId,
    sessionId: options?.sessionId,
    conversationTurn: currentState.messages.length + 1,
  });

  // Create a run collector to capture the actual run ID from LangSmith
  const runCollector = new RunCollectorCallbackHandler();

  // Build callbacks array
  const callbacks = tracer ? [tracer, runCollector] : [runCollector];

  // Run the graph with tracing callbacks
  const result = await graph.invoke(initialState, {
    callbacks,
    // Add metadata for LangSmith filtering and grouping
    metadata: {
      userId: currentState.userId,
      sessionId: options?.sessionId,
      conversationTurn: currentState.messages.length + 1,
      adoptionComplete: currentState.adoptionComplete,
      currentAgent: currentState.currentAgent,
    },
    // Use session ID as run name for easier identification in LangSmith
    runName: options?.sessionId
      ? `chat-${options.sessionId.slice(0, 8)}`
      : 'chat-anonymous',
  });

  // Get the root run ID from the collector (this is what LangSmith actually uses)
  const rootRun = runCollector.tracedRuns.find(run => !run.parent_run_id);
  const runId = rootRun?.id;

  return {
    response: result.response,
    preferences: result.preferences,
    recommendations: result.recommendations,
    adoptionComplete: result.adoptionComplete,
    currentAgent: result.currentAgent,
    runId,
  };
}

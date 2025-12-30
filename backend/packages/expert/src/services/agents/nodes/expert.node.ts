import {HumanMessage, SystemMessage, AIMessage, BaseMessage} from '@langchain/core/messages';
import {loggers} from '@puppy-store/shared';
import {createLLM} from '../../../llm';
import type {AgentStateType} from '../types';
import {EXPERT_PROMPT} from '../prompts';
import {searchCache, storeInCache} from '../../semanticCache';
import {
  containsBlockedContent,
  sanitizeInput,
  getRefusalMessage,
} from '../../../prompts';

/**
 * Helper to call expert agent
 */
export async function callExpertAgent(
  userMessage: string,
  history: BaseMessage[]
): Promise<string> {
  const cleanMessage = sanitizeInput(userMessage);

  if (containsBlockedContent(cleanMessage)) {
    return getRefusalMessage();
  }

  // Check semantic cache first
  const cached = await searchCache(cleanMessage, 'expert');
  if (cached) {
    loggers.llm.debug({similarity: cached.similarity}, 'Expert cache hit');
    return cached.response;
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
    const responseText = typeof response.content === 'string'
      ? response.content
      : 'I apologize, but I encountered an issue. Could you please rephrase your question?';

    // Store in cache for future use (don't await - fire and forget)
    storeInCache(cleanMessage, responseText, 'expert').catch(() => {});

    return responseText;
  } catch (error) {
    loggers.llm.error({err: error}, 'Expert agent error');
    return 'I apologize, but I encountered an issue. Could you please rephrase your question?';
  }
}

/**
 * Expert agent node - handles Q&A about dogs
 */
export async function expertNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
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

import {HumanMessage, SystemMessage} from '@langchain/core/messages';
import {loggers} from '@puppy-store/shared';
import {createLLM} from '../../../llm';
import type {AgentStateType} from '../types';
import {RouteToAgentTool} from '../tools';
import {ROUTER_PROMPT} from '../prompts';
import {searchCache, storeInCache} from '../../semanticCache';

/**
 * Router node - determines which agent should handle the message
 */
export async function routerNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || !(lastMessage instanceof HumanMessage)) {
    return {currentAgent: 'expert'};
  }

  const userMessage = typeof lastMessage.content === 'string'
    ? lastMessage.content
    : '';

  // Check semantic cache for routing decision
  const cached = await searchCache(userMessage, 'router');
  if (cached) {
    const agent = cached.response as any;
    loggers.adoption.debug({agent, cacheHit: true, similarity: cached.similarity}, 'Router cache hit');
    return {currentAgent: agent};
  }

  const tool = new RouteToAgentTool();
  const llm = createLLM({temperature: 0});
  const llmWithTools = llm.bindTools([tool], {tool_choice: 'routeToAgent'});

  // Include recent conversation context for better routing
  const contextMessages = messages.slice(-6).map(m => {
    if (m instanceof HumanMessage) return `User: ${m.content}`;
    if (m instanceof SystemMessage) return '';
    return `Assistant: ${m.content}`;
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

        // Cache high-confidence routing decisions
        if (result.confidence === 'high') {
          storeInCache(userMessage, result.agent, 'router').catch(() => {});
        }

        return {currentAgent: result.agent};
      }
    }
  } catch (error) {
    loggers.adoption.error({err: error}, 'Router error');
  }

  // Default to expert
  return {currentAgent: 'expert'};
}

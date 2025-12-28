import {z} from 'zod';
import {StructuredTool} from '@langchain/core/tools';
import {HumanMessage, SystemMessage} from '@langchain/core/messages';
import {loggers} from '@puppy-store/shared';
import {createLLM} from '../llm';

/**
 * Agent types that can handle user requests
 */
export type AgentType = 'adoption' | 'expert';

/**
 * Result from router classification
 */
export interface RouterResult {
  agent: AgentType;
  confidence: 'high' | 'medium' | 'low';
}

// Schema for the classification tool
const classifyIntentSchema = z.object({
  agent: z.enum(['adoption', 'expert'])
    .describe('adoption = user wants to find/match a puppy. expert = user has a general question about dogs/breeds/care'),
  confidence: z.enum(['high', 'medium', 'low'])
    .describe('How confident you are in this classification'),
});

/**
 * Tool for classifying user intent
 */
// @ts-ignore - LangChain StructuredTool has complex type inference issues with zod
class ClassifyIntentTool extends StructuredTool {
  name = 'classifyIntent';
  description = 'Classify the user\'s intent to route to the appropriate agent';
  schema = classifyIntentSchema;

  private result: RouterResult | null = null;

  async _call(input: z.infer<typeof classifyIntentSchema>): Promise<string> {
    this.result = {
      agent: input.agent,
      confidence: input.confidence,
    };
    return `Classified as: ${input.agent} (${input.confidence} confidence)`;
  }

  getResult(): RouterResult | null {
    return this.result;
  }
}

const ROUTER_SYSTEM_PROMPT = `You are a router that classifies user messages to determine which agent should handle them.

Two agents are available:

1. **adoption** - Helps users find their perfect puppy match
   - Use when: user wants to find a puppy, get recommendations, find a match, adopt a dog
   - Examples: "help me find a puppy", "I'm looking for a dog", "what breed suits me", "find me a match"

2. **expert** - Answers general questions about dogs
   - Use when: user has questions about breeds, care, training, health, behavior
   - Examples: "how often should I walk a beagle", "are golden retrievers good with kids", "what do puppies eat"

Call the classifyIntent tool with your classification.`;

/**
 * Classify a user message to determine which agent should handle it
 */
export async function classifyIntent(userMessage: string): Promise<RouterResult> {
  const tool = new ClassifyIntentTool();
  const llm = createLLM({temperature: 0});
  const llmWithTools = llm.bindTools([tool], {tool_choice: 'classifyIntent'});

  const messages = [
    new SystemMessage(ROUTER_SYSTEM_PROMPT),
    new HumanMessage(userMessage),
  ];

  const response = await llmWithTools.invoke(messages);

  // Handle tool call
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolCall = response.tool_calls[0];
    if (toolCall.name === 'classifyIntent') {
      await tool.invoke(toolCall.args);
      const result = tool.getResult();
      if (result) {
        loggers.adoption.debug({message: userMessage.substring(0, 50), agent: result.agent, confidence: result.confidence}, 'Router classified');
        return result;
      }
    }
  }

  // Fallback to expert if classification fails
  loggers.adoption.debug({message: userMessage.substring(0, 50)}, 'Router classification failed, defaulting to expert');
  return {agent: 'expert', confidence: 'low'};
}

/**
 * Check if a message indicates the user wants to switch agents
 * Uses the LLM classifier to detect intent changes
 */
export async function checkForAgentSwitch(
  userMessage: string,
  currentAgent: AgentType
): Promise<AgentType | null> {
  const {agent, confidence} = await classifyIntent(userMessage);

  // Only switch if the classified agent differs and confidence is reasonable
  if (agent !== currentAgent && (confidence === 'high' || confidence === 'medium')) {
    return agent;
  }

  return null;
}

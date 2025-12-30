import {z} from 'zod';
import {StructuredTool} from '@langchain/core/tools';
import type {AgentType} from '../types';

// Schema for routing tool
export const routeSchema = z.object({
  agent: z.enum(['adoption', 'expert']).describe('Which agent should handle this message'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Confidence in this routing decision'),
  reasoning: z.string().describe('Brief explanation of why this agent was chosen'),
});

/**
 * Tool for routing decisions
 */
// @ts-ignore - LangChain StructuredTool type inference issues
export class RouteToAgentTool extends StructuredTool {
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

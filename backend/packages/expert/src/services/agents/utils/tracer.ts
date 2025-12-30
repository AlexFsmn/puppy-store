import {LangChainTracer} from '@langchain/core/tracers/tracer_langchain';

/**
 * Create a LangSmith tracer for observability
 * Traces the full LangGraph execution including state transitions, tool calls, and routing decisions
 */
export function createLangSmithTracer(metadata?: {
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

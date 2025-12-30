import {StateGraph, END} from '@langchain/langgraph';
import {HumanMessage, AIMessage, BaseMessage} from '@langchain/core/messages';
import {RunCollectorCallbackHandler} from '@langchain/core/tracers/run_collector';
import type {RecommendationResponse} from '@puppy-store/shared';
import {AgentState, type AgentStateType, type AgentType} from './types';
import {routerNode, adoptionNode, expertNode} from './nodes';
import {createLangSmithTracer} from './utils';
import type {ExtractedPreferences} from '../preferences';

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

import {randomUUID} from 'crypto';
import type {RecommendationResponse} from '@puppy-store/shared';
import {loggers, RedisSessionStore, redisTTL} from '@puppy-store/shared';
import {processMessage, type AgentType} from './agents';
import {
  createInitialPreferences,
  hasSavedPreferences,
  generateReturningUserMessage,
  hasAllRequiredPreferences,
  type ExtractedPreferences,
  type UserWithPreferences,
} from './preferences';
import {
  registerSessionRun,
  registerSessionRecommendations,
  cleanupSession as cleanupFeedbackSession,
} from './feedbackService';

/**
 * Unified chat session state
 */
export interface ChatSession {
  id: string;
  userId: string | null;
  activeAgent: AgentType;
  preferences: ExtractedPreferences;
  conversationHistory: Array<{role: 'user' | 'assistant'; content: string}>;
  recommendations: RecommendationResponse | null;
  adoptionComplete: boolean;
  isReturningUser: boolean;
}

/**
 * Response from processing a chat message
 */
export interface ChatMessageResponse {
  message: string;
  recommendations?: RecommendationResponse;
  activeAgent: AgentType;
}

/**
 * Start a new chat session
 */
export function startChatSession(user: UserWithPreferences | null): {
  session: ChatSession;
  welcomeMessage: string;
} {
  const isReturning = hasSavedPreferences(user);
  const preferences = createInitialPreferences(user);

  const session: ChatSession = {
    id: generateSessionId(),
    userId: user?.id ?? null,
    activeAgent: 'router',  // Start with router to determine first agent
    preferences,
    conversationHistory: [],
    recommendations: null,
    adoptionComplete: isReturning && hasAllRequiredPreferences(preferences),
    isReturningUser: isReturning,
  };

  let welcomeMessage: string;

  if (isReturning && hasAllRequiredPreferences(preferences)) {
    // Returning user with complete preferences - ask to confirm or update
    welcomeMessage = generateReturningUserMessage(preferences, user!.preferencesUpdatedAt ?? new Date());
  } else {
    // New user or incomplete preferences
    welcomeMessage = "Hi! I'm your puppy assistant. I can help you find your perfect puppy match or answer any questions about dogs, breeds, and puppy care. What would you like to do?";
  }

  session.conversationHistory.push({role: 'assistant', content: welcomeMessage});

  return {session, welcomeMessage};
}

/**
 * Process a user message in the chat session using LangGraph
 */
export async function processChatMessage(
  session: ChatSession,
  userMessage: string
): Promise<{
  session: ChatSession;
  response: ChatMessageResponse;
}> {
  // Add user message to history before processing
  session.conversationHistory.push({role: 'user', content: userMessage});

  // Process through LangGraph with LangSmith tracing
  const result = await processMessage(
    userMessage,
    {
      messages: session.conversationHistory.slice(0, -1), // Exclude current message (already in graph input)
      preferences: session.preferences,
      userId: session.userId,
      recommendations: session.recommendations,
      adoptionComplete: session.adoptionComplete,
      currentAgent: session.activeAgent,
    },
    {sessionId: session.id}
  );

  // Update session with results
  session.preferences = result.preferences;
  session.recommendations = result.recommendations;
  session.adoptionComplete = result.adoptionComplete;
  session.activeAgent = result.currentAgent;

  // Register run ID for feedback linking (allows thumbs up/down to be associated with this trace)
  if (result.runId) {
    registerSessionRun(session.id, result.runId);
  }

  // Register recommended puppy IDs for tracking selection/application feedback
  if (result.recommendations) {
    const puppyIds = result.recommendations.recommendations.map(r => r.puppy.id);
    registerSessionRecommendations(session.id, puppyIds);
  }

  // Add assistant response to history
  session.conversationHistory.push({role: 'assistant', content: result.response});

  loggers.adoption.debug({
    agent: result.currentAgent,
    adoptionComplete: result.adoptionComplete,
    runId: result.runId?.slice(0, 8),
  }, 'Chat message processed');

  return {
    session,
    response: {
      message: result.response,
      activeAgent: result.currentAgent === 'router' ? 'expert' : result.currentAgent,
      recommendations: result.recommendations ?? undefined,
    },
  };
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `chat_${randomUUID()}`;
}

/**
 * Redis session store for chat sessions
 */
const sessions = new RedisSessionStore<ChatSession>('session:chat', redisTTL.chatSession);

export async function getSession(sessionId: string): Promise<ChatSession | null> {
  return sessions.get(sessionId);
}

export async function saveSession(session: ChatSession): Promise<void> {
  await sessions.set(session.id, session);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await sessions.delete(sessionId);
  cleanupFeedbackSession(sessionId);
}

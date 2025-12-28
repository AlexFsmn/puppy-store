import type {RecommendationResponse} from '@puppy-store/shared';
import {
  createInitialPreferences,
  createEmptyPreferences,
  processAdoptionMessage,
  hasAllRequiredPreferences,
  hasSavedPreferences,
  saveUserPreferences,
  generateReturningUserMessage,
  type ExtractedPreferences,
  type AdoptionResult,
  type UserWithPreferences,
} from './adoptionAgent';
import {scorePuppies} from './scoringService';
import {selectAndExplain} from './selectionService';

/**
 * Session state for tracking where we are in the flow
 */
type SessionState =
  | 'awaiting_confirmation'  // Returning user - waiting for them to confirm/modify saved prefs
  | 'collecting_info'        // Gathering preferences through conversation
  | 'complete';              // Ready to/has made recommendations

/**
 * Conversation state for the recommendation flow
 */
export interface RecommendationSession {
  userId: string | null;
  preferences: ExtractedPreferences;
  state: SessionState;
  isReturningUser: boolean;
  conversationHistory: Array<{role: 'user' | 'assistant'; content: string}>;
}

/**
 * Start a new recommendation session
 *
 * For returning users with saved preferences:
 * - Pre-fills their saved preferences
 * - Sets state to 'awaiting_confirmation' to ask if they want to use same prefs
 *
 * For new users:
 * - Only pre-fills location if available
 * - Sets state to 'collecting_info' to start gathering preferences
 */
export function startRecommendationSession(user: UserWithPreferences | null): {
  session: RecommendationSession;
  initialMessage: string | null;
} {
  const isReturning = hasSavedPreferences(user);

  const session: RecommendationSession = {
    userId: user?.id ?? null,
    preferences: createInitialPreferences(user),
    state: isReturning ? 'awaiting_confirmation' : 'collecting_info',
    isReturningUser: isReturning,
    conversationHistory: [],
  };

  // For returning users, generate the welcome back message
  let initialMessage: string | null = null;
  if (isReturning && user?.savedPreferences && user.preferencesUpdatedAt) {
    initialMessage = generateReturningUserMessage(user.savedPreferences, user.preferencesUpdatedAt);
    session.conversationHistory.push({role: 'assistant', content: initialMessage});
  }

  return {session, initialMessage};
}

/**
 * Process a user message in the recommendation flow
 *
 * Handles three states:
 * 1. awaiting_confirmation - Returning user confirming/modifying saved prefs
 * 2. collecting_info - Gathering new preference information
 * 3. complete - Already has recommendations (shouldn't receive messages)
 */
export async function processRecommendationMessage(
  session: RecommendationSession,
  userMessage: string
): Promise<{
  session: RecommendationSession;
  response: string | RecommendationResponse;
  isComplete: boolean;
}> {
  session.conversationHistory.push({role: 'user', content: userMessage});

  // Handle returning user confirmation
  if (session.state === 'awaiting_confirmation') {
    return handleConfirmationResponse(session, userMessage);
  }

  // Normal adoption flow
  return handleAdoptionMessage(session, userMessage);
}

/**
 * Handle response from returning user about their saved preferences
 */
async function handleConfirmationResponse(
  session: RecommendationSession,
  userMessage: string
): Promise<{
  session: RecommendationSession;
  response: string | RecommendationResponse;
  isComplete: boolean;
}> {
  const msgLower = userMessage.toLowerCase().trim();

  // Check for confirmation (same preferences)
  const confirmPhrases = ['yes', 'yeah', 'yep', 'sure', 'same', 'use these', 'looks good', 'correct', 'go ahead', 'search'];
  const isConfirmed = confirmPhrases.some(phrase => msgLower.includes(phrase));

  if (isConfirmed) {
    // User confirmed - proceed directly to recommendations
    session.state = 'complete';
    return generateRecommendations(session);
  }

  // Check for explicit reset
  const resetPhrases = ['start over', 'start fresh', 'new search', 'different', 'change everything'];
  const wantsReset = resetPhrases.some(phrase => msgLower.includes(phrase));

  if (wantsReset) {
    // Reset to empty preferences, keeping only location
    session.preferences = createEmptyPreferences(session.preferences.location);
    session.state = 'collecting_info';

    const response = "No problem! Let's start fresh. Tell me about your living situation and lifestyle, and I'll help find the perfect puppy for you.";
    session.conversationHistory.push({role: 'assistant', content: response});

    return {
      session,
      response,
      isComplete: false,
    };
  }

  // User wants to modify - extract changes from their message
  session.state = 'collecting_info';
  return handleAdoptionMessage(session, userMessage);
}

/**
 * Handle adoption conversation - extracting preferences from user messages
 */
async function handleAdoptionMessage(
  session: RecommendationSession,
  userMessage: string
): Promise<{
  session: RecommendationSession;
  response: string | RecommendationResponse;
  isComplete: boolean;
}> {
  const adoptionResult: AdoptionResult = await processAdoptionMessage(
    userMessage,
    session.preferences,
    session.userId,
    session.conversationHistory
  );
  session.preferences = adoptionResult.preferences;

  if (!adoptionResult.isComplete) {
    const followUp = adoptionResult.followUpQuestion || "Could you tell me more about your living situation?";
    session.conversationHistory.push({role: 'assistant', content: followUp});

    return {
      session,
      response: followUp,
      isComplete: false,
    };
  }

  // All info collected - generate recommendations
  session.state = 'complete';
  return generateRecommendations(session);
}

/**
 * Generate recommendations and save preferences for next time
 */
async function generateRecommendations(
  session: RecommendationSession
): Promise<{
  session: RecommendationSession;
  response: RecommendationResponse;
  isComplete: boolean;
}> {
  // Save preferences for next time (if we have a user ID)
  if (session.userId) {
    await saveUserPreferences(session.userId, session.preferences);
  }

  // Score puppies using DB query (scalable)
  const scoredPuppies = await scorePuppies(session.preferences, 10);

  // Use LLM to select top 3 and write personalized explanations
  const recommendations = await selectAndExplain(scoredPuppies, session.preferences);

  return {
    session,
    response: recommendations,
    isComplete: true,
  };
}

/**
 * Direct recommendation for when preferences are already known
 * (e.g., from a form submission)
 */
export async function getRecommendations(
  preferences: ExtractedPreferences
): Promise<RecommendationResponse> {
  if (!hasAllRequiredPreferences(preferences)) {
    return {
      recommendations: [],
      explanation: 'Missing required preferences. Please provide living space, activity level, children/pet info, and experience level.',
    };
  }

  const scoredPuppies = await scorePuppies(preferences, 10);
  return selectAndExplain(scoredPuppies, preferences);
}

// Re-export types for convenience
export type {ExtractedPreferences, AdoptionResult, UserWithPreferences} from './adoptionAgent';
export type {ScoredPuppy} from './scoringService';

import {Client} from 'langsmith';
import {loggers} from '@puppy-store/shared';

/**
 * LangSmith client for sending feedback
 * Only initialized if tracing is enabled
 */
let langsmithClient: Client | null = null;

function getLangSmithClient(): Client | null {
  if (process.env.LANGCHAIN_TRACING_V2 !== 'true') {
    return null;
  }

  if (!langsmithClient) {
    langsmithClient = new Client({
      apiUrl: process.env.LANGCHAIN_ENDPOINT,
      apiKey: process.env.LANGCHAIN_API_KEY,
    });
  }

  return langsmithClient;
}

/**
 * Feedback types for recommendation outcomes
 */
export type FeedbackType = 'thumbs_up' | 'thumbs_down' | 'puppy_selected' | 'application_submitted';

/**
 * Store mapping session IDs to their latest LangSmith run IDs
 * This allows us to link feedback to the correct trace
 */
const sessionRunMap = new Map<string, string>();

/**
 * Store which puppies were recommended in each session
 */
const sessionRecommendations = new Map<string, string[]>();

/**
 * Register a run ID for a session (called after graph execution)
 */
export function registerSessionRun(sessionId: string, runId: string): void {
  sessionRunMap.set(sessionId, runId);
}

/**
 * Register recommended puppy IDs for a session
 */
export function registerSessionRecommendations(sessionId: string, puppyIds: string[]): void {
  sessionRecommendations.set(sessionId, puppyIds);
}

/**
 * Get recommended puppy IDs for a session
 */
export function getSessionRecommendations(sessionId: string): string[] | undefined {
  return sessionRecommendations.get(sessionId);
}

/**
 * Submit thumbs up/down feedback for a recommendation session
 */
export async function submitThumbsFeedback(
  sessionId: string,
  isPositive: boolean,
  comment?: string
): Promise<{success: boolean; feedbackId?: string; error?: string}> {
  const client = getLangSmithClient();

  if (!client) {
    loggers.adoption.debug('LangSmith tracing not enabled, skipping feedback submission');
    return {success: true};
  }

  const runId = sessionRunMap.get(sessionId);
  if (!runId) {
    loggers.adoption.warn({sessionId}, 'No run ID found for session');
    return {success: false, error: 'No trace found for this session'};
  }

  try {
    const feedback = await client.createFeedback(runId, 'user_rating', {
      score: isPositive ? 1 : 0,
      value: isPositive ? 'positive' : 'negative',
      comment,
      feedbackSourceType: 'app',
      sourceInfo: {
        sessionId,
        feedbackType: isPositive ? 'thumbs_up' : 'thumbs_down',
      },
    });

    loggers.adoption.info({sessionId, isPositive}, 'Feedback submitted');
    return {success: true, feedbackId: feedback.id};
  } catch (error) {
    loggers.adoption.error({err: error, sessionId}, 'Failed to submit feedback to LangSmith');
    return {success: false, error: 'Failed to submit feedback'};
  }
}

/**
 * Track when a user selects a specific puppy from recommendations
 */
export async function trackPuppySelection(
  sessionId: string,
  puppyId: string,
  puppyName: string
): Promise<{success: boolean; feedbackId?: string; error?: string}> {
  const client = getLangSmithClient();

  if (!client) {
    loggers.adoption.debug('LangSmith tracing not enabled, skipping puppy selection tracking');
    return {success: true};
  }

  const runId = sessionRunMap.get(sessionId);
  if (!runId) {
    loggers.adoption.warn({sessionId}, 'No run ID found for session');
    return {success: false, error: 'No trace found for this session'};
  }

  // Check if the selected puppy was in the recommendations
  const recommendedPuppies = sessionRecommendations.get(sessionId);
  const wasRecommended = recommendedPuppies?.includes(puppyId) ?? false;

  try {
    const feedback = await client.createFeedback(runId, 'puppy_selection', {
      score: wasRecommended ? 1 : 0.5, // Higher score if user picked a recommended puppy
      value: {
        puppyId,
        puppyName,
        wasRecommended,
      },
      comment: wasRecommended
        ? `User selected recommended puppy: ${puppyName}`
        : `User selected non-recommended puppy: ${puppyName}`,
      feedbackSourceType: 'app',
      sourceInfo: {
        sessionId,
        feedbackType: 'puppy_selected',
        puppyId,
        wasRecommended,
      },
    });

    loggers.adoption.info({sessionId, puppyName, wasRecommended}, 'Puppy selection tracked');
    return {success: true, feedbackId: feedback.id};
  } catch (error) {
    loggers.adoption.error({err: error, sessionId}, 'Failed to track puppy selection');
    return {success: false, error: 'Failed to track selection'};
  }
}

/**
 * Track when a user submits an application for a recommended puppy
 * This is the strongest positive signal - the user took action!
 */
export async function trackApplicationSubmission(
  sessionId: string,
  puppyId: string,
  puppyName: string,
  applicationId: string
): Promise<{success: boolean; feedbackId?: string; error?: string}> {
  const client = getLangSmithClient();

  if (!client) {
    loggers.adoption.debug('LangSmith tracing not enabled, skipping application tracking');
    return {success: true};
  }

  const runId = sessionRunMap.get(sessionId);
  if (!runId) {
    // Try to still log this as valuable feedback even without a trace
    loggers.adoption.warn({sessionId}, 'No run ID found for session, but application was submitted');
    return {success: false, error: 'No trace found for this session'};
  }

  // Check if the selected puppy was in the recommendations
  const recommendedPuppies = sessionRecommendations.get(sessionId);
  const wasRecommended = recommendedPuppies?.includes(puppyId) ?? false;

  try {
    const feedback = await client.createFeedback(runId, 'application_submitted', {
      score: 1, // Application submission is always a strong positive signal
      value: {
        puppyId,
        puppyName,
        applicationId,
        wasRecommended,
      },
      comment: wasRecommended
        ? `User submitted application for recommended puppy: ${puppyName}`
        : `User submitted application for puppy: ${puppyName}`,
      feedbackSourceType: 'app',
      sourceInfo: {
        sessionId,
        feedbackType: 'application_submitted',
        puppyId,
        applicationId,
        wasRecommended,
      },
    });

    loggers.adoption.info({sessionId, puppyName, applicationId}, 'Application submission tracked');
    return {success: true, feedbackId: feedback.id};
  } catch (error) {
    loggers.adoption.error({err: error, sessionId}, 'Failed to track application');
    return {success: false, error: 'Failed to track application'};
  }
}

/**
 * Clean up session data (call when session ends)
 */
export function cleanupSession(sessionId: string): void {
  sessionRunMap.delete(sessionId);
  sessionRecommendations.delete(sessionId);
}

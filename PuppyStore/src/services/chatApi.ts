import {AgentType} from '../types/enums';
import {
  ChatSessionResponse,
  ChatMessageResponse,
  ChatSessionState,
  RecommendationResponse,
  ThumbsFeedbackResponse,
  TrackingResponse,
} from '../types/api/chat';
import {config} from '../config';
import {createApiClient, type ApiClient, ApiError} from './client';

export type {
  AgentType,
  ChatSessionResponse,
  ChatMessageResponse,
  ChatSessionState,
  RecommendationResponse,
  ThumbsFeedbackResponse,
  TrackingResponse,
};

let client: ApiClient = createApiClient(config.api.expert);

export function initializeAuthClient(tokenProvider: () => Promise<string | null>) {
  client = createApiClient(config.api.expert, {tokenProvider});
}

export function startChatSession() {
  return client.post<ChatSessionResponse>('/chat/session', undefined);
}

export function sendChatMessage(sessionId: string, message: string) {
  return client.post<ChatMessageResponse>(`/chat/session/${sessionId}/message`, {message});
}

export function getChatSession(sessionId: string) {
  return client.get<ChatSessionState>(`/chat/session/${sessionId}`);
}

export async function submitThumbsFeedback(
  sessionId: string,
  isPositive: boolean,
  comment?: string
): Promise<ThumbsFeedbackResponse> {
  try {
    return await client.post<ThumbsFeedbackResponse>('/feedback/thumbs', {
      sessionId,
      isPositive,
      comment,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      console.warn('Failed to submit feedback:', error.status);
    }
    return {success: false};
  }
}

export async function trackPuppySelection(
  sessionId: string,
  puppyId: string,
  puppyName: string
): Promise<TrackingResponse> {
  try {
    return await client.post<TrackingResponse>('/feedback/selection', {
      sessionId,
      puppyId,
      puppyName,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      console.warn('Failed to track selection:', error.status);
    }
    return {success: false};
  }
}

export async function trackApplicationSubmission(
  sessionId: string,
  puppyId: string,
  puppyName: string,
  applicationId: string
): Promise<TrackingResponse> {
  try {
    return await client.post<TrackingResponse>('/feedback/application', {
      sessionId,
      puppyId,
      puppyName,
      applicationId,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      console.warn('Failed to track application:', error.status);
    }
    return {success: false};
  }
}

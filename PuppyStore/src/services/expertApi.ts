import {PuppyPreferences} from '../types/models/Auth';
import {
  ExpertResponse,
  RecommendationResponse,
  GeneratedDescription,
  ChatSessionResponse,
  ChatMessageResponse,
} from '../types/api/chat';
import {config} from '../config';
import {createApiClient} from './client';

export type {
  ExpertResponse,
  PuppyPreferences,
  RecommendationResponse,
  GeneratedDescription,
  ChatSessionResponse,
  ChatMessageResponse,
};

const client = createApiClient(config.api.expert);

export function askExpert(question: string) {
  return client.post<ExpertResponse>('/expert/ask', {question});
}

export function getRecommendations(preferences: PuppyPreferences) {
  return client.post<RecommendationResponse>('/recommendations', preferences);
}

export function getGeneratedDescription(puppyId: string) {
  return client.get<GeneratedDescription>(`/descriptions/${puppyId}`);
}

export function startRecommendationSession(accessToken?: string | null) {
  return client.post<ChatSessionResponse>('/recommendations/session', undefined, {accessToken});
}

export function sendRecommendationMessage(sessionId: string, message: string) {
  return client.post<ChatMessageResponse>(`/recommendations/session/${sessionId}/message`, {message});
}

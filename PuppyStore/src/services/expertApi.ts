import {
  GeneratedDescription,
  ChatSessionResponse,
  ChatMessageResponse,
} from '../types/api/chat';
import {config} from '../config';
import {createApiClient} from './client';

export type {
  GeneratedDescription,
  ChatSessionResponse,
  ChatMessageResponse,
};

const client = createApiClient(config.api.expert);

export function getGeneratedDescription(puppyId: string) {
  return client.get<GeneratedDescription>(`/descriptions/${puppyId}`);
}

import {NotificationCounts} from '../types/api/notifications';
import {config} from '../config';
import {createApiClient, type ApiClient} from './client';

export type {NotificationCounts};

let client: ApiClient = createApiClient(config.api.puppies);

export function initializeAuthClient(tokenProvider: () => Promise<string | null>) {
  client = createApiClient(config.api.puppies, {tokenProvider});
}

export function fetchNotificationCounts() {
  return client.get<NotificationCounts>('/notifications/counts');
}

export function markApplicationsRead() {
  return client.post<void>('/notifications/mark-applications-read', undefined);
}

export function markChatRead(chatRoomId: string) {
  return client.post<void>(`/notifications/mark-chat-read/${chatRoomId}`, undefined);
}

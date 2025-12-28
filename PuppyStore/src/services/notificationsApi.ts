import {NotificationCounts} from '../types/api/notifications';
import {config} from '../config';
import {createApiClient} from './client';

export type {NotificationCounts};

const client = createApiClient(config.api.puppies);

export function fetchNotificationCounts(accessToken: string) {
  return client.get<NotificationCounts>('/notifications/counts', {accessToken});
}

export function markApplicationsRead(accessToken: string) {
  return client.post<void>('/notifications/mark-applications-read', undefined, {accessToken});
}

export function markChatRead(chatRoomId: string, accessToken: string) {
  return client.post<void>(`/notifications/mark-chat-read/${chatRoomId}`, undefined, {accessToken});
}

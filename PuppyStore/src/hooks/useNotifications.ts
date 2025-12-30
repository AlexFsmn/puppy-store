import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import * as notificationsApi from '../services/notificationsApi';
import {ui} from '../constants';

// Query keys
export const notificationKeys = {
  all: ['notifications'] as const,
  counts: () => [...notificationKeys.all, 'counts'] as const,
};

// Query hooks
export function useNotificationCounts() {
  return useQuery({
    queryKey: notificationKeys.counts(),
    queryFn: () => notificationsApi.fetchNotificationCounts(),
    refetchInterval: ui.polling.notificationsMs,
  });
}

// Mutation hooks
export function useMarkApplicationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markApplicationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: notificationKeys.counts()});
    },
  });
}

export function useMarkChatRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chatRoomId: string) => notificationsApi.markChatRead(chatRoomId),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: notificationKeys.counts()});
    },
  });
}

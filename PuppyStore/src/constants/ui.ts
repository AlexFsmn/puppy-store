// UI-related constants for lists, queries, and other interface behaviors

export const ui = {
  // FlatList configuration
  list: {
    endReachedThreshold: 0.5, // Trigger load more when 50% from bottom
  },

  // TanStack Query configuration
  query: {
    retry: 1, // Retry failed requests once
    staleTimeMs: 1000 * 60 * 5, // 5 minutes - data is considered fresh for this duration
  },

  // Polling intervals (in milliseconds)
  polling: {
    notificationsMs: 30000, // Refetch notifications every 30 seconds
  },
} as const;

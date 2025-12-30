import React, {ReactNode} from 'react';
import {useNotificationCounts, useMarkApplicationsRead, useMarkChatRead} from '../hooks/useNotifications';

interface NotificationsProviderProps {
  children: ReactNode;
}

// This provider is now just a pass-through
// Real data comes from TanStack Query hooks
export function NotificationsProvider({children}: NotificationsProviderProps) {
  return <>{children}</>;
}

// Re-export hooks for convenience
export {useNotificationCounts, useMarkApplicationsRead, useMarkChatRead};

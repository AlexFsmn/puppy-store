import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {useAuth} from './AuthContext';
import * as notificationsApi from '../services/notificationsApi';

interface NotificationsContextType {
  unreadApplications: number;
  unreadMessages: number;
  refreshCounts: () => Promise<void>;
  markApplicationsRead: () => Promise<void>;
  markChatRead: (chatRoomId: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(
  undefined,
);

interface NotificationsProviderProps {
  children: ReactNode;
}

export function NotificationsProvider({children}: NotificationsProviderProps) {
  const {isAuthenticated, getAccessToken} = useAuth();
  const [unreadApplications, setUnreadApplications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const refreshCounts = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const counts = await notificationsApi.fetchNotificationCounts(token);
      setUnreadApplications(counts.unreadApplications);
      setUnreadMessages(counts.unreadMessages);
    } catch (error) {
      console.error('Failed to fetch notification counts:', error);
    }
  }, [getAccessToken]);

  const markApplicationsRead = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      await notificationsApi.markApplicationsRead(token);
      setUnreadApplications(0);
    } catch (error) {
      console.error('Failed to mark applications as read:', error);
    }
  }, [getAccessToken]);

  const markChatRead = useCallback(
    async (chatRoomId: string) => {
      try {
        const token = await getAccessToken();
        if (!token) return;

        await notificationsApi.markChatRead(chatRoomId, token);
        // Refresh counts to get accurate unread message count
        await refreshCounts();
      } catch (error) {
        console.error('Failed to mark chat as read:', error);
      }
    },
    [getAccessToken, refreshCounts],
  );

  // Fetch counts on mount and when auth changes
  useEffect(() => {
    if (isAuthenticated) {
      refreshCounts();
    } else {
      setUnreadApplications(0);
      setUnreadMessages(0);
    }
  }, [isAuthenticated, refreshCounts]);

  // Poll for updates every 30 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(refreshCounts, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshCounts]);

  return (
    <NotificationsContext.Provider
      value={{
        unreadApplications,
        unreadMessages,
        refreshCounts,
        markApplicationsRead,
        markChatRead,
      }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextType {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      'useNotifications must be used within a NotificationsProvider',
    );
  }
  return context;
}

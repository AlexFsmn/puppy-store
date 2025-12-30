import React, {useEffect} from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {RootNavigator} from './src/navigation/RootNavigator';
import {SettingsProvider} from './src/contexts/SettingsContext';
import {AuthProvider, useAuth} from './src/contexts/AuthContext';
import {NotificationsProvider} from './src/contexts/NotificationsContext';
import {ErrorBoundary} from './src/components';
import * as applicationsApi from './src/services/applicationsApi';
import * as puppiesApi from './src/services/puppiesApi';
import * as notificationsApi from './src/services/notificationsApi';
import * as chatApi from './src/services/chatApi';
import * as authApi from './src/services/authApi';
import {ui} from './src/constants';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: ui.query.retry,
      staleTime: ui.query.staleTimeMs,
    },
  },
});

function AppContent() {
  const isDarkMode = useColorScheme() === 'dark';
  const {getAccessToken} = useAuth();

  // Initialize all API clients with automatic token injection
  useEffect(() => {
    applicationsApi.initializeAuthClient(getAccessToken);
    puppiesApi.initializeAuthClient(getAccessToken);
    notificationsApi.initializeAuthClient(getAccessToken);
    chatApi.initializeAuthClient(getAccessToken);
    authApi.initializeAuthClient(getAccessToken);
  }, [getAccessToken]);

  return (
    <NotificationsProvider>
      <SettingsProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <RootNavigator />
      </SettingsProvider>
    </NotificationsProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default App;

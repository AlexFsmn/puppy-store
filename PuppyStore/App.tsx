import React from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {RootNavigator} from './src/navigation/RootNavigator';
import {SettingsProvider} from './src/contexts/SettingsContext';
import {AuthProvider} from './src/contexts/AuthContext';
import {NotificationsProvider} from './src/contexts/NotificationsContext';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationsProvider>
          <SettingsProvider>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            <RootNavigator />
          </SettingsProvider>
        </NotificationsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;

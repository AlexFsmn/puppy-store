import React, {memo} from 'react';
import {TouchableOpacity, View, StyleSheet, ActivityIndicator, Text} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {
  PuppyListScreen,
  PuppyDetailScreen,
  CreatePuppyScreen,
  MyPostingsScreen,
  ApplyScreen,
  MyApplicationsScreen,
  ReceivedApplicationsScreen,
  ApplicationDetailScreen,
  AssistantScreen,
  ChatScreen,
  SettingsScreen,
} from '../screens';
import {AuthStack} from './AuthStack';
import {useAuth} from '../contexts/AuthContext';
import {useNotificationCounts} from '../hooks/useNotifications';
import {colors} from '../theme/colors';
import Icon from 'react-native-vector-icons/Ionicons';

// Memoized tab bar icons
const PawIcon = memo(function PawIcon({color, size}: {color: string; size: number}) {
  return <Icon name="paw" size={size} color={color} />;
});

const ChatbubblesIcon = memo(function ChatbubblesIcon({color, size}: {color: string; size: number}) {
  return <Icon name="chatbubbles" size={size} color={color} />;
});

const HeartIcon = memo(function HeartIcon({color, size}: {color: string; size: number}) {
  return <Icon name="heart-outline" size={size} color={color} />;
});

// Memoized header buttons
const SettingsHeaderButton = memo(function SettingsHeaderButton({onPress}: {onPress: () => void}) {
  return (
    <TouchableOpacity style={styles.headerButton} onPress={onPress}>
      <Icon name="settings-outline" size={22} color={colors.text} />
    </TouchableOpacity>
  );
});

const ReceivedApplicationsHeaderButton = memo(function ReceivedApplicationsHeaderButton({
  onPress,
  badgeCount,
}: {
  onPress: () => void;
  badgeCount: number;
}) {
  return (
    <TouchableOpacity style={styles.headerButton} onPress={onPress}>
      <View>
        <Icon name="mail-outline" size={22} color={colors.text} />
        <Badge count={badgeCount} />
      </View>
    </TouchableOpacity>
  );
});

function Badge({count}: {count: number}) {
  if (count <= 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

export type RootStackParamList = {
  MainTabs: undefined;
  PuppyDetail: {id: string; name: string};
  Settings: undefined;
  Assistant: undefined;
  CreatePuppy: undefined;
  Apply: {puppyId: string; puppyName: string};
  MyApplications: undefined;
  ReceivedApplications: undefined;
  ApplicationDetail: {id: string};
  Chat: {applicationId: string; otherUserName: string};
  // Tab screens (for type compatibility)
  MyPostings: undefined;
};

export type TabParamList = {
  Puppies: undefined;
  Assistant: undefined;
  MyPostings: undefined;
  Applications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  const {data} = useNotificationCounts();
  const unreadApplications = data?.unreadApplications ?? 0;
  const unreadMessages = data?.unreadMessages ?? 0;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        headerTitleStyle: styles.headerTitle,
      }}
    >
      <Tab.Screen
        name="Puppies"
        component={PuppyListScreen}
        options={({navigation}) => ({
          title: 'Browse',
          tabBarIcon: ({color, size}) => <PawIcon color={color} size={size} />,
          headerTitle: 'Available Puppies',
          headerRight: () => (
            <SettingsHeaderButton
              onPress={() => navigation.getParent()?.navigate('Settings')}
            />
          ),
        })}
      />
      <Tab.Screen
        name="Assistant"
        component={AssistantScreen}
        options={{
          title: 'Assistant',
          tabBarIcon: ({color, size}) => <ChatbubblesIcon color={color} size={size} />,
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="MyPostings"
        component={MyPostingsScreen}
        options={{
          title: 'My Puppies',
          tabBarIcon: ({color, size}) => <HeartIcon color={color} size={size} />,
          headerTitle: 'My Postings',
        }}
      />
      <Tab.Screen
        name="Applications"
        component={MyApplicationsScreen}
        options={({navigation}) => ({
          title: 'Applications',
          tabBarIcon: ({color, size}) => (
            <View>
              <Icon name="document-text-outline" size={size} color={color} />
              <Badge count={unreadMessages} />
            </View>
          ),
          headerTitle: 'My Applications',
          headerRight: () => (
            <ReceivedApplicationsHeaderButton
              onPress={() => navigation.getParent()?.navigate('ReceivedApplications')}
              badgeCount={unreadApplications}
            />
          ),
        })}
      />
    </Tab.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="PuppyDetail"
        component={PuppyDetailScreen}
        options={({route}) => ({
          title: route.params.name,
          headerTitleStyle: styles.headerTitle,
          headerBackTitle: 'Back',
        })}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerTitleStyle: styles.headerTitle,
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="Assistant"
        component={AssistantScreen}
        options={{
          title: 'Assistant',
          headerTitleStyle: styles.headerTitle,
        }}
      />
      <Stack.Screen
        name="CreatePuppy"
        component={CreatePuppyScreen}
        options={{
          title: 'New Posting',
          headerTitleStyle: styles.headerTitle,
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="Apply"
        component={ApplyScreen}
        options={{
          title: 'Apply to Adopt',
          headerTitleStyle: styles.headerTitle,
        }}
      />
      <Stack.Screen
        name="ReceivedApplications"
        component={ReceivedApplicationsScreen}
        options={{
          title: 'Received Applications',
          headerTitleStyle: styles.headerTitle,
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="ApplicationDetail"
        component={ApplicationDetailScreen}
        options={{
          title: 'Application',
          headerTitleStyle: styles.headerTitle,
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={({route}) => ({
          title: route.params.otherUserName,
          headerTitleStyle: styles.headerTitle,
        })}
      />
    </Stack.Navigator>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function RootNavigator() {
  const {isAuthenticated, isLoading} = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    paddingTop: 4,
    height: 85,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  headerTitle: {
    color: colors.text,
    fontWeight: '600',
  },
  headerButton: {
    padding: 8,
    marginRight: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});

import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RouteProp} from '@react-navigation/native';
import {useChat, ChatMessage} from '../../hooks';
import {validation} from '../../constants';
import {formatTime} from '../../utils';
import {useNotifications} from '../../contexts/NotificationsContext';
import {colors, spacing, fontSize, fontWeight, containerStyles, buttonStyles, emptyStateStyles} from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import {RootStackParamList} from '../../navigation/RootNavigator';

type ChatScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Chat'>;
  route: RouteProp<RootStackParamList, 'Chat'>;
};

function MessageBubble({
  message,
  isOwn,
}: {
  message: ChatMessage;
  isOwn: boolean;
}) {
  return (
    <View style={[styles.messageBubble, isOwn ? styles.ownMessage : styles.otherMessage]}>
      {!isOwn && message.sender && (
        <Text style={styles.senderName}>{message.sender.name}</Text>
      )}
      <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
        {message.content}
      </Text>
      <Text style={[styles.messageTime, isOwn && styles.ownMessageTime]}>
        {formatTime(message.createdAt)}
      </Text>
    </View>
  );
}

export function ChatScreen({route}: ChatScreenProps) {
  const {applicationId} = route.params;
  const {messages, chatRoomId, isConnected, isLoading, error, sendMessage, currentUserId} =
    useChat(applicationId);
  const {markChatRead} = useNotifications();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({animated: true});
    }
  }, [messages]);

  // Mark chat as read when chatRoomId is available and when new messages arrive
  useEffect(() => {
    if (chatRoomId) {
      markChatRead(chatRoomId);
    }
  }, [chatRoomId, messages.length, markChatRead]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (trimmed) {
      sendMessage(trimmed);
      setInputText('');
    }
  };

  if (isLoading) {
    return (
      <View style={containerStyles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Connecting...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={containerStyles.centered}>
        <Icon name="chatbubble-ellipses-outline" size={48} color={colors.textMuted} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <View style={styles.connectionStatus}>
        <View
          style={[
            styles.connectionDot,
            isConnected ? styles.connected : styles.disconnected,
          ]}
        />
        <Text style={styles.connectionText}>
          {isConnected ? 'Connected' : 'Reconnecting...'}
        </Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({item}) => (
          <MessageBubble
            message={item}
            isOwn={item.senderId === currentUserId}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        ListEmptyComponent={
          <View style={emptyStateStyles.container}>
            <Icon name="chatbubbles-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>
              Start the conversation!
            </Text>
          </View>
        }
      />

      <View style={containerStyles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={validation.textLimits.message}
        />
        <TouchableOpacity
          style={[buttonStyles.send, !inputText.trim() && buttonStyles.sendDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}>
          <Icon
            name="send"
            size={20}
            color={inputText.trim() ? colors.white : colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: fontSize.lg,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connected: {
    backgroundColor: colors.success,
  },
  disconnected: {
    backgroundColor: colors.warning,
  },
  connectionText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  messagesList: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.sm,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: spacing.xs,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderBottomLeftRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  senderName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  messageText: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 20,
  },
  ownMessageText: {
    color: colors.white,
  },
  messageTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  emptySubtext: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
    maxHeight: 100,
  },
});

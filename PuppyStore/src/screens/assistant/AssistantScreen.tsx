import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import Markdown from 'react-native-markdown-display';
import {colors, spacing, layout, fontSize, fontWeight} from '../../theme';
import {
  startChatSession,
  sendChatMessage,
  submitThumbsFeedback,
  trackPuppySelection,
  RecommendationResponse,
  AgentType,
} from '../../services/chatApi';
import {useAuth} from '../../contexts/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';

// Store for tracking session ID globally (for ApplyScreen to use)
let currentRecommendationSessionId: string | null = null;

export function getRecommendationSessionId(): string | null {
  return currentRecommendationSessionId;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Assistant'>;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function AssistantScreen({navigation}: Props) {
  const insets = useSafeAreaInsets();
  const {refreshUser} = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [results, setResults] = useState<RecommendationResponse | null>(null);
  const [activeAgent, setActiveAgent] = useState<AgentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const initSession = useCallback(async () => {
    try {
      setInitializing(true);
      setError(null);
      setFeedbackGiven(null);

      const response = await startChatSession();

      setSessionId(response.sessionId);
      // Store globally for ApplyScreen to use
      currentRecommendationSessionId = response.sessionId;
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: response.message,
        },
      ]);
    } catch {
      setError('Failed to start session. Please try again.');
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    initSession();
  }, [initSession]);

  const sendMessage = async () => {
    if (!inputText.trim() || !sessionId || loading) return;

    const userMessage = inputText.trim();
    setInputText('');

    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
    };
    setMessages(prev => [...prev, newUserMessage]);
    setLoading(true);
    setError(null);

    try {
      const response = await sendChatMessage(sessionId, userMessage);

      setActiveAgent(response.activeAgent ?? null);

      if (response.hasRecommendations && response.recommendations) {
        setResults(response.recommendations);
        // Refresh user data to get updated preferences
        refreshUser();
      }

      // Always add the message response if there is one
      if (response.message) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.message,
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch {
      setError('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setMessages([]);
    setResults(null);
    setSessionId(null);
    setActiveAgent(null);
    setFeedbackGiven(null);
    currentRecommendationSessionId = null;
    initSession();
  };

  const handleThumbsFeedback = async (isPositive: boolean) => {
    if (!sessionId || feedbackGiven) return;

    setFeedbackGiven(isPositive ? 'positive' : 'negative');
    await submitThumbsFeedback(sessionId, isPositive);
  };

  const handlePuppySelect = async (puppyId: string, puppyName: string) => {
    // Track the selection for feedback
    if (sessionId) {
      await trackPuppySelection(sessionId, puppyId, puppyName);
    }
    // Navigate to puppy detail
    navigation.navigate('PuppyDetail', {id: puppyId, name: puppyName});
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({animated: true});
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Starting your assistant...</Text>
      </View>
    );
  }

  // Show results view when recommendations are ready
  if (results) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, {paddingTop: insets.top + 12}]}>
          <Text style={styles.title}>Your Matches</Text>
          <TouchableOpacity onPress={startOver}>
            <Text style={styles.startOver}>Start Over</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.resultsContainer}>
          <Text style={styles.resultsExplanation}>{results.explanation}</Text>

          {results.recommendations.map((match, index) => (
            <TouchableOpacity
              key={match.puppy.id}
              style={styles.matchCard}
              onPress={() => handlePuppySelect(match.puppy.id, match.puppy.name)}
            >
              <View style={styles.matchHeader}>
                <View style={styles.matchRank}>
                  <Text style={styles.matchRankText}>#{index + 1}</Text>
                </View>
                <View style={styles.matchInfo}>
                  <Text style={styles.matchName}>{match.puppy.name}</Text>
                  <Text style={styles.matchScore}>{match.matchScore}% match</Text>
                </View>
                <Icon name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
              <View style={styles.matchReasons}>
                {match.reasons.map((reason, i) => (
                  <View key={i} style={styles.reasonRow}>
                    <Icon name="checkmark" size={14} color={colors.primary} />
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))}

          {/* Feedback section */}
          <View style={styles.feedbackSection}>
            <Text style={styles.feedbackQuestion}>
              {feedbackGiven ? 'Thanks for your feedback!' : 'Were these recommendations helpful?'}
            </Text>
            <View style={styles.feedbackButtons}>
              <TouchableOpacity
                style={[
                  styles.feedbackButton,
                  feedbackGiven === 'positive' && styles.feedbackButtonActive,
                  feedbackGiven === 'negative' && styles.feedbackButtonInactive,
                ]}
                onPress={() => handleThumbsFeedback(true)}
                disabled={!!feedbackGiven}
              >
                <Icon
                  name={feedbackGiven === 'positive' ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={24}
                  color={
                    feedbackGiven === 'positive'
                      ? colors.white
                      : feedbackGiven === 'negative'
                        ? colors.textMuted
                        : colors.primary
                  }
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.feedbackButton,
                  feedbackGiven === 'negative' && styles.feedbackButtonActive,
                  feedbackGiven === 'positive' && styles.feedbackButtonInactive,
                ]}
                onPress={() => handleThumbsFeedback(false)}
                disabled={!!feedbackGiven}
              >
                <Icon
                  name={feedbackGiven === 'negative' ? 'thumbs-down' : 'thumbs-down-outline'}
                  size={24}
                  color={
                    feedbackGiven === 'negative'
                      ? colors.white
                      : feedbackGiven === 'positive'
                        ? colors.textMuted
                        : colors.primary
                  }
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.continueButton} onPress={() => setResults(null)}>
            <Text style={styles.continueButtonText}>Continue Chatting</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={[styles.chatHeader, {paddingTop: insets.top + 8}]}>
        <View style={styles.chatHeaderLeft}>
          <Icon name="chatbubbles" size={24} color={colors.primary} />
          <Text style={styles.chatTitle}>Puppy Assistant</Text>
          {activeAgent && (
            <View style={styles.agentBadge}>
              <Text style={styles.agentBadgeText}>
                {activeAgent === 'adoption' ? 'Finding Match' : 'Q&A'}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.newChatButton} onPress={startOver}>
          <Icon name="add-circle-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.chatContainer}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={scrollToBottom}
      >
        {messages.map(message => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.role === 'user' ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            {message.role === 'assistant' && (
              <View style={styles.avatarContainer}>
                <Icon name="paw" size={16} color={colors.primary} />
              </View>
            )}
            <View
              style={[
                styles.messageContent,
                message.role === 'user' ? styles.userContent : styles.assistantContent,
              ]}
            >
              {message.role === 'assistant' ? (
                <Markdown style={markdownStyles}>{message.content}</Markdown>
              ) : (
                <Text style={[styles.messageText, styles.userMessageText]}>
                  {message.content}
                </Text>
              )}
            </View>
          </View>
        ))}

        {loading && (
          <View style={[styles.messageBubble, styles.assistantBubble]}>
            <View style={styles.avatarContainer}>
              <Icon name="paw" size={16} color={colors.primary} />
            </View>
            <View style={[styles.messageContent, styles.assistantContent]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask me anything about puppies..."
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          editable={!loading}
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!inputText.trim() || loading}
        >
          <Icon
            name="send"
            size={20}
            color={!inputText.trim() || loading ? colors.textMuted : colors.white}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: fontSize.lg,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  startOver: {
    fontSize: fontSize.body,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  newChatButton: {
    padding: spacing.xs,
  },
  chatTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  agentBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  agentBadgeText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  chatContainer: {
    flex: 1,
  },
  chatContent: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  userBubble: {
    justifyContent: 'flex-end',
  },
  assistantBubble: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  messageContent: {
    maxWidth: '75%',
    padding: spacing.md,
    borderRadius: 16,
  },
  userContent: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: spacing.xs,
  },
  assistantContent: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
  },
  userMessageText: {
    color: colors.white,
  },
  errorText: {
    fontSize: fontSize.body,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl + spacing.xs : spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: colors.background,
    borderRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
  resultsContainer: {
    padding: spacing.xxl,
  },
  resultsExplanation: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  matchCard: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  matchRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  matchRankText: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  matchScore: {
    fontSize: fontSize.caption,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  matchReasons: {
    paddingLeft: 44,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  reasonText: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  continueButton: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: layout.cardRadius,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  feedbackSection: {
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedbackQuestion: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  feedbackButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackButtonActive: {
    backgroundColor: colors.primary,
  },
  feedbackButtonInactive: {
    opacity: 0.4,
  },
});

// Markdown styles for assistant messages
const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
  },
  strong: {
    fontWeight: '700',
    color: colors.text,
  },
  em: {
    fontStyle: 'italic',
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  list_item: {
    marginVertical: 2,
  },
  heading1: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  heading3: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  link: {
    color: colors.primary,
  },
  blockquote: {
    backgroundColor: colors.primaryLight,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: 12,
    paddingVertical: 4,
    marginVertical: 8,
  },
  code_inline: {
    backgroundColor: colors.border,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  fence: {
    backgroundColor: colors.border,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  code_block: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: colors.text,
  },
});

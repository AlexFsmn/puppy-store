import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RouteProp} from '@react-navigation/native';
import {useAuth} from '../../contexts/AuthContext';
import {submitApplication} from '../../services/applicationsApi';
import {trackApplicationSubmission} from '../../services/chatApi';
import {getRecommendationSessionId} from '../assistant/AssistantScreen';
import {colors, spacing, layout, fontSize, fontWeight} from '../../theme';
import {RootStackParamList} from '../../navigation/RootNavigator';
import {
  PrimaryButton,
  FormInput,
  FormSection,
  SwitchRow,
} from '../../components';

type ApplyScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Apply'>;
  route: RouteProp<RootStackParamList, 'Apply'>;
};

export function ApplyScreen({navigation, route}: ApplyScreenProps) {
  const {puppyId, puppyName} = route.params;
  const {getAccessToken, user} = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [livingSituation, setLivingSituation] = useState('');
  const [hasYard, setHasYard] = useState(false);
  const [hasFence, setHasFence] = useState(false);
  const [petExperience, setPetExperience] = useState('');
  const [otherPets, setOtherPets] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    if (
      !contactPhone.trim() ||
      !contactEmail.trim() ||
      !livingSituation.trim() ||
      !petExperience.trim()
    ) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const application = await submitApplication(
        {
          puppyId,
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim().toLowerCase(),
          livingSituation: livingSituation.trim(),
          hasYard,
          hasFence,
          petExperience: petExperience.trim(),
          otherPets: otherPets.trim() || undefined,
          message: message.trim() || undefined,
        },
        token,
      );

      // Track application submission for LangSmith feedback (if came from recommendations)
      const sessionId = getRecommendationSessionId();
      if (sessionId) {
        trackApplicationSubmission(sessionId, puppyId, puppyName, application.id);
      }

      navigation.goBack();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to submit application',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Apply to adopt {puppyName}</Text>
          <Text style={styles.subtitle}>
            Fill out this form to express your interest in adopting this puppy.
            The poster will review your application.
          </Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <FormSection title="Contact Information">
          <FormInput
            label="Phone *"
            placeholder="Your phone number"
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            editable={!isLoading}
          />
          <FormInput
            label="Email *"
            placeholder="Your email address"
            value={contactEmail}
            onChangeText={setContactEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!isLoading}
          />
        </FormSection>

        <FormSection title="Living Situation">
          <FormInput
            label="Describe your home *"
            placeholder="House, apartment, condo... Do you own or rent?"
            value={livingSituation}
            onChangeText={setLivingSituation}
            multiline
            numberOfLines={3}
            editable={!isLoading}
          />
          <SwitchRow
            label="Do you have a yard?"
            value={hasYard}
            onValueChange={setHasYard}
          />
          <SwitchRow
            label="Is the yard fenced?"
            value={hasFence}
            onValueChange={setHasFence}
            disabled={!hasYard}
          />
        </FormSection>

        <FormSection title="Pet Experience">
          <FormInput
            label="Your experience with pets *"
            placeholder="Tell us about your experience caring for pets..."
            value={petExperience}
            onChangeText={setPetExperience}
            multiline
            numberOfLines={3}
            editable={!isLoading}
          />
          <FormInput
            label="Other pets in the home"
            placeholder="List any current pets (optional)"
            value={otherPets}
            onChangeText={setOtherPets}
            editable={!isLoading}
          />
        </FormSection>

        <FormSection title="Additional Message">
          <FormInput
            placeholder="Anything else you'd like the poster to know? (optional)"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            editable={!isLoading}
          />
        </FormSection>

        <PrimaryButton
          title="Submit Application"
          onPress={handleSubmit}
          loading={isLoading}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: layout.screenPadding,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    lineHeight: 20,
  },
  errorContainer: {
    backgroundColor: colors.dangerLight,
    padding: spacing.md,
    borderRadius: layout.inputRadius,
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.body,
  },
});

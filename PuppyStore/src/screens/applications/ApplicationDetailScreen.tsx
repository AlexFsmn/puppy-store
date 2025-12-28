import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RouteProp} from '@react-navigation/native';
import {useAuth} from '../../contexts/AuthContext';
import {
  fetchApplication,
  updateApplicationStatus,
  Application,
} from '../../services/applicationsApi';
import {colors, spacing, layout, fontSize, fontWeight} from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import {RootStackParamList} from '../../navigation/RootNavigator';

type ApplicationDetailScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ApplicationDetail'>;
  route: RouteProp<RootStackParamList, 'ApplicationDetail'>;
};

const statusColors = {
  PENDING: {bg: colors.status.pending.background, text: colors.status.pending.text},
  ACCEPTED: {bg: colors.status.accepted.background, text: colors.status.accepted.text},
  REJECTED: {bg: colors.status.rejected.background, text: colors.status.rejected.text},
};

export function ApplicationDetailScreen({
  navigation,
  route,
}: ApplicationDetailScreenProps) {
  const {id} = route.params;
  const {getAccessToken, user} = useAuth();
  const [application, setApplication] = useState<Application | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApplication = useCallback(async () => {
    try {
      setError(null);
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      const data = await fetchApplication(id, token);
      setApplication(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application');
    }
  }, [getAccessToken, id]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadApplication().finally(() => setIsLoading(false));
    }, [loadApplication]),
  );

  const isPoster = application?.puppy?.posterId === user?.id;

  // Set up header message button (must be before early returns to follow Rules of Hooks)
  useEffect(() => {
    if (application && application.status === 'PENDING') {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity
            style={{padding: 8, marginRight: 8}}
            onPress={() =>
              navigation.navigate('Chat', {
                applicationId: application.id,
                otherUserName: isPoster
                  ? application.applicant?.name || 'Applicant'
                  : 'Poster',
              })
            }>
            <Icon name="chatbubble-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        ),
      });
    } else {
      navigation.setOptions({
        headerRight: undefined,
      });
    }
  }, [application, isPoster, navigation]);

  const handleUpdateStatus = async (status: 'ACCEPTED' | 'REJECTED') => {
    const action = status === 'ACCEPTED' ? 'accept' : 'reject';
    const confirmMessage =
      status === 'ACCEPTED'
        ? 'This will mark the puppy as adopted and reject all other applications.'
        : 'Are you sure you want to reject this application?';

    Alert.alert(`${action.charAt(0).toUpperCase() + action.slice(1)} Application`, confirmMessage, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: action.charAt(0).toUpperCase() + action.slice(1),
        style: status === 'REJECTED' ? 'destructive' : 'default',
        onPress: async () => {
          setIsUpdating(true);
          try {
            const token = await getAccessToken();
            if (!token) {
              throw new Error('Not authenticated');
            }
            await updateApplicationStatus(id, status, token);
            navigation.goBack();
          } catch (err) {
            Alert.alert(
              'Error',
              err instanceof Error ? err.message : 'Failed to update status',
            );
          } finally {
            setIsUpdating(false);
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !application) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Application not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadApplication}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canTakeAction = isPoster && application.status === 'PENDING';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.puppyName}>
            Application for {application.puppy?.name}
          </Text>
          <View
            style={[
              styles.statusBadge,
              {backgroundColor: statusColors[application.status].bg},
            ]}>
            <Text
              style={[
                styles.statusText,
                {color: statusColors[application.status].text},
              ]}>
              {application.status}
            </Text>
          </View>
        </View>
        <Text style={styles.dateText}>
          Submitted {new Date(application.createdAt).toLocaleDateString()}
        </Text>
      </View>

      {isPoster && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Applicant</Text>
          <View style={styles.infoRow}>
            <Icon name="person" size={18} color={colors.textMuted} />
            <Text style={styles.infoText}>{application.applicant?.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="mail" size={18} color={colors.textMuted} />
            <Text style={styles.infoText}>{application.contactEmail}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="call" size={18} color={colors.textMuted} />
            <Text style={styles.infoText}>{application.contactPhone}</Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Living Situation</Text>
        <Text style={styles.bodyText}>{application.livingSituation}</Text>
        <View style={styles.tagsRow}>
          <View style={[styles.tag, application.hasYard && styles.tagActive]}>
            <Icon
              name={application.hasYard ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={application.hasYard ? colors.success : colors.textMuted}
            />
            <Text
              style={[
                styles.tagText,
                application.hasYard && styles.tagTextActive,
              ]}>
              Has yard
            </Text>
          </View>
          <View style={[styles.tag, application.hasFence && styles.tagActive]}>
            <Icon
              name={application.hasFence ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={application.hasFence ? colors.success : colors.textMuted}
            />
            <Text
              style={[
                styles.tagText,
                application.hasFence && styles.tagTextActive,
              ]}>
              Fenced yard
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pet Experience</Text>
        <Text style={styles.bodyText}>{application.petExperience}</Text>
        {application.otherPets && (
          <View style={styles.subSection}>
            <Text style={styles.subSectionTitle}>Other pets:</Text>
            <Text style={styles.bodyText}>{application.otherPets}</Text>
          </View>
        )}
      </View>

      {application.message && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Message</Text>
          <Text style={styles.bodyText}>{application.message}</Text>
        </View>
      )}

      {canTakeAction && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleUpdateStatus('REJECTED')}
            disabled={isUpdating}>
            {isUpdating ? (
              <ActivityIndicator color={colors.danger} size="small" />
            ) : (
              <>
                <Icon name="close" size={20} color={colors.danger} />
                <Text style={styles.rejectButtonText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleUpdateStatus('ACCEPTED')}
            disabled={isUpdating}>
            {isUpdating ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Icon name="checkmark" size={20} color={colors.white} />
                <Text style={styles.acceptButtonText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: layout.screenPadding,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  puppyName: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  dateText: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  bodyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagActive: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  tagText: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  tagTextActive: {
    color: colors.success,
  },
  subSection: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  subSectionTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: layout.cardRadius,
  },
  rejectButton: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  acceptButton: {
    backgroundColor: colors.success,
  },
  rejectButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.danger,
  },
  acceptButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  errorText: {
    fontSize: fontSize.lg,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: layout.inputRadius,
  },
  retryText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
});

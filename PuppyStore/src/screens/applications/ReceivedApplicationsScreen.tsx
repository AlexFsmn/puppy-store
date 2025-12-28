import React, {useState, useCallback, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useAuth} from '../../contexts/AuthContext';
import {useNotifications} from '../../contexts/NotificationsContext';
import {fetchReceivedApplications, Application} from '../../services/applicationsApi';
import {colors, spacing, layout, fontSize, fontWeight} from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import {RootStackParamList} from '../../navigation/RootNavigator';
import {LoadingScreen, ErrorScreen, EmptyState, StatusBadge} from '../../components';

type ReceivedApplicationsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ReceivedApplications'>;
};

export function ReceivedApplicationsScreen({
  navigation,
}: ReceivedApplicationsScreenProps) {
  const {getAccessToken} = useAuth();
  const {markApplicationsRead} = useNotifications();
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);

  const loadApplications = useCallback(async () => {
    try {
      setError(null);
      cursorRef.current = null;
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      const response = await fetchReceivedApplications(token);
      setApplications(response.data);
      cursorRef.current = response.nextCursor;
      setHasMore(response.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    }
  }, [getAccessToken]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !cursorRef.current) return;

    setIsLoadingMore(true);
    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetchReceivedApplications(token, cursorRef.current);
      setApplications(prev => [...prev, ...response.data]);
      cursorRef.current = response.nextCursor;
      setHasMore(response.hasMore);
    } catch (err) {
      console.error('Error loading more applications:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [getAccessToken, hasMore, isLoadingMore]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadApplications().finally(() => {
        setIsLoading(false);
        markApplicationsRead();
      });
    }, [loadApplications, markApplicationsRead]),
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadApplications();
    setIsRefreshing(false);
  };

  const renderItem = ({item}: {item: Application}) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate('ApplicationDetail', {id: item.id})
      }>
      <View style={styles.cardContent}>
        <View style={styles.cardInfo}>
          <View style={styles.headerRow}>
            <Text style={styles.applicantName}>
              {item.applicant?.name || 'Unknown'}
            </Text>
            <StatusBadge status={item.status} />
          </View>
          <Text style={styles.puppyName}>
            For: {item.puppy?.name || 'Unknown'}
          </Text>
          <Text style={styles.dateText}>
            Applied {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <Icon name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorScreen message={error} onRetry={loadApplications} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={applications}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isLoadingMore ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.loadingMore}
            />
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="mail-outline"
            title="No applications received"
            subtitle="When someone applies to adopt one of your puppies, you'll see it here"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: layout.screenPadding,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  cardInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  applicantName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  puppyName: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
  },
  dateText: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  loadingMore: {
    paddingVertical: spacing.lg,
  },
});

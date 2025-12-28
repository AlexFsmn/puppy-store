import React, {useState, useCallback, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useAuth} from '../../contexts/AuthContext';
import {fetchMyPuppies, MyPuppy} from '../../services/puppiesApi';
import {colors, spacing, layout, fontSize, fontWeight} from '../../theme';
import {LoadingScreen, ErrorScreen, EmptyState, StatusBadge} from '../../components';
import {getPuppyImageSource} from '../../utils';
import Icon from 'react-native-vector-icons/Ionicons';
import {RootStackParamList} from '../../navigation/RootNavigator';

type MyPostingsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MyPostings'>;
};

export function MyPostingsScreen({navigation}: MyPostingsScreenProps) {
  const {getAccessToken} = useAuth();
  const [puppies, setPuppies] = useState<MyPuppy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);

  const loadPuppies = useCallback(async () => {
    try {
      setError(null);
      cursorRef.current = null;
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      const response = await fetchMyPuppies(token);
      setPuppies(response.data);
      cursorRef.current = response.nextCursor;
      setHasMore(response.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load puppies');
    }
  }, [getAccessToken]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !cursorRef.current) return;

    setIsLoadingMore(true);
    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetchMyPuppies(token, cursorRef.current);
      setPuppies(prev => [...prev, ...response.data]);
      cursorRef.current = response.nextCursor;
      setHasMore(response.hasMore);
    } catch (err) {
      console.error('Error loading more puppies:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [getAccessToken, hasMore, isLoadingMore]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadPuppies().finally(() => setIsLoading(false));
    }, [loadPuppies]),
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPuppies();
    setIsRefreshing(false);
  };

  const renderItem = ({item}: {item: MyPuppy}) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('PuppyDetail', {id: item.id, name: item.name})}>
      <View style={styles.cardContent}>
        <Image
          source={getPuppyImageSource(item.id, item.photos?.[0]?.url)}
          style={styles.thumbnail}
        />
        <View style={styles.cardInfo}>
          <Text style={styles.puppyName}>{item.name}</Text>
          <Text style={styles.puppyBreed}>{item.breed}</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusBadge,
                item.status === 'AVAILABLE'
                  ? styles.statusAvailable
                  : styles.statusAdopted,
              ]}>
              <Text
                style={[
                  styles.statusText,
                  item.status === 'AVAILABLE'
                    ? styles.statusTextAvailable
                    : styles.statusTextAdopted,
                ]}>
                {item.status}
              </Text>
            </View>
          </View>
        </View>
        <Icon name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadPuppies}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={puppies}
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
          <View style={styles.emptyContainer}>
            <Icon name="paw-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No postings yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first puppy posting to find them a loving home
            </Text>
          </View>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreatePuppy' as never)}>
        <Icon name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
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
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: layout.inputRadius,
  },
  placeholderImage: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  puppyName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  puppyBreed: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  statusRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: layout.badgeRadius,
  },
  statusAvailable: {
    backgroundColor: colors.status.available.background,
  },
  statusAdopted: {
    backgroundColor: colors.status.adopted.background,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  statusTextAvailable: {
    color: colors.status.available.text,
  },
  statusTextAdopted: {
    color: colors.status.adopted.text,
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },
  loadingMore: {
    paddingVertical: spacing.lg,
  },
  fab: {
    position: 'absolute',
    right: spacing.xxl,
    bottom: spacing.xxl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: spacing.xs,
  },
});

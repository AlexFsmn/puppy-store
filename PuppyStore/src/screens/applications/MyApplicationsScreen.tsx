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
import {fetchMyApplications, Application} from '../../services/applicationsApi';
import {colors, spacing, layout, fontSize, fontWeight, cardStyles, containerStyles, thumbnailSizes} from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import {RootStackParamList} from '../../navigation/RootNavigator';
import {LoadingScreen, ErrorScreen, EmptyState, StatusBadge} from '../../components';
import {getPuppyImageSource} from '../../utils';

type MyApplicationsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MyApplications'>;
};


export function MyApplicationsScreen({navigation}: MyApplicationsScreenProps) {
  const {getAccessToken} = useAuth();
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
      const response = await fetchMyApplications(token);
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

      const response = await fetchMyApplications(token, cursorRef.current);
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
      loadApplications().finally(() => setIsLoading(false));
    }, [loadApplications]),
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadApplications();
    setIsRefreshing(false);
  };

  const renderItem = ({item}: {item: Application}) => (
    <TouchableOpacity
      style={cardStyles.container}
      onPress={() =>
        navigation.navigate('ApplicationDetail', {id: item.id})
      }>
      <View style={cardStyles.horizontal}>
        <Image
          source={getPuppyImageSource(item.puppy?.id || item.id, item.puppy?.photos?.[0]?.url)}
          style={[thumbnailSizes.md, styles.thumbnail]}
        />
        <View style={styles.cardInfo}>
          <Text style={styles.puppyName}>{item.puppy?.name || 'Unknown'}</Text>
          <Text style={styles.dateText}>
            Applied {new Date(item.createdAt).toLocaleDateString()}
          </Text>
          <StatusBadge status={item.status} />
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
    <View style={containerStyles.screen}>
      <FlatList
        data={applications}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={containerStyles.listContent}
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
            icon="document-text-outline"
            title="No applications yet"
            subtitle="Browse available puppies and apply to adopt one!"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    borderRadius: layout.inputRadius,
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
  dateText: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  loadingMore: {
    paddingVertical: spacing.lg,
  },
});

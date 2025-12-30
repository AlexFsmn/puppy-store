import React, {useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useReceivedApplications} from '../../hooks/useApplications';
import {useMarkApplicationsRead} from '../../hooks/useNotifications';
import type {Application} from '../../services/applicationsApi';
import {colors, spacing, layout, fontSize, fontWeight} from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import {RootStackParamList} from '../../navigation/RootNavigator';
import {LoadingScreen, ErrorScreen, EmptyState, StatusBadge} from '../../components';
import {ui} from '../../constants';

type ReceivedApplicationsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ReceivedApplications'>;
};

export function ReceivedApplicationsScreen({
  navigation,
}: ReceivedApplicationsScreenProps) {
  const {data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage} = useReceivedApplications();
  const applications = data?.pages.flatMap(page => page.data) ?? [];
  const {mutate: markRead} = useMarkApplicationsRead();

  // Mark applications as read when screen loads
  useEffect(() => {
    if (!isLoading && applications.length > 0) {
      markRead();
    }
  }, [isLoading, applications.length, markRead]);

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

  if (isLoading && applications.length === 0) {
    return <LoadingScreen />;
  }

  if (error && applications.length === 0) {
    return <ErrorScreen message={error.message} onRetry={refetch} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={applications}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={ui.list.endReachedThreshold}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator color={colors.primary} />
            </View>
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

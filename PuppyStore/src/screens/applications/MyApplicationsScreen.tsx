import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useMyApplications} from '../../hooks/useApplications';
import type {Application} from '../../services/applicationsApi';
import {colors, spacing, layout, fontSize, fontWeight, cardStyles, containerStyles, thumbnailSizes} from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import {RootStackParamList} from '../../navigation/RootNavigator';
import {LoadingScreen, ErrorScreen, EmptyState, StatusBadge} from '../../components';
import {getPuppyImageSource} from '../../utils';
import {ui} from '../../constants';

type MyApplicationsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MyApplications'>;
};


export function MyApplicationsScreen({navigation}: MyApplicationsScreenProps) {
  const {data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage} = useMyApplications();
  const applications = data?.pages.flatMap(page => page.data) ?? [];

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

  if (isLoading && applications.length === 0) {
    return <LoadingScreen />;
  }

  if (error && applications.length === 0) {
    return <ErrorScreen message={error.message} onRetry={refetch} />;
  }

  return (
    <View style={containerStyles.screen}>
      <FlatList
        data={applications}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={containerStyles.listContent}
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

import React, {memo, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {usePuppies} from '../../hooks/usePuppies';
import {PuppySummary} from '../../types';
import {colors, spacing, layout, fontSize, fontWeight, cardStyles, containerStyles, thumbnailSizes} from '../../theme';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import Icon from 'react-native-vector-icons/Ionicons';
import {LoadingScreen, ErrorScreen, EmptyState} from '../../components';
import {getPuppyImageSource} from '../../utils';
import {ui} from '../../constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface PuppyCardProps {
  puppy: PuppySummary;
  onPress: (id: string, name: string) => void;
}

const PuppyCard = memo(function PuppyCard({puppy, onPress}: PuppyCardProps) {
  const imageSource = getPuppyImageSource(puppy.id, puppy.photos?.[0]?.url);

  return (
    <TouchableOpacity
      style={[cardStyles.elevated, styles.card]}
      activeOpacity={0.7}
      onPress={() => onPress(puppy.id, puppy.name)}>
      <Image source={imageSource} style={[thumbnailSizes.xl, styles.puppyImage]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.puppyName} numberOfLines={1}>
            {puppy.name}
          </Text>
          <Icon name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
        <Text style={styles.puppyBreed} numberOfLines={1}>
          {puppy.breed}
        </Text>
        <View style={styles.locationRow}>
          <Icon name="location-outline" size={13} color={colors.textMuted} />
          <Text style={styles.locationText} numberOfLines={1}>
            {puppy.location || 'Unknown'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export function PuppyListScreen({navigation}: {navigation: NavigationProp}) {
  const {data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage} = usePuppies();
  const puppies = data?.pages.flatMap(page => page.data) ?? [];

  const handlePuppyPress = useCallback((id: string, name: string) => {
    navigation.navigate('PuppyDetail', {id, name});
  }, [navigation]);

  if (isLoading && puppies.length === 0) {
    return <LoadingScreen />;
  }

  if (error && puppies.length === 0) {
    return <ErrorScreen message={error.message} onRetry={refetch} />;
  }

  if (puppies.length === 0) {
    return (
      <View style={containerStyles.screen}>
        <EmptyState
          icon="paw-outline"
          title="No puppies available"
          subtitle="Check back soon for new listings"
          actionLabel="Refresh"
          onAction={refetch}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={puppies}
      keyExtractor={item => item.id}
      renderItem={({item}) => <PuppyCard puppy={item} onPress={handlePuppyPress} />}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
      onEndReachedThreshold={ui.list.endReachedThreshold}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={styles.footer}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxl,
  },
  card: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  puppyImage: {
    borderRadius: layout.inputRadius,
    margin: spacing.md,
  },
  cardContent: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    justifyContent: 'center',
  },
  cardHeader: containerStyles.rowBetween,
  puppyName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    flex: 1,
  },
  puppyBreed: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  locationRow: {
    ...containerStyles.row,
    gap: spacing.xs,
  },
  locationText: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  footer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
});

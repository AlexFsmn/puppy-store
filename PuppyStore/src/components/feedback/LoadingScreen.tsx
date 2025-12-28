import React from 'react';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {colors, spacing} from '../../theme';

type LoadingScreenProps = {
  size?: 'small' | 'large';
};

export function LoadingScreen({size = 'large'}: LoadingScreenProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
});

import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, spacing, fontSize, fontWeight} from '../../theme';

type StatusType = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'AVAILABLE' | 'ADOPTED';

type StatusBadgeProps = {
  status: StatusType;
  size?: 'small' | 'medium';
};

const statusConfig: Record<StatusType, {bg: string; text: string; label: string}> = {
  PENDING: {bg: colors.status.pending.background, text: colors.status.pending.text, label: 'Pending'},
  ACCEPTED: {bg: colors.status.accepted.background, text: colors.status.accepted.text, label: 'Accepted'},
  REJECTED: {bg: colors.status.rejected.background, text: colors.status.rejected.text, label: 'Rejected'},
  AVAILABLE: {bg: colors.status.available.background, text: colors.status.available.text, label: 'Available'},
  ADOPTED: {bg: colors.status.adopted.background, text: colors.status.adopted.text, label: 'Adopted'},
};

export function StatusBadge({status, size = 'small'}: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <View
      style={[
        styles.badge,
        size === 'medium' && styles.badgeMedium,
        {backgroundColor: config.bg},
      ]}>
      <Text
        style={[
          styles.text,
          size === 'medium' && styles.textMedium,
          {color: config.text},
        ]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeMedium: {
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  textMedium: {
    fontSize: fontSize.caption,
  },
});

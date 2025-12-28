import React from 'react';
import {View, Text, StyleSheet, ViewStyle} from 'react-native';
import {colors, spacing, layout, fontSize, fontWeight} from '../../theme';

type FormSectionProps = {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
};

export function FormSection({title, children, style}: FormSectionProps) {
  return (
    <View style={[styles.section, style]}>
      {title && <Text style={styles.title}>{title}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    padding: layout.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
});

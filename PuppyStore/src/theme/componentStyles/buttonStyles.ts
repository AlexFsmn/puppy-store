import {StyleSheet} from 'react-native';
import {colors} from '../colors';
import {spacing, layout} from '../spacing';
import {fontSize, fontWeight} from '../typography';

// Reusable button styles
export const buttonStyles = StyleSheet.create({
  // Primary button
  primary: {
    backgroundColor: colors.primary,
    borderRadius: layout.buttonRadius,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },

  // Secondary/outline button
  secondary: {
    backgroundColor: colors.primaryLight,
    borderRadius: layout.buttonRadius,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryText: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },

  // Danger button
  danger: {
    backgroundColor: colors.dangerLight,
    borderRadius: layout.cardRadius,
    padding: layout.cardPadding,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },

  dangerText: {
    color: colors.danger,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },

  // Disabled state
  disabled: {
    opacity: 0.7,
  },

  // Icon button (circular)
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // FAB (Floating Action Button)
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

  // Send button (chat)
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sendDisabled: {
    backgroundColor: colors.border,
  },
});

// Option/toggle button styles
export const optionStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  button: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },

  buttonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },

  text: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },

  textSelected: {
    color: colors.primary,
  },
});

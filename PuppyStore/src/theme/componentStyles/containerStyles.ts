import {StyleSheet} from 'react-native';
import {colors} from '../colors';
import {spacing, layout} from '../spacing';

// Reusable container/layout styles
export const containerStyles = StyleSheet.create({
  // Full screen container
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Centered content (loading, error, empty states)
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },

  // Scroll view content with standard padding
  scrollContent: {
    padding: layout.screenPadding,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // List content container
  listContent: {
    padding: layout.screenPadding,
    gap: spacing.md,
  },

  // Row layout
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Row with space between
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Input container with bottom border
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
});

// Empty state container
export const emptyStateStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
  },
});

// Error container
export const errorStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.dangerLight,
    padding: spacing.md,
    borderRadius: layout.inputRadius,
  },
});

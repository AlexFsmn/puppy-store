import {StyleSheet} from 'react-native';
import {colors} from '../colors';
import {spacing, layout} from '../spacing';

// Reusable card styles
export const cardStyles = StyleSheet.create({
  // Base card container
  container: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Card with shadow (for elevated cards)
  elevated: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    shadowColor: colors.shadow,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: spacing.xs,
    elevation: 1,
  },

  // Card content with standard padding
  content: {
    padding: layout.cardPadding,
  },

  // Horizontal card layout (image + content)
  horizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },

  // Section card (used in settings, forms)
  section: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    padding: layout.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
});

// Card thumbnail sizes
export const thumbnailSizes = {
  sm: {width: 48, height: 48},
  md: {width: 56, height: 56},
  lg: {width: 64, height: 64},
  xl: {width: 72, height: 72},
} as const;

import {TextStyle} from 'react-native';

// Font size scale
export const fontSize = {
  xs: 11,
  sm: 12,
  caption: 13,
  body: 14,
  md: 15,
  lg: 16,
  xl: 18,
  xxl: 20,
  title: 24,
  hero: 26,
  display: 32,
} as const;

// Font weight (React Native compatible)
export const fontWeight = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
};

// Pre-composed text styles
export const textStyles = {
  // Headings
  hero: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    lineHeight: 32,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    lineHeight: 30,
  },
  heading: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    lineHeight: 24,
  },
  subheading: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    lineHeight: 22,
  },

  // Body text
  body: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.regular,
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    lineHeight: 20,
  },

  // Labels
  label: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
  },
  labelSmall: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
  },

  // Captions & badges
  caption: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
  },
  badge: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },

  // Buttons
  button: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  buttonSmall: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
} as const;

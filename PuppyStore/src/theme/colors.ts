// Warm, cohesive color palette for puppy adoption app
// Based on terracotta/coral tones - approachable, nurturing, trustworthy

export const colors = {
  // Primary - warm coral/terracotta
  primary: '#d97559',
  primaryLight: '#f4e4df',
  primaryDark: '#c4614a',

  // Neutrals - warm grays
  text: '#3d3d3d',
  textSecondary: '#6b6b6b',
  textMuted: '#9a9a9a',

  // Backgrounds
  background: '#faf8f6',
  card: '#ffffff',
  border: '#eae6e3',

  // Semantic - staying in warm family
  positive: '#d97559',      // Same as primary for "available"
  positiveLight: '#f4e4df',
  negative: '#a0a0a0',      // Muted gray for "not available"
  negativeLight: '#f0f0f0',

  // Info - muted warm tone instead of blue
  info: '#8b7355',
  infoLight: '#f5f0eb',

  // Error - darker coral
  error: '#c44b3a',
  errorLight: '#fae8e5',

  // Energy levels - gradient within warm family
  energyLow: '#9a9a9a',
  energyMedium: '#d4a574',
  energyHigh: '#d97559',

  // Status colors for applications/badges
  status: {
    pending: {
      background: '#fef3c7',
      text: '#d97706',
    },
    accepted: {
      background: '#dcfce7',
      text: '#16a34a',
    },
    rejected: {
      background: '#fee2e2',
      text: '#dc2626',
    },
    available: {
      background: '#dcfce7',
      text: '#16a34a',
    },
    adopted: {
      background: '#e0e7ff',
      text: '#4f46e5',
    },
  },

  // Common UI colors
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',

  // Success/Warning/Danger semantic colors
  success: '#16a34a',
  successLight: '#dcfce7',
  warning: '#d97706',
  warningLight: '#fef3c7',
  danger: '#dc2626',
  dangerLight: '#fee2e2',
  dangerBorder: '#fecaca',

  // Shadow
  shadow: '#000000',

  // Switch thumb neutral color
  switchThumb: '#f4f3f4',
};

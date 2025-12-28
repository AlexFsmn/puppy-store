// Timing constants for animations, delays, and intervals

export const timing = {
  // Animation durations (in milliseconds)
  animation: {
    fast: 150,
    normal: 300,
    slow: 500,
  },

  // Debounce delays
  debounce: {
    search: 300,
    input: 150,
  },

  // Reconnection
  reconnect: {
    delay: 3000,
  },

  // Scroll behavior
  scroll: {
    toBottomDelay: 100,
  },
} as const;

// Form validation rules and limits

export const validation = {
  // Password requirements
  password: {
    minLength: 6,
  },

  // Text input limits
  textLimits: {
    message: 1000,
    chatMessage: 500,
    name: 100,
    bio: 500,
    description: 2000,
  },

  // Phone number
  phone: {
    minLength: 10,
    maxLength: 15,
  },
} as const;

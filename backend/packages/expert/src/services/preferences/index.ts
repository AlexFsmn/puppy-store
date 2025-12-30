// Types
export {
  PreferencesSchema,
  type ExtractedPreferences,
  type UserWithPreferences,
  type AdoptionResult,
} from './types';

// Validation
export {
  hasAllRequiredPreferences,
  getMissingFields,
  hasSavedPreferences,
} from './validation';

// Helpers
export {
  createEmptyPreferences,
  createInitialPreferences,
  formatPreferencesSummary,
  generateReturningUserMessage,
} from './helpers';

// Persistence
export {
  saveUserPreferences,
} from './persistence';

export {askExpert} from './expertService';
export {
  getRecommendations,
  startRecommendationSession,
  processRecommendationMessage,
  type RecommendationSession,
  type ExtractedPreferences,
  type UserWithPreferences,
  type ScoredPuppy,
} from './recommendationService';
export {
  createInitialPreferences,
  createEmptyPreferences,
  hasAllRequiredPreferences,
  hasSavedPreferences,
  saveUserPreferences,
  getMissingFields,
  formatPreferencesSummary,
} from './adoptionAgent';
export {scorePuppies} from './scoringService';
export {selectAndExplain} from './selectionService';
export {
  generateDescription,
  invalidateDescriptionCache,
  clearDescriptionCache,
  generateAllDescriptions,
} from './descriptionService';

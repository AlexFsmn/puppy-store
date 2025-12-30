import type {ExtractedPreferences} from './types';

/**
 * Required fields that must be filled before we can make recommendations
 */
const REQUIRED_FIELDS: (keyof ExtractedPreferences)[] = [
  'livingSpace',
  'activityLevel',
  'hasChildren',
  'hasOtherPets',
  'experienceLevel',
];

/**
 * Check if all required preferences have been collected
 */
export function hasAllRequiredPreferences(prefs: ExtractedPreferences): boolean {
  return REQUIRED_FIELDS.every(field => prefs[field] !== null);
}

/**
 * Get list of missing required fields
 */
export function getMissingFields(prefs: ExtractedPreferences): (keyof ExtractedPreferences)[] {
  return REQUIRED_FIELDS.filter(field => prefs[field] === null);
}

/**
 * Check if user has saved preferences from a previous session
 */
export function hasSavedPreferences(user: {savedPreferences: unknown; preferencesUpdatedAt: unknown} | null): boolean {
  return user?.savedPreferences !== null && user?.preferencesUpdatedAt !== null;
}

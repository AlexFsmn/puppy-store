import type {ExtractedPreferences, UserWithPreferences} from './types';

/**
 * Create empty preferences with only location from user profile
 */
export function createEmptyPreferences(location: string | null): ExtractedPreferences {
  return {
    livingSpace: null,
    activityLevel: null,
    hasChildren: null,
    childAge: null,
    hasOtherPets: null,
    otherPetTypes: null,
    experienceLevel: null,
    budget: null,
    breedPreference: null,
    breedStrict: null,
    location: location ?? null,
    additionalContext: null,
  };
}

/**
 * Create initial preferences from user profile
 * If user has saved preferences, returns those (for confirmation flow)
 * Otherwise returns empty preferences with location pre-filled
 */
export function createInitialPreferences(user: UserWithPreferences | null): ExtractedPreferences {
  if (user?.savedPreferences) {
    return user.savedPreferences;
  }
  return createEmptyPreferences(user?.location ?? null);
}

/**
 * Format saved preferences into a human-readable summary
 */
export function formatPreferencesSummary(prefs: ExtractedPreferences): string {
  const parts: string[] = [];

  if (prefs.livingSpace) {
    const spaceMap: Record<string, string> = {
      apartment: 'apartment',
      house: 'house',
      house_with_yard: 'house with yard',
    };
    parts.push(`Living in a ${spaceMap[prefs.livingSpace]}`);
  }

  if (prefs.activityLevel) {
    parts.push(`${prefs.activityLevel} activity lifestyle`);
  }

  if (prefs.hasChildren === true) {
    parts.push(prefs.childAge ? `${prefs.childAge}-year-old child` : 'has children');
  } else if (prefs.hasChildren === false) {
    parts.push('no children');
  }

  if (prefs.hasOtherPets === true) {
    parts.push(prefs.otherPetTypes?.length ? `has ${prefs.otherPetTypes.join(', ')}` : 'has other pets');
  } else if (prefs.hasOtherPets === false) {
    parts.push('no other pets');
  }

  if (prefs.experienceLevel) {
    const expMap: Record<string, string> = {
      first_time: 'first-time dog owner',
      some_experience: 'some dog experience',
      experienced: 'experienced dog owner',
    };
    parts.push(expMap[prefs.experienceLevel]);
  }

  if (prefs.budget) {
    const budgetMap: Record<string, string> = {
      low: 'budget under $200',
      medium: 'budget $200-500',
      high: 'budget over $500',
    };
    parts.push(budgetMap[prefs.budget]);
  }

  if (prefs.breedPreference?.length) {
    parts.push(`interested in ${prefs.breedPreference.join(', ')}`);
  }

  if (prefs.location) {
    parts.push(`in ${prefs.location}`);
  }

  return parts.join(', ');
}

/**
 * Generate the welcome message for returning users
 */
export function generateReturningUserMessage(
  prefs: ExtractedPreferences,
  updatedAt: Date
): string {
  const summary = formatPreferencesSummary(prefs);
  const timeAgo = getTimeAgo(updatedAt);

  return `Welcome back! Last time (${timeAgo}) you were looking for a puppy with these preferences:\n\n` +
    `${summary}\n\n` +
    `Should I search with these same preferences, or would you like to update anything?`;
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)} weeks ago`;
  return `${Math.floor(seconds / 2592000)} months ago`;
}

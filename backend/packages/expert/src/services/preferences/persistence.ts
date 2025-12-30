import {prisma} from '@puppy-store/shared';
import type {ExtractedPreferences} from './types';

/**
 * Save user preferences to database
 */
export async function saveUserPreferences(
  userId: string,
  preferences: ExtractedPreferences
): Promise<void> {
  await prisma.user.update({
    where: {id: userId},
    data: {
      savedPreferences: preferences as object,
      preferencesUpdatedAt: new Date(),
      ...(preferences.location ? {location: preferences.location} : {}),
    },
  });
}

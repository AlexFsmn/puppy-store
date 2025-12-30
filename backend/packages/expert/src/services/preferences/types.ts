import {z} from 'zod';

/**
 * Schema for extracted preferences from user input
 */
export const PreferencesSchema = z.object({
  livingSpace: z.enum(['apartment', 'house', 'house_with_yard']).nullable(),
  activityLevel: z.enum(['low', 'medium', 'high']).nullable(),
  hasChildren: z.boolean().nullable(),
  childAge: z.number().nullable(),
  hasOtherPets: z.boolean().nullable(),
  otherPetTypes: z.array(z.string()).nullable(),
  experienceLevel: z.enum(['first_time', 'some_experience', 'experienced']).nullable(),
  budget: z.enum(['low', 'medium', 'high']).nullable(),
  breedPreference: z.array(z.string()).nullable(),
  breedStrict: z.boolean().nullable(), // true = only show this breed, false = prefer but show others too
  location: z.string().nullable(),
  additionalContext: z.string().nullable(),
});

export type ExtractedPreferences = z.infer<typeof PreferencesSchema>;

/**
 * User profile with saved preferences
 */
export interface UserWithPreferences {
  id: string;
  location: string | null;
  savedPreferences: ExtractedPreferences | null;
  preferencesUpdatedAt: Date | null;
}

/**
 * Result from adoption flow
 */
export interface AdoptionResult {
  response: string;
  preferences: ExtractedPreferences;
  hasRecommendations: boolean;
  recommendations?: {
    recommendations: Array<{
      puppy: {id: string; name: string; description: string};
      matchScore: number;
      reasons: string[];
    }>;
    explanation: string;
  };
}

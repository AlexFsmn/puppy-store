import {z} from 'zod';
import {StructuredTool} from '@langchain/core/tools';
import {loggers} from '@puppy-store/shared';
import type {ExtractedPreferences} from '../../preferences';
import {saveUserPreferences, getMissingFields} from '../../preferences';

// Schema for updating preferences
export const updatePrefsSchema = z.object({
  livingSpace: z.enum(['apartment', 'house', 'house_with_yard']).optional(),
  activityLevel: z.enum(['low', 'medium', 'high']).optional(),
  hasChildren: z.boolean().optional(),
  childAge: z.number().optional(),
  hasOtherPets: z.boolean().optional(),
  otherPetTypes: z.array(z.string()).optional(),
  experienceLevel: z.enum(['first_time', 'some_experience', 'experienced']).optional(),
  budget: z.enum(['low', 'medium', 'high']).optional(),
  breedPreference: z.array(z.string()).optional(),
  location: z.string().optional(),
  additionalContext: z.string().optional(),
});

/**
 * Tool for updating preferences during adoption
 */
// @ts-ignore
export class UpdatePreferencesTool extends StructuredTool {
  name = 'updateUserPreferences';
  description = 'Update user preferences based on information explicitly stated by the user. Only include fields they mentioned.';
  schema = updatePrefsSchema;

  private currentPrefs: ExtractedPreferences;
  private userId: string | null;
  public updatedPrefs: ExtractedPreferences | null = null;

  constructor(currentPrefs: ExtractedPreferences, userId: string | null) {
    super();
    this.currentPrefs = currentPrefs;
    this.userId = userId;
  }

  async _call(input: z.infer<typeof updatePrefsSchema>): Promise<string> {
    const invalidStrings = ['unknown', 'none', 'n/a', 'not specified', ''];
    const isValidString = (val: string | undefined): val is string =>
      val !== undefined && !invalidStrings.includes(val.toLowerCase().trim());

    // Merge with current preferences
    this.updatedPrefs = {
      livingSpace: input.livingSpace ?? this.currentPrefs.livingSpace,
      activityLevel: input.activityLevel ?? this.currentPrefs.activityLevel,
      hasChildren: input.hasChildren !== undefined ? input.hasChildren : this.currentPrefs.hasChildren,
      childAge: input.childAge ?? this.currentPrefs.childAge,
      hasOtherPets: input.hasOtherPets !== undefined ? input.hasOtherPets : this.currentPrefs.hasOtherPets,
      otherPetTypes: input.otherPetTypes ?? this.currentPrefs.otherPetTypes,
      experienceLevel: input.experienceLevel ?? this.currentPrefs.experienceLevel,
      budget: input.budget ?? this.currentPrefs.budget,
      breedPreference: input.breedPreference ?? this.currentPrefs.breedPreference,
      breedStrict: this.currentPrefs.breedStrict,
      location: isValidString(input.location) ? input.location : this.currentPrefs.location,
      additionalContext: isValidString(input.additionalContext) ? input.additionalContext : this.currentPrefs.additionalContext,
    };

    // Save to database if we have a user ID
    if (this.userId) {
      try {
        await saveUserPreferences(this.userId, this.updatedPrefs);
      } catch (err) {
        loggers.adoption.error({err, userId: this.userId}, 'Failed to save preferences');
      }
    }

    const missing = getMissingFields(this.updatedPrefs);
    if (missing.length === 0) {
      return 'All required preferences collected. Ready to generate recommendations.';
    }
    return `Preferences updated. Still need: ${missing.join(', ')}`;
  }
}

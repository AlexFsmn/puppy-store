import {z} from 'zod';
import {StructuredTool} from '@langchain/core/tools';
import {loggers} from '@puppy-store/shared';
import type {ExtractedPreferences} from '../../preferences';
import {saveUserPreferences} from '../../preferences';

// Schema for setting breed strictness
export const setBreedStrictnessSchema = z.object({
  strict: z.boolean().describe('true = only show this breed, false = prefer this breed but include others'),
});

/**
 * Tool for setting whether breed preference is strict or flexible
 */
// @ts-ignore
export class SetBreedStrictnessTool extends StructuredTool {
  name = 'setBreedStrictness';
  description = 'Set whether to ONLY show the preferred breed or include other breeds too. Call after the user answers the breed strictness question.';
  schema = setBreedStrictnessSchema;

  private currentPrefs: ExtractedPreferences;
  private userId: string | null;
  public updatedPrefs: ExtractedPreferences | null = null;

  constructor(currentPrefs: ExtractedPreferences, userId: string | null = null) {
    super();
    this.currentPrefs = currentPrefs;
    this.userId = userId;
  }

  async _call(input: z.infer<typeof setBreedStrictnessSchema>): Promise<string> {
    this.updatedPrefs = {
      ...this.currentPrefs,
      breedStrict: input.strict,
    };

    // Save to database if we have a user ID
    if (this.userId) {
      try {
        await saveUserPreferences(this.userId, this.updatedPrefs);
        loggers.adoption.debug({userId: this.userId}, 'Breed strictness saved');
      } catch (err) {
        loggers.adoption.error({err, userId: this.userId}, 'Failed to save breed strictness');
      }
    }

    loggers.adoption.debug({strict: input.strict, breeds: this.currentPrefs.breedPreference}, 'SetBreedStrictness');

    if (input.strict) {
      return `Breed preference set to STRICT - will only show ${this.currentPrefs.breedPreference?.join(', ')} puppies. Ready to generate recommendations.`;
    } else {
      return `Breed preference set to FLEXIBLE - will prefer ${this.currentPrefs.breedPreference?.join(', ')} but also show other great matches. Ready to generate recommendations.`;
    }
  }
}

import {z} from 'zod';
import {StructuredTool} from '@langchain/core/tools';
import {loggers} from '@puppy-store/shared';
import type {RecommendationResponse} from '@puppy-store/shared';
import type {ExtractedPreferences} from '../../preferences';
import {saveUserPreferences} from '../../preferences';
import {scorePuppies} from '../../scoringService';
import {selectAndExplain} from '../../selectionService';

// Schema for regenerating recommendations
export const regenerateRecsSchema = z.object({
  reason: z.string().describe('Brief reason why user wants new recommendations'),
  keepBreedStrict: z.boolean().describe('true if user wants ONLY their preferred breed, false if they want to see other breeds too'),
  excludePrevious: z.boolean().describe('true if user wants to see DIFFERENT puppies than before, false to include previously shown puppies'),
});

/**
 * Tool for regenerating recommendations with different settings
 */
// @ts-ignore
export class RegenerateRecommendationsTool extends StructuredTool {
  name = 'regenerateRecommendations';
  description = `Regenerate puppy recommendations when the user wants different results.
Call this when the user:
- Wants to see other/different puppies
- Wants to broaden their search
- Is not satisfied with current recommendations
- Wants to remove breed restrictions`;
  schema = regenerateRecsSchema;

  private prefs: ExtractedPreferences;
  private userId: string | null;
  private previousPuppyIds: string[];
  public result: {preferences: ExtractedPreferences; recommendations: RecommendationResponse} | null = null;

  constructor(prefs: ExtractedPreferences, userId: string | null, previousPuppyIds: string[] = []) {
    super();
    this.prefs = prefs;
    this.userId = userId;
    this.previousPuppyIds = previousPuppyIds;
  }

  async _call(input: z.infer<typeof regenerateRecsSchema>): Promise<string> {
    const updatedPrefs = {
      ...this.prefs,
      breedStrict: input.keepBreedStrict,
    };

    if (this.userId) {
      try {
        await saveUserPreferences(this.userId, updatedPrefs);
      } catch (err) {
        loggers.adoption.error({err, userId: this.userId}, 'Failed to save preferences');
      }
    }

    // Get more candidates to allow for exclusion
    const limit = input.excludePrevious && this.previousPuppyIds.length > 0 ? 20 : 10;
    let scoredPuppies = await scorePuppies(updatedPrefs, limit);

    // Exclude previously shown puppies if requested
    if (input.excludePrevious && this.previousPuppyIds.length > 0) {
      scoredPuppies = scoredPuppies.filter(p => !this.previousPuppyIds.includes(p.puppy.id));
    }

    const recommendations = await selectAndExplain(scoredPuppies.slice(0, 10), updatedPrefs);

    this.result = {preferences: updatedPrefs, recommendations};

    const matchList = recommendations.recommendations
      .map((r, i) => `${i + 1}. ${r.puppy.name} - ${r.reasons[0]}`)
      .join('\n');

    return `Generated new recommendations:\n${matchList}`;
  }
}

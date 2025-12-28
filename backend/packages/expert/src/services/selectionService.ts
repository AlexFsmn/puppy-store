import {createLLM} from '../llm';
import type {ExtractedPreferences} from './adoptionAgent';
import type {ScoredPuppy} from './scoringService';
import type {RecommendationResponse, PuppySummary} from '@puppy-store/shared';
import {loggers} from '@puppy-store/shared';

const SELECTION_PROMPT = `You are a puppy adoption expert making final recommendations.

USER CONTEXT:
{userContext}

CANDIDATE PUPPIES (pre-scored by compatibility):
{candidates}

Your task:
1. Review the top candidates and select the BEST 3 for this specific user
2. You may skip high-scoring puppies if something in the user context makes them a poor fit
3. Provide personalized reasons that reference the user's specific situation

Return a JSON response:
{{
  "selections": [
    {{
      "puppyId": "id",
      "puppyName": "name",
      "matchScore": 85,
      "reasons": ["Specific reason referencing user context", "Another reason"]
    }}
  ],
  "explanation": "Brief overall explanation of your recommendations"
}}

IMPORTANT:
- Reference the user's specific situation in reasons (e.g., "great for your 6-year-old", "won't mind your long shifts")
- If skipping a high-scorer, briefly mention why in the explanation
- Keep reasons concise but personalized
- Return exactly 3 puppies if available, fewer only if not enough suitable matches`;

/**
 * Use LLM to make final selection and write personalized explanations
 */
export async function selectAndExplain(
  candidates: ScoredPuppy[],
  preferences: ExtractedPreferences
): Promise<RecommendationResponse> {
  if (candidates.length === 0) {
    return {
      recommendations: [],
      explanation: "I couldn't find any puppies matching your requirements. Try adjusting your preferences.",
    };
  }

  const llm = createLLM({temperature: 0.5});

  // Build user context string
  const userContext = buildUserContext(preferences);

  // Format candidates for the prompt
  const candidatesStr = candidates
    .map(
      (c, i) =>
        `${i + 1}. ${c.puppy.name} (Score: ${c.score}/100)
   - Breed: ${c.puppy.breed}, Age: ${c.puppy.age} months
   - Energy: ${c.puppy.energyLevel}, Temperament: ${c.puppy.temperament}
   - Good with kids: ${c.puppy.goodWithKids}, Good with pets: ${c.puppy.goodWithPets}
   - Location: ${c.puppy.location}
   - Description: ${c.puppy.description}`
    )
    .join('\n\n');

  const prompt = SELECTION_PROMPT.replace('{userContext}', userContext).replace('{candidates}', candidatesStr);

  const response = await llm.invoke(prompt);
  const content = typeof response.content === 'string' ? response.content : '';

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      recommendations: (parsed.selections || []).map(
        (sel: {puppyId: string; puppyName: string; matchScore: number; reasons: string[]}) => {
          // Find candidate by ID or by name (LLM might return wrong ID format)
          const candidate = candidates.find(c => c.puppy.id === sel.puppyId) ||
            candidates.find(c => c.puppy.name.toLowerCase() === sel.puppyName.toLowerCase());

          if (!candidate) {
            return null; // Skip if we can't find the puppy
          }

          return {
            puppy: {
              id: candidate.puppy.id, // Always use real ID from database
              name: candidate.puppy.name,
              description: candidate.puppy.description,
            } as PuppySummary,
            matchScore: sel.matchScore,
            reasons: sel.reasons,
          };
        }
      ).filter(Boolean), // Remove nulls
      explanation: parsed.explanation || '',
    };
  } catch (err) {
    loggers.selection.error({err, rawOutput: content}, 'Failed to parse selection response');

    // Fallback: return top 3 scored puppies with generic reasons
    return {
      recommendations: candidates.slice(0, 3).map(c => ({
        puppy: {
          id: c.puppy.id,
          name: c.puppy.name,
          description: c.puppy.description,
        } as PuppySummary,
        matchScore: c.score,
        reasons: [`Match score: ${c.score}`, `Energy level: ${c.puppy.energyLevel}`],
      })),
      explanation: 'Here are the top matches based on your preferences.',
    };
  }
}

/**
 * Build a human-readable context string from preferences
 */
function buildUserContext(preferences: ExtractedPreferences): string {
  const parts: string[] = [];

  if (preferences.livingSpace) {
    const spaceMap: Record<string, string> = {
      apartment: 'Lives in an apartment',
      house: 'Lives in a house',
      house_with_yard: 'Lives in a house with a yard',
    };
    parts.push(spaceMap[preferences.livingSpace] || preferences.livingSpace);
  }

  if (preferences.activityLevel) {
    const activityMap: Record<string, string> = {
      low: 'Has a low-activity lifestyle (may be tired after work, limited exercise time)',
      medium: 'Has a moderate activity level',
      high: 'Very active lifestyle (enjoys exercise, outdoor activities)',
    };
    parts.push(activityMap[preferences.activityLevel] || preferences.activityLevel);
  }

  if (preferences.hasChildren === true) {
    if (preferences.childAge) {
      parts.push(`Has a ${preferences.childAge}-year-old child`);
    } else {
      parts.push('Has children');
    }
  } else if (preferences.hasChildren === false) {
    parts.push('No children');
  }

  if (preferences.hasOtherPets === true) {
    if (preferences.otherPetTypes?.length) {
      parts.push(`Has other pets: ${preferences.otherPetTypes.join(', ')}`);
    } else {
      parts.push('Has other pets');
    }
  } else if (preferences.hasOtherPets === false) {
    parts.push('No other pets');
  }

  if (preferences.experienceLevel) {
    const expMap: Record<string, string> = {
      first_time: 'First-time dog owner',
      some_experience: 'Has some experience with dogs',
      experienced: 'Experienced dog owner',
    };
    parts.push(expMap[preferences.experienceLevel] || preferences.experienceLevel);
  }

  if (preferences.location) {
    parts.push(`Located in ${preferences.location}`);
  }

  if (preferences.additionalContext) {
    parts.push(`Additional context: ${preferences.additionalContext}`);
  }

  return parts.join('\n');
}

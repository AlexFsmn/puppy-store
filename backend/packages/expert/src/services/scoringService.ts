import {prisma} from '@puppy-store/shared';
import type {Puppy} from '@puppy-store/shared';
import type {ExtractedPreferences} from './preferences';

export interface ScoredPuppy {
  puppy: Puppy;
  score: number;
  scoreBreakdown: {
    energyMatch: number;
    kidsMatch: number;
    petsMatch: number;
    experienceMatch: number;
    budgetMatch: number;
    breedMatch: number;
    locationMatch: number;
  };
}

/**
 * Score and rank puppies based on user preferences using database-level filtering and scoring.
 * This is the scalable approach - filters happen in DB, not in application code.
 */
export async function scorePuppies(
  preferences: ExtractedPreferences,
  limit = 10
): Promise<ScoredPuppy[]> {
  // Build hard filters - these are non-negotiable requirements
  const whereClause: Record<string, unknown> = {
    status: 'AVAILABLE',
  };

  // Hard filter: if user has children, ONLY show kid-friendly puppies
  if (preferences.hasChildren === true) {
    whereClause.goodWithKids = true;
  }

  // Hard filter: if user has other pets, ONLY show pet-friendly puppies
  if (preferences.hasOtherPets === true) {
    whereClause.goodWithPets = true;
  }

  // Hard filter: if breedStrict is true, ONLY show puppies of the preferred breed(s)
  if (preferences.breedStrict === true && preferences.breedPreference?.length) {
    whereClause.breed = {
      contains: preferences.breedPreference[0], // Use first breed preference
      mode: 'insensitive',
    };
  }

  // Hard filter: ONLY show puppies in the user's location
  if (preferences.location) {
    whereClause.location = {
      contains: preferences.location,
      mode: 'insensitive',
    };
  }

  // Fetch candidates that pass hard filters
  // In production with 1M+ records, you'd use raw SQL with scoring in the query
  // For now, we fetch filtered candidates and score in JS
  const candidates = await prisma.puppy.findMany({
    where: whereClause,
    take: limit * 3, // Fetch more than needed to allow for scoring rerank
  });

  // Location is a hard requirement - if no puppies in user's city, return empty
  // Don't fall back to other cities
  let finalCandidates = candidates;

  // If breed filter was too strict and returned 0 results, fall back to non-strict
  // but keep location filter - user must adopt locally
  if (finalCandidates.length === 0 && preferences.breedStrict === true && preferences.breedPreference?.length) {
    const withoutBreed = {...whereClause};
    delete withoutBreed.breed;
    // Keep location filter - don't remove it

    finalCandidates = await prisma.puppy.findMany({
      where: withoutBreed,
      take: limit * 3,
    });
  }

  // Score each candidate
  const scored = finalCandidates.map(puppy => scorePuppy(puppy, preferences));

  // Sort by score descending and return top N
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Calculate match score for a single puppy
 * Weights are tuned based on importance:
 * - Safety factors (kids, pets): highest weight
 * - Lifestyle match (energy): high weight
 * - Experience match: medium weight
 * - Location: bonus points
 */
function scorePuppy(puppy: Puppy, preferences: ExtractedPreferences): ScoredPuppy {
  const breakdown = {
    energyMatch: 0,
    kidsMatch: 0,
    petsMatch: 0,
    experienceMatch: 0,
    budgetMatch: 0,
    breedMatch: 0,
    locationMatch: 0,
  };

  // Energy level matching (max 30 points)
  if (preferences.activityLevel) {
    const energyMap: Record<string, number> = {low: 1, medium: 2, high: 3};
    const userEnergy = energyMap[preferences.activityLevel] || 2;
    const puppyEnergy = energyMap[puppy.energyLevel] || 2;
    const diff = Math.abs(userEnergy - puppyEnergy);

    if (diff === 0) breakdown.energyMatch = 30;
    else if (diff === 1) breakdown.energyMatch = 15;
    else breakdown.energyMatch = 0;
  }

  // Kids compatibility (max 25 points)
  if (preferences.hasChildren !== null) {
    if (preferences.hasChildren && puppy.goodWithKids) {
      breakdown.kidsMatch = 25;
    } else if (!preferences.hasChildren) {
      breakdown.kidsMatch = 25; // No requirement, full points
    }
  }

  // Pet compatibility (max 20 points)
  if (preferences.hasOtherPets !== null) {
    if (preferences.hasOtherPets && puppy.goodWithPets) {
      breakdown.petsMatch = 20;
    } else if (!preferences.hasOtherPets) {
      breakdown.petsMatch = 20; // No requirement, full points
    }
  }

  // Experience matching (max 15 points)
  if (preferences.experienceLevel) {
    const puppyDifficulty = estimatePuppyDifficulty(puppy);

    if (preferences.experienceLevel === 'first_time') {
      // First-timers need easy puppies
      if (puppyDifficulty === 'easy') breakdown.experienceMatch = 15;
      else if (puppyDifficulty === 'medium') breakdown.experienceMatch = 5;
      else breakdown.experienceMatch = 0;
    } else if (preferences.experienceLevel === 'some_experience') {
      // Some experience can handle most
      if (puppyDifficulty === 'easy') breakdown.experienceMatch = 15;
      else if (puppyDifficulty === 'medium') breakdown.experienceMatch = 15;
      else breakdown.experienceMatch = 10;
    } else {
      // Experienced can handle anything
      breakdown.experienceMatch = 15;
    }
  }

  // Budget matching (max 10 points - bonus)
  if (preferences.budget && puppy.adoptionFee !== null) {
    const fee = puppy.adoptionFee;
    const budgetRanges: Record<string, [number, number]> = {
      low: [0, 200],
      medium: [0, 500],
      high: [0, Infinity],
    };
    const [, max] = budgetRanges[preferences.budget];
    if (fee <= max) {
      breakdown.budgetMatch = 10;
    }
  }

  // Breed preference matching (max 15 points - bonus)
  if (preferences.breedPreference?.length && puppy.breed) {
    const puppyBreed = puppy.breed.toLowerCase();
    const matchesBreed = preferences.breedPreference.some(pref =>
      puppyBreed.includes(pref.toLowerCase()) || pref.toLowerCase().includes(puppyBreed)
    );
    if (matchesBreed) {
      breakdown.breedMatch = 15;
    }
  }

  // Location match - puppies should already be filtered by location
  // This scoring is just for display/breakdown purposes
  if (preferences.location && puppy.location) {
    const userLoc = preferences.location.toLowerCase();
    const puppyLoc = puppy.location.toLowerCase();

    if (puppyLoc.includes(userLoc) || userLoc.includes(puppyLoc)) {
      breakdown.locationMatch = 10;
    }
  }

  const totalScore =
    breakdown.energyMatch +
    breakdown.kidsMatch +
    breakdown.petsMatch +
    breakdown.experienceMatch +
    breakdown.budgetMatch +
    breakdown.breedMatch +
    breakdown.locationMatch;

  return {
    puppy,
    score: totalScore,
    scoreBreakdown: breakdown,
  };
}

/**
 * Estimate how difficult a puppy is to care for based on attributes
 */
function estimatePuppyDifficulty(puppy: Puppy): 'easy' | 'medium' | 'hard' {
  let difficultyScore = 0;

  // High energy = harder
  if (puppy.energyLevel === 'high') difficultyScore += 2;
  else if (puppy.energyLevel === 'medium') difficultyScore += 1;

  // Young puppies need more work
  if (puppy.age < 6) difficultyScore += 2;
  else if (puppy.age < 12) difficultyScore += 1;

  // Temperament clues
  const temperament = puppy.temperament.toLowerCase();
  if (temperament.includes('stubborn') || temperament.includes('independent')) {
    difficultyScore += 1;
  }
  if (temperament.includes('calm') || temperament.includes('gentle')) {
    difficultyScore -= 1;
  }

  if (difficultyScore <= 1) return 'easy';
  if (difficultyScore <= 3) return 'medium';
  return 'hard';
}

/**
 * Raw SQL version for production scale (1M+ puppies)
 * Uses database-level scoring for efficiency
 */
export async function scorePuppiesRaw(
  preferences: ExtractedPreferences,
  limit = 10
): Promise<ScoredPuppy[]> {
  const energyValue = preferences.activityLevel === 'low' ? 1 : preferences.activityLevel === 'high' ? 3 : 2;

  const results = await prisma.$queryRaw<
    Array<Puppy & {match_score: number}>
  >`
    SELECT *,
      (
        CASE
          WHEN energy_level = ${preferences.activityLevel} THEN 30
          WHEN ABS(
            CASE energy_level WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 END -
            ${energyValue}
          ) = 1 THEN 15
          ELSE 0
        END
      ) +
      (CASE WHEN ${preferences.hasChildren} = false OR good_with_kids = true THEN 25 ELSE 0 END) +
      (CASE WHEN ${preferences.hasOtherPets} = false OR good_with_pets = true THEN 20 ELSE 0 END) +
      10 -- Location match points (already filtered by location below)
      AS match_score
    FROM "Puppy"
    WHERE status = 'AVAILABLE'
      AND (${preferences.hasChildren} = false OR good_with_kids = true)
      AND (${preferences.hasOtherPets} = false OR good_with_pets = true)
      AND (${preferences.location}::text IS NULL OR location ILIKE ${'%' + (preferences.location || '') + '%'})
    ORDER BY match_score DESC
    LIMIT ${limit}
  `;

  return results.map(r => ({
    puppy: r,
    score: Number(r.match_score),
    scoreBreakdown: {
      energyMatch: 0,
      kidsMatch: 0,
      petsMatch: 0,
      experienceMatch: 0,
      budgetMatch: 0,
      breedMatch: 0,
      locationMatch: 0,
    },
  }));
}

import {StringOutputParser} from '@langchain/core/output_parsers';
import {createLLM} from '../llm';
import {descriptionGeneratorPrompt} from '../prompts';
import {prisma, RedisCacheStore, redisTTL} from '@puppy-store/shared';
import type {GeneratedDescription, Puppy} from '@puppy-store/shared';

// Redis cache for generated descriptions
const descriptionCache = new RedisCacheStore<GeneratedDescription>('cache:description', redisTTL.descriptionCache);

/**
 * Generate a description for a puppy
 * Results are cached to avoid regenerating on every request
 */
export async function generateDescription(puppyId: string): Promise<GeneratedDescription | null> {
  // Check cache first
  const cached = await descriptionCache.get(puppyId);
  if (cached) {
    return cached;
  }

  // Fetch puppy data
  const puppy = await prisma.puppy.findUnique({
    where: {id: puppyId},
  });

  if (!puppy) {
    return null;
  }

  // Generate description
  const description = await generateDescriptionForPuppy(puppy);

  const result: GeneratedDescription = {
    description,
    generatedAt: new Date(),
    puppyId,
  };

  // Cache the result
  await descriptionCache.set(puppyId, result);

  return result;
}

/**
 * Generate description using LLM
 */
async function generateDescriptionForPuppy(puppy: Puppy): Promise<string> {
  const llm = createLLM({temperature: 0.8}); // Higher temp for more creative descriptions
  const chain = descriptionGeneratorPrompt.pipe(llm).pipe(new StringOutputParser());

  const description = await chain.invoke({
    name: puppy.name,
    breed: puppy.breed,
    age: puppy.age.toString(),
    gender: puppy.gender,
    weight: puppy.weight.toString(),
    energyLevel: puppy.energyLevel,
    temperament: puppy.temperament,
    goodWithKids: puppy.goodWithKids ? 'Yes' : 'No',
    goodWithPets: puppy.goodWithPets ? 'Yes' : 'No',
  });

  return description;
}

/**
 * Invalidate cache for a specific puppy
 * Call this when puppy data is updated
 */
export async function invalidateDescriptionCache(puppyId: string): Promise<void> {
  await descriptionCache.delete(puppyId);
}

/**
 * Clear entire description cache
 */
export async function clearDescriptionCache(): Promise<void> {
  await descriptionCache.clear();
}

/**
 * Generate descriptions for all puppies (batch operation)
 * Useful for initial seeding
 */
export async function generateAllDescriptions(): Promise<number> {
  const puppies = await prisma.puppy.findMany({
    where: {status: 'AVAILABLE'},
  });

  let generated = 0;

  for (const puppy of puppies) {
    const exists = await descriptionCache.has(puppy.id);
    if (!exists) {
      await generateDescription(puppy.id);
      generated++;
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return generated;
}

import {z} from 'zod';
import {StructuredTool} from '@langchain/core/tools';
import {prisma} from '@puppy-store/shared';

// Schema for checking breed availability
export const checkBreedSchema = z.object({
  breed: z.string().describe('The breed name to check availability for'),
});

/**
 * Tool for checking breed availability in the database
 */
// @ts-ignore
export class CheckBreedAvailabilityTool extends StructuredTool {
  name = 'checkBreedAvailability';
  description = 'Check how many puppies of a specific breed are available. Call this when the user mentions a breed preference.';
  schema = checkBreedSchema;

  async _call(input: z.infer<typeof checkBreedSchema>): Promise<string> {
    const breed = input.breed.toLowerCase();

    const count = await prisma.puppy.count({
      where: {
        status: 'AVAILABLE',
        breed: {
          contains: breed,
          mode: 'insensitive',
        },
      },
    });

    if (count === 0) {
      return `No ${input.breed} puppies are currently available. The user should be informed and asked if they want to see similar breeds or all available puppies.`;
    } else if (count === 1) {
      return `There is 1 ${input.breed} available! Ask the user if they want to see ONLY ${input.breed}s, or if they'd like to see a mix including other breeds.`;
    } else {
      return `There are ${count} ${input.breed} puppies available! Ask the user if they want to see ONLY ${input.breed}s, or if they'd like to see a mix including other breeds.`;
    }
  }
}

import {Router} from 'express';
import {loggers} from '@puppy-store/shared';
import {
  generateDescription,
  generateAllDescriptions,
  clearDescriptionCache,
} from '../services/descriptionService';

const router = Router();

/**
 * GET /descriptions/:puppyId
 * Get or generate a description for a specific puppy
 */
router.get('/:puppyId', async (req, res) => {
  try {
    const {puppyId} = req.params;

    if (!puppyId) {
      res.status(400).json({error: 'Puppy ID is required'});
      return;
    }

    const result = await generateDescription(puppyId);

    if (!result) {
      res.status(404).json({error: 'Puppy not found'});
      return;
    }

    res.json(result);
  } catch (error) {
    loggers.http.error({err: error, endpoint: '/descriptions/:puppyId'}, 'Error generating description');
    res.status(500).json({error: 'Failed to generate description'});
  }
});

/**
 * POST /descriptions/generate-all
 * Generate descriptions for all available puppies (admin operation)
 */
router.post('/generate-all', async (req, res) => {
  try {
    const count = await generateAllDescriptions();
    res.json({
      message: `Generated ${count} descriptions`,
      count,
    });
  } catch (error) {
    loggers.http.error({err: error, endpoint: '/descriptions/generate-all'}, 'Error generating all descriptions');
    res.status(500).json({error: 'Failed to generate descriptions'});
  }
});

/**
 * POST /descriptions/clear-cache
 * Clear the description cache (admin operation)
 */
router.post('/clear-cache', async (_req, res) => {
  try {
    clearDescriptionCache();
    res.json({message: 'Cache cleared'});
  } catch (error) {
    loggers.http.error({err: error, endpoint: '/descriptions/clear-cache'}, 'Error clearing cache');
    res.status(500).json({error: 'Failed to clear cache'});
  }
});

export default router;

import {Router} from 'express';
import {generateDescription} from '../services/descriptionService';
import {handleExpertError} from '../services/errors';

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
    handleExpertError(error, res, 'Failed to generate description');
  }
});

export default router;

import {Router} from 'express';
import {loggers} from '@puppy-store/shared';
import {askExpert} from '../services/expertService';
import {sanitizeInput} from '../prompts';

const router = Router();

/**
 * POST /ask
 * Ask the puppy expert a question
 */
router.post('/ask', async (req, res) => {
  try {
    const {question} = req.body;

    if (!question || typeof question !== 'string') {
      res.status(400).json({error: 'Question is required'});
      return;
    }

    const sanitized = sanitizeInput(question);
    if (sanitized.length < 3) {
      res.status(400).json({error: 'Question is too short'});
      return;
    }

    const response = await askExpert(sanitized);
    res.json(response);
  } catch (error) {
    loggers.http.error({err: error, endpoint: '/ask'}, 'Error processing expert question');
    res.status(500).json({error: 'Failed to process question'});
  }
});

export default router;

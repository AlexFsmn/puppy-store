import {Router} from 'express';
import {
  submitThumbsFeedback,
  trackPuppySelection,
  trackApplicationSubmission,
  getSessionRecommendations,
} from '../services/feedbackService';
import {captureException, loggers} from '@puppy-store/shared';

const router = Router();

/**
 * POST /feedback/thumbs
 * Submit thumbs up/down feedback for a recommendation session
 */
router.post('/thumbs', async (req, res) => {
  try {
    const {sessionId, isPositive, comment} = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({error: 'sessionId is required'});
      return;
    }

    if (typeof isPositive !== 'boolean') {
      res.status(400).json({error: 'isPositive must be a boolean'});
      return;
    }

    const result = await submitThumbsFeedback(sessionId, isPositive, comment);

    if (result.success) {
      res.json({
        success: true,
        message: `Feedback recorded: ${isPositive ? 'thumbs up' : 'thumbs down'}`,
        feedbackId: result.feedbackId,
      });
    } else {
      res.status(400).json({success: false, error: result.error});
    }
  } catch (err) {
    loggers.http.error({err, endpoint: '/feedback/thumbs'}, 'Failed to submit thumbs feedback');
    captureException(err instanceof Error ? err : new Error(String(err)), {
      service: 'feedback',
      extra: {endpoint: '/feedback/thumbs'},
    });
    res.status(500).json({error: 'Failed to submit feedback'});
  }
});

/**
 * POST /feedback/selection
 * Track when a user selects/views a specific puppy from recommendations
 */
router.post('/selection', async (req, res) => {
  try {
    const {sessionId, puppyId, puppyName} = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({error: 'sessionId is required'});
      return;
    }

    if (!puppyId || typeof puppyId !== 'string') {
      res.status(400).json({error: 'puppyId is required'});
      return;
    }

    if (!puppyName || typeof puppyName !== 'string') {
      res.status(400).json({error: 'puppyName is required'});
      return;
    }

    const result = await trackPuppySelection(sessionId, puppyId, puppyName);

    if (result.success) {
      res.json({
        success: true,
        message: `Selection tracked: ${puppyName}`,
        feedbackId: result.feedbackId,
      });
    } else {
      res.status(400).json({success: false, error: result.error});
    }
  } catch (err) {
    loggers.http.error({err, endpoint: '/feedback/selection'}, 'Failed to track puppy selection');
    captureException(err instanceof Error ? err : new Error(String(err)), {
      service: 'feedback',
      extra: {endpoint: '/feedback/selection'},
    });
    res.status(500).json({error: 'Failed to track selection'});
  }
});

/**
 * POST /feedback/application
 * Track when a user submits an application for a puppy
 * This is the strongest signal of recommendation success
 */
router.post('/application', async (req, res) => {
  try {
    const {sessionId, puppyId, puppyName, applicationId} = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({error: 'sessionId is required'});
      return;
    }

    if (!puppyId || typeof puppyId !== 'string') {
      res.status(400).json({error: 'puppyId is required'});
      return;
    }

    if (!puppyName || typeof puppyName !== 'string') {
      res.status(400).json({error: 'puppyName is required'});
      return;
    }

    if (!applicationId || typeof applicationId !== 'string') {
      res.status(400).json({error: 'applicationId is required'});
      return;
    }

    const result = await trackApplicationSubmission(sessionId, puppyId, puppyName, applicationId);

    if (result.success) {
      res.json({
        success: true,
        message: `Application tracked for ${puppyName}`,
        feedbackId: result.feedbackId,
      });
    } else {
      res.status(400).json({success: false, error: result.error});
    }
  } catch (err) {
    loggers.http.error({err, endpoint: '/feedback/application'}, 'Failed to track application');
    captureException(err instanceof Error ? err : new Error(String(err)), {
      service: 'feedback',
      extra: {endpoint: '/feedback/application'},
    });
    res.status(500).json({error: 'Failed to track application'});
  }
});

/**
 * GET /feedback/session/:sessionId/recommendations
 * Get the list of recommended puppy IDs for a session
 * Useful for the frontend to determine if a selected puppy was recommended
 */
router.get('/session/:sessionId/recommendations', (req, res) => {
  const {sessionId} = req.params;
  const recommendations = getSessionRecommendations(sessionId);

  if (!recommendations) {
    res.status(404).json({error: 'No recommendations found for this session'});
    return;
  }

  res.json({
    sessionId,
    recommendedPuppyIds: recommendations,
  });
});

export default router;

import {Router} from 'express';
import {
  submitThumbsFeedback,
  trackPuppySelection,
  trackApplicationSubmission,
} from '../services/feedbackService';
import {handleExpertError} from '../services/errors';

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
  } catch (error) {
    handleExpertError(error, res, 'Failed to submit feedback');
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
  } catch (error) {
    handleExpertError(error, res, 'Failed to track selection');
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
  } catch (error) {
    handleExpertError(error, res, 'Failed to track application');
  }
});

export default router;

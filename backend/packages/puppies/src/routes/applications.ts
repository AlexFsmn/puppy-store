import {Router} from 'express';
import {validate, validateQuery, paginationSchema} from '@puppy-store/shared';
import {requireAuth, AuthenticatedRequest} from '../middleware/auth';
import * as applicationService from '../services/applications';
import {
  createApplicationSchema,
  updateApplicationStatusSchema,
  handleApplicationError,
} from '../services/applications';

const router = Router();

// POST /applications - Submit application
router.post('/', requireAuth, validate(createApplicationSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const application = await applicationService.createApplication(req.user!.userId, req.body);
    res.status(201).json(application);
  } catch (error) {
    handleApplicationError(error, res, 'Failed to create application');
  }
});

// GET /applications - Get user's submitted applications
router.get('/', requireAuth, validateQuery(paginationSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await applicationService.listUserApplications(req.user!.userId, res.locals.query);
    res.json(result);
  } catch (error) {
    handleApplicationError(error, res, 'Failed to fetch applications');
  }
});

// GET /applications/received - Get applications for user's puppies
router.get('/received', requireAuth, validateQuery(paginationSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await applicationService.listReceivedApplications(req.user!.userId, res.locals.query);
    res.json(result);
  } catch (error) {
    handleApplicationError(error, res, 'Failed to fetch applications');
  }
});

// GET /applications/:id - Get single application
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const application = await applicationService.getApplicationById(req.params.id, req.user!.userId);
    res.json(application);
  } catch (error) {
    handleApplicationError(error, res, 'Failed to fetch application');
  }
});

// PATCH /applications/:id - Update application status (poster only)
router.patch('/:id', requireAuth, validate(updateApplicationStatusSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const updated = await applicationService.updateApplicationStatus(
      req.params.id,
      req.user!.userId,
      req.body.status
    );
    res.json(updated);
  } catch (error) {
    handleApplicationError(error, res, 'Failed to update application');
  }
});

export default router;

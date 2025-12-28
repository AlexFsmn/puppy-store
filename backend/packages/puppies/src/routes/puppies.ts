import {Router} from 'express';
import {validate, validateQuery, paginationSchema} from '@puppy-store/shared';
import {requireAuth, optionalAuth, AuthenticatedRequest} from '../middleware/auth';
import * as puppyService from '../services/puppies';
import {createPuppySchema, updatePuppySchema, handlePuppyError} from '../services/puppies';

const router = Router();

// GET /puppies - List available puppies (public)
router.get('/', optionalAuth, validateQuery(paginationSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await puppyService.listAvailablePuppies(res.locals.query);
    res.json(result);
  } catch (error) {
    handlePuppyError(error, res, 'Failed to fetch puppies');
  }
});

// GET /puppies/my - Get current user's postings
router.get('/my', requireAuth, validateQuery(paginationSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await puppyService.listUserPuppies(req.user!.userId, res.locals.query);
    res.json(result);
  } catch (error) {
    handlePuppyError(error, res, 'Failed to fetch puppies');
  }
});

// GET /puppies/:id - Get single puppy (public)
router.get('/:id', async (req, res) => {
  try {
    const puppy = await puppyService.getPuppyById(req.params.id);
    res.json(puppy);
  } catch (error) {
    handlePuppyError(error, res, 'Failed to fetch puppy');
  }
});

// POST /puppies - Create new puppy posting
router.post('/', requireAuth, validate(createPuppySchema), async (req: AuthenticatedRequest, res) => {
  try {
    const puppy = await puppyService.createPuppy(req.user!.userId, req.body);
    res.status(201).json(puppy);
  } catch (error) {
    handlePuppyError(error, res, 'Failed to create puppy');
  }
});

// PATCH /puppies/:id - Update puppy (owner only)
router.patch('/:id', requireAuth, validate(updatePuppySchema), async (req: AuthenticatedRequest, res) => {
  try {
    const updated = await puppyService.updatePuppy(req.params.id, req.user!.userId, req.body);
    res.json(updated);
  } catch (error) {
    handlePuppyError(error, res, 'Failed to update puppy');
  }
});

export default router;

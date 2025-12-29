import {Router} from 'express';
import {validate} from '@puppy-store/shared';
import * as authService from '../services/auth';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  validateSchema,
  handleAuthError,
} from '../services/auth';

const router = Router();

// POST /register
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const result = await authService.registerUser(req.body);
    res.status(201).json(result);
  } catch (error) {
    handleAuthError(error, res, 'Registration failed');
  }
});

// POST /login
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const result = await authService.loginUser(req.body);
    res.json(result);
  } catch (error) {
    handleAuthError(error, res, 'Login failed');
  }
});

// POST /refresh
router.post('/refresh', validate(refreshSchema), async (req, res) => {
  try {
    const result = await authService.refreshTokens(req.body.refreshToken);
    res.json(result);
  } catch (error) {
    handleAuthError(error, res, 'Invalid refresh token');
  }
});

// GET /me - Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({error: 'No token provided'});
      return;
    }

    const token = authHeader.substring(7);
    const user = await authService.getCurrentUser(token);
    res.json(user);
  } catch (error) {
    handleAuthError(error, res, 'Invalid token');
  }
});

// POST /validate - Validate token (for other services)
router.post('/validate', validate(validateSchema), (req, res) => {
  try {
    const result = authService.validateToken(req.body.token);
    res.json(result);
  } catch {
    res.json({valid: false});
  }
});

// DELETE /preferences - Clear user's saved adoption preferences
router.delete('/preferences', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({error: 'No token provided'});
      return;
    }

    const token = authHeader.substring(7);
    const result = await authService.clearUserPreferences(token);
    res.json(result);
  } catch (error) {
    handleAuthError(error, res, 'Failed to clear preferences');
  }
});

export default router;

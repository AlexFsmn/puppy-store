import {Router} from 'express';
import {
  getRecommendations,
  startRecommendationSession,
  processRecommendationMessage,
  type ExtractedPreferences,
  type RecommendationSession,
  type UserWithPreferences,
} from '../services/recommendationService';
import {captureException, prisma, loggers} from '@puppy-store/shared';

const router = Router();

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

async function getUserFromToken(authHeader: string | undefined): Promise<UserWithPreferences | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const validateRes = await fetch(`${AUTH_SERVICE_URL}/validate`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token}),
    });

    const validation = await validateRes.json() as {valid: boolean; userId?: string};
    if (!validation.valid || !validation.userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {id: validation.userId},
      select: {
        id: true,
        location: true,
        savedPreferences: true,
        preferencesUpdatedAt: true,
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      location: user.location,
      savedPreferences: user.savedPreferences as ExtractedPreferences | null,
      preferencesUpdatedAt: user.preferencesUpdatedAt,
    };
  } catch (err) {
    loggers.http.error({err}, 'Failed to validate token');
    return null;
  }
}

// In-memory session store (in production, use Redis or similar)
const sessions = new Map<string, RecommendationSession>();

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * POST /recommendations
 * Get puppy recommendations based on user preferences
 */
router.post('/', async (req, res) => {
  try {
    // Test endpoint: POST /recommendations?test_error=true to trigger a Sentry error
    if (req.query.test_error === 'true') {
      const testError = new Error('Test error for Sentry integration');
      captureException(testError, {service: 'recommendations', extra: {test: true, endpoint: '/recommendations'}});
      res.status(500).json({error: 'Test error sent to Sentry'});
      return;
    }

    const preferences: ExtractedPreferences = {
      livingSpace: req.body.livingSpace ?? null,
      activityLevel: req.body.activityLevel ?? null,
      hasChildren: req.body.hasChildren ?? null,
      childAge: req.body.childAge ?? null,
      hasOtherPets: req.body.hasOtherPets ?? null,
      otherPetTypes: req.body.otherPetTypes ?? null,
      experienceLevel: req.body.experienceLevel ?? null,
      budget: req.body.budget ?? null,
      breedPreference: req.body.breedPreference ?? null,
      breedStrict: req.body.breedStrict ?? null,
      location: req.body.location ?? null,
      additionalContext: req.body.additionalContext ?? null,
    };

    // Validate at least one preference is provided
    const hasPreferences = Object.values(preferences).some(v => v !== null);
    if (!hasPreferences) {
      res.status(400).json({
        error: 'At least one preference must be provided',
        validPreferences: [
          'livingSpace (apartment | house | house_with_yard)',
          'activityLevel (low | medium | high)',
          'hasChildren (boolean)',
          'hasOtherPets (boolean)',
          'experienceLevel (first_time | some_experience | experienced)',
          'location (string)',
        ],
      });
      return;
    }

    const response = await getRecommendations(preferences);
    res.json(response);
  } catch (error) {
    loggers.http.error({err: error, endpoint: '/recommendations'}, 'Error getting recommendations');
    res.status(500).json({error: 'Failed to get recommendations'});
  }
});

/**
 * POST /recommendations/session
 * Start a new recommendation chat session
 * Pass Authorization header to load user's saved preferences
 */
router.post('/session', async (req, res) => {
  try {
    const sessionId = generateSessionId();

    // Try to get user context from auth token
    const user = await getUserFromToken(req.headers.authorization);

    const {session, initialMessage} = startRecommendationSession(user);

    sessions.set(sessionId, session);

    // Generate welcome message - different for returning vs new users
    const welcomeMessage = initialMessage ||
      "Hi! I'm here to help you find the perfect puppy. Tell me a bit about yourself - what's your living situation like, and how active is your lifestyle?";

    res.json({
      sessionId,
      message: welcomeMessage,
      isComplete: false,
      isReturningUser: session.isReturningUser,
      savedPreferences: session.isReturningUser ? session.preferences : undefined,
    });
  } catch (error) {
    loggers.http.error({err: error, endpoint: '/recommendations/session'}, 'Error starting session');
    res.status(500).json({error: 'Failed to start recommendation session'});
  }
});

/**
 * POST /recommendations/session/:sessionId/message
 * Send a message in the recommendation chat
 */
router.post('/session/:sessionId/message', async (req, res) => {
  try {
    const {sessionId} = req.params;
    const {message} = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({error: 'Message is required'});
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({error: 'Session not found. Please start a new session.'});
      return;
    }

    const result = await processRecommendationMessage(session, message);

    // Update session in store
    sessions.set(sessionId, result.session);

    if (result.isComplete) {
      // Clean up session after completion
      sessions.delete(sessionId);

      res.json({
        isComplete: true,
        recommendations: result.response,
      });
    } else {
      res.json({
        isComplete: false,
        message: result.response as string,
        preferences: result.session.preferences,
      });
    }
  } catch (error) {
    loggers.http.error({err: error, endpoint: '/recommendations/session/:sessionId/message'}, 'Error processing message');
    res.status(500).json({error: 'Failed to process message'});
  }
});

/**
 * GET /recommendations/session/:sessionId
 * Get current session state
 */
router.get('/session/:sessionId', (req, res) => {
  const {sessionId} = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    res.status(404).json({error: 'Session not found'});
    return;
  }

  res.json({
    state: session.state,
    preferences: session.preferences,
    conversationHistory: session.conversationHistory,
  });
});

export default router;

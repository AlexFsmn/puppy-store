import {Router} from 'express';
import {
  startChatSession,
  processChatMessage,
  getSession,
  saveSession,
  type ChatSession,
} from '../services/chatService';
import {type ExtractedPreferences, type UserWithPreferences} from '../services/preferences';
import {captureException, prisma} from '@puppy-store/shared';
import {handleExpertError} from '../services/errors';

const router = Router();

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

/**
 * Get user from auth token
 */
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
  } catch {
    return null;
  }
}

/**
 * POST /chat/session
 * Start a new chat session
 */
router.post('/session', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    const {session, welcomeMessage} = startChatSession(user);

    // Save session
    await saveSession(session);

    res.json({
      sessionId: session.id,
      message: welcomeMessage,
      isReturningUser: session.isReturningUser,
    });
  } catch (error) {
    handleExpertError(error, res, 'Failed to start chat session');
  }
});

/**
 * POST /chat/session/:sessionId/message
 * Send a message in an existing chat session
 */
router.post('/session/:sessionId/message', async (req, res) => {
  try {
    const {sessionId} = req.params;
    const {message} = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({error: 'Message is required'});
      return;
    }

    const session = await getSession(sessionId);
    if (!session) {
      res.status(404).json({error: 'Session not found'});
      return;
    }

    const {session: updatedSession, response} = await processChatMessage(session, message);

    // Save updated session
    await saveSession(updatedSession);

    res.json({
      message: response.message,
      activeAgent: response.activeAgent,
      recommendations: response.recommendations,
      hasRecommendations: !!response.recommendations,
    });
  } catch (error) {
    handleExpertError(error, res, 'Failed to process message');
  }
});

/**
 * GET /chat/session/:sessionId
 * Get current session state
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const {sessionId} = req.params;
    const session = await getSession(sessionId);

    if (!session) {
      res.status(404).json({error: 'Session not found'});
      return;
    }

    res.json({
      sessionId: session.id,
      activeAgent: session.activeAgent,
      hasRecommendations: !!session.recommendations,
      recommendations: session.recommendations,
      conversationHistory: session.conversationHistory,
    });
  } catch (error) {
    handleExpertError(error, res, 'Failed to get session');
  }
});

export default router;

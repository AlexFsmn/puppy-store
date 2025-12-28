import {Router} from 'express';
import {requireAuth, AuthenticatedRequest} from '../middleware/auth';
import * as notificationService from '../services/notifications';
import {handleNotificationError} from '../services/notifications';

const router = Router();

// GET /notifications/counts - Get unread counts for current user
router.get('/counts', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const counts = await notificationService.getNotificationCounts(req.user!.userId);
    res.json(counts);
  } catch (error) {
    handleNotificationError(error, res, 'Failed to fetch notification counts');
  }
});

// POST /notifications/mark-applications-read - Mark all received applications as read
router.post('/mark-applications-read', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await notificationService.markApplicationsAsRead(req.user!.userId);
    res.json({success: true});
  } catch (error) {
    handleNotificationError(error, res, 'Failed to mark applications as read');
  }
});

// POST /notifications/mark-chat-read/:chatRoomId - Mark a chat room as read
router.post('/mark-chat-read/:chatRoomId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await notificationService.markChatAsRead(req.params.chatRoomId, req.user!.userId);
    res.json({success: true});
  } catch (error) {
    handleNotificationError(error, res, 'Failed to mark chat as read');
  }
});

export default router;

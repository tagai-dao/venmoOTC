import { Hono } from 'hono';
import { authenticateToken } from '../middleware/auth.js';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notificationController.js';
import { Env } from '../types.js';

const router = new Hono<{ Bindings: Env }>();

/**
 * GET /api/notifications
 * 获取用户的通知列表（需要认证）
 */
router.get('/', authenticateToken, getNotifications);

/**
 * GET /api/notifications/unread/count
 * 获取未读通知数量（需要认证）
 */
router.get('/unread/count', authenticateToken, getUnreadCount);

/**
 * PUT /api/notifications/:id/read
 * 标记通知为已读（需要认证）
 */
router.put('/:id/read', authenticateToken, markAsRead);

/**
 * PUT /api/notifications/read/all
 * 标记所有通知为已读（需要认证）
 */
router.put('/read/all', authenticateToken, markAllAsRead);

/**
 * DELETE /api/notifications/:id
 * 删除通知（需要认证）
 */
router.delete('/:id', authenticateToken, deleteNotification);

export default router;

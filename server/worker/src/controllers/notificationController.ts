import { Context } from 'hono';
import { D1Adapter } from '../db/d1Adapter.js';
import { NotificationRepository } from '../db/repositories/notificationRepository.js';
import { AuthContext } from '../middleware/auth.js';
import { Env } from '../types.js';

/**
 * 获取用户的通知列表
 */
export const getNotifications = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const userId = c.user?.userId;
    if (!userId) {
      return c.json({ error: { message: 'Unauthorized' } }, 401);
    }

    const includeRead = c.req.query('includeRead') === 'true';
    const db = new D1Adapter(c.env.DB);
    const notificationRepo = new NotificationRepository(db);
    const notifications = await notificationRepo.findByUserId(userId, includeRead);
    
    return c.json({ notifications });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    return c.json({ error: { message: error.message || 'Failed to get notifications' } }, 500);
  }
};

/**
 * 获取未读通知数量
 */
export const getUnreadCount = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const userId = c.user?.userId;
    if (!userId) {
      return c.json({ error: { message: 'Unauthorized' } }, 401);
    }

    const db = new D1Adapter(c.env.DB);
    const notificationRepo = new NotificationRepository(db);
    const count = await notificationRepo.getUnreadCount(userId);
    
    return c.json({ count });
  } catch (error: any) {
    console.error('Get unread count error:', error);
    return c.json({ error: { message: error.message || 'Failed to get unread count' } }, 500);
  }
};

/**
 * 标记通知为已读
 */
export const markAsRead = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const { id } = c.req.param();
    const userId = c.user?.userId;
    
    if (!userId) {
      return c.json({ error: { message: 'Unauthorized' } }, 401);
    }

    const db = new D1Adapter(c.env.DB);
    const notificationRepo = new NotificationRepository(db);
    const success = await notificationRepo.markAsRead(id);
    
    if (!success) {
      return c.json({ error: { message: 'Notification not found' } }, 404);
    }
    
    return c.json({ message: 'Notification marked as read' });
  } catch (error: any) {
    console.error('Mark as read error:', error);
    return c.json({ error: { message: error.message || 'Failed to mark as read' } }, 500);
  }
};

/**
 * 标记所有通知为已读
 */
export const markAllAsRead = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const userId = c.user?.userId;
    
    if (!userId) {
      return c.json({ error: { message: 'Unauthorized' } }, 401);
    }

    const db = new D1Adapter(c.env.DB);
    const notificationRepo = new NotificationRepository(db);
    const count = await notificationRepo.markAllAsRead(userId);
    
    return c.json({ message: 'All notifications marked as read', count });
  } catch (error: any) {
    console.error('Mark all as read error:', error);
    return c.json({ error: { message: error.message || 'Failed to mark all as read' } }, 500);
  }
};

/**
 * 删除通知
 */
export const deleteNotification = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const { id } = c.req.param();
    const userId = c.user?.userId;
    
    if (!userId) {
      return c.json({ error: { message: 'Unauthorized' } }, 401);
    }

    const db = new D1Adapter(c.env.DB);
    const notificationRepo = new NotificationRepository(db);
    const success = await notificationRepo.delete(id);
    
    if (!success) {
      return c.json({ error: { message: 'Notification not found' } }, 404);
    }
    
    return c.json({ message: 'Notification deleted' });
  } catch (error: any) {
    console.error('Delete notification error:', error);
    return c.json({ error: { message: error.message || 'Failed to delete notification' } }, 500);
  }
};

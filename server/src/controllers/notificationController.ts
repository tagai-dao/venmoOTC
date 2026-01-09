import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { NotificationRepository } from '../db/repositories/notificationRepository.js';

/**
 * 获取用户的通知列表
 */
export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const includeRead = req.query.includeRead === 'true';
    const notifications = await NotificationRepository.findByUserId(userId, includeRead);
    
    res.json({ notifications });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: { message: error.message || 'Failed to get notifications' } });
  }
};

/**
 * 获取未读通知数量
 */
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const count = await NotificationRepository.getUnreadCount(userId);
    
    res.json({ count });
  } catch (error: any) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: { message: error.message || 'Failed to get unread count' } });
  }
};

/**
 * 标记通知为已读
 */
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const success = await NotificationRepository.markAsRead(id);
    
    if (!success) {
      return res.status(404).json({ error: { message: 'Notification not found' } });
    }
    
    res.json({ message: 'Notification marked as read' });
  } catch (error: any) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: { message: error.message || 'Failed to mark as read' } });
  }
};

/**
 * 标记所有通知为已读
 */
export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const count = await NotificationRepository.markAllAsRead(userId);
    
    res.json({ message: 'All notifications marked as read', count });
  } catch (error: any) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: { message: error.message || 'Failed to mark all as read' } });
  }
};

/**
 * 删除通知
 */
export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const success = await NotificationRepository.delete(id);
    
    if (!success) {
      return res.status(404).json({ error: { message: 'Notification not found' } });
    }
    
    res.json({ message: 'Notification deleted' });
  } catch (error: any) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: { message: error.message || 'Failed to delete notification' } });
  }
};

import { pool } from '../config.js';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  transactionId?: string;
  relatedUserId?: string;
  isRead: boolean;
  createdAt: Date;
}

/**
 * 通知数据仓库
 */
export class NotificationRepository {
  /**
   * 将数据库行转换为 Notification 对象
   */
  private static rowToNotification(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      transactionId: row.transaction_id || undefined,
      relatedUserId: row.related_user_id || undefined,
      isRead: Boolean(row.is_read),
      createdAt: row.created_at,
    };
  }

  /**
   * 创建通知
   */
  static async create(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const id = `n${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    await pool.execute(
      `INSERT INTO notifications (id, user_id, type, title, message, transaction_id, related_user_id, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        notification.userId,
        notification.type,
        notification.title,
        notification.message,
        notification.transactionId || null,
        notification.relatedUserId || null,
        notification.isRead ? 1 : 0,
      ]
    );
    
    return this.findById(id) as Promise<Notification>;
  }

  /**
   * 根据 ID 获取通知
   */
  static async findById(id: string): Promise<Notification | null> {
    const [rows] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [id]);
    const result = rows as any[];
    if (result.length === 0) {
      return null;
    }
    return this.rowToNotification(result[0]);
  }

  /**
   * 获取用户的所有通知
   */
  static async findByUserId(userId: string, includeRead: boolean = true): Promise<Notification[]> {
    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const params: any[] = [userId];
    
    if (!includeRead) {
      query += ' AND is_read = 0';
    }
    
    query += ' ORDER BY created_at DESC';
    
    const [rows] = await pool.execute(query, params);
    const result = rows as any[];
    return result.map(this.rowToNotification);
  }

  /**
   * 获取未读通知数量
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    const result = rows as any[];
    return result[0]?.count || 0;
  }

  /**
   * 标记通知为已读
   */
  static async markAsRead(id: string): Promise<boolean> {
    const [result] = await pool.execute(
      'UPDATE notifications SET is_read = 1 WHERE id = ?',
      [id]
    );
    const updateResult = result as any;
    return updateResult.affectedRows > 0;
  }

  /**
   * 标记用户所有通知为已读
   */
  static async markAllAsRead(userId: string): Promise<number> {
    const [result] = await pool.execute(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    const updateResult = result as any;
    return updateResult.affectedRows || 0;
  }

  /**
   * 删除通知
   */
  static async delete(id: string): Promise<boolean> {
    const [result] = await pool.execute('DELETE FROM notifications WHERE id = ?', [id]);
    const deleteResult = result as any;
    return deleteResult.affectedRows > 0;
  }
}

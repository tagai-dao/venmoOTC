import { D1Adapter } from '../d1Adapter.js';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  transactionId?: string;
  relatedUserId?: string;
  isRead: boolean;
  createdAt: number;
}

/**
 * 通知数据仓库（D1 版本）
 */
export class NotificationRepository {
  constructor(private db: D1Adapter) {}

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
      createdAt: parseInt(row.created_at),
    };
  }

  /**
   * 创建通知
   */
  async create(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const id = `n${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    await this.db.execute(
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
  async findById(id: string): Promise<Notification | null> {
    const row = await this.db.queryOne('SELECT * FROM notifications WHERE id = ?', [id]);
    if (!row) {
      return null;
    }
    return NotificationRepository.rowToNotification(row);
  }

  /**
   * 获取用户的所有通知
   */
  async findByUserId(userId: string, includeRead: boolean = true): Promise<Notification[]> {
    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const params: any[] = [userId];
    
    if (!includeRead) {
      query += ' AND is_read = 0';
    }
    
    query += ' ORDER BY created_at DESC';
    
    const rows = await this.db.query(query, params);
    return rows.map(NotificationRepository.rowToNotification);
  }

  /**
   * 获取未读通知数量
   */
  async getUnreadCount(userId: string): Promise<number> {
    const row = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return row?.count || 0;
  }

  /**
   * 标记通知为已读
   */
  async markAsRead(id: string): Promise<boolean> {
    const result = await this.db.execute(
      'UPDATE notifications SET is_read = 1 WHERE id = ?',
      [id]
    );
    return result.success === true;
  }

  /**
   * 标记用户所有通知为已读
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.db.execute(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    // D1 返回的格式不同，需要从 meta 获取更新的行数
    return result.meta?.changes || 0;
  }

  /**
   * 删除通知
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db.execute('DELETE FROM notifications WHERE id = ?', [id]);
    return result.success === true;
  }
}

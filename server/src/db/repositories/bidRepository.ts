import { pool } from '../config.js';
import { Bid } from '../../types.js';
import { UserRepository } from './userRepository.js';

/**
 * 抢单数据仓库
 */
export class BidRepository {
  /**
   * 将数据库行转换为 Bid 对象
   */
  private static async rowToBid(row: any): Promise<Bid> {
    const user = await UserRepository.findById(row.user_id);
    if (!user) {
      throw new Error(`User not found: ${row.user_id}`);
    }
    return {
      id: row.id,
      userId: row.user_id,
      user,
      transactionId: row.transaction_id,
      timestamp: parseInt(row.timestamp),
      message: row.message || undefined,
    };
  }

  /**
   * 创建抢单
   */
  static async create(bid: Omit<Bid, 'id'> & { id?: string }): Promise<Bid> {
    const id = bid.id || `bid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = bid.timestamp || Date.now();

    await pool.execute(
      `INSERT INTO transaction_bids (id, transaction_id, user_id, message, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [id, bid.transactionId, bid.userId, bid.message || null, timestamp]
    );

    const [rows] = await pool.execute('SELECT * FROM transaction_bids WHERE id = ?', [id]);
    return this.rowToBid((rows as any[])[0]);
  }

  /**
   * 获取交易的所有抢单
   */
  static async findByTransactionId(transactionId: string): Promise<Bid[]> {
    const [rows] = await pool.execute(
      'SELECT * FROM transaction_bids WHERE transaction_id = ? ORDER BY timestamp ASC',
      [transactionId]
    );
    const result = rows as any[];
    return Promise.all(result.map(row => this.rowToBid(row)));
  }

  /**
   * 检查用户是否已经抢单
   */
  static async hasUserBid(transactionId: string, userId: string): Promise<boolean> {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM transaction_bids WHERE transaction_id = ? AND user_id = ?',
      [transactionId, userId]
    );
    return (rows as any[])[0].count > 0;
  }

  /**
   * 删除抢单
   */
  static async delete(bidId: string, userId: string): Promise<boolean> {
    const [result] = await pool.execute(
      'DELETE FROM transaction_bids WHERE id = ? AND user_id = ?',
      [bidId, userId]
    );
    return (result as any).affectedRows > 0;
  }
}

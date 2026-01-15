import { D1Adapter } from '../d1Adapter.js';
import { Bid } from '../../types.js';
import { UserRepository } from './userRepository.js';

/**
 * 抢单数据仓库（D1 版本）
 */
export class BidRepository {
  constructor(
    private db: D1Adapter,
    private userRepo: UserRepository
  ) {}

  /**
   * 将数据库行转换为 Bid 对象
   */
  private async rowToBid(row: any): Promise<Bid> {
    const user = await this.userRepo.findById(row.user_id);
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
  async create(bid: Omit<Bid, 'id'> & { id?: string }): Promise<Bid> {
    const id = bid.id || `bid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = bid.timestamp || Date.now();

    await this.db.execute(
      `INSERT INTO transaction_bids (id, transaction_id, user_id, message, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [id, bid.transactionId, bid.userId, bid.message || null, timestamp]
    );

    const row = await this.db.queryOne('SELECT * FROM transaction_bids WHERE id = ?', [id]);
    if (!row) {
      throw new Error('Failed to create bid');
    }
    return this.rowToBid(row);
  }

  /**
   * 获取交易的所有抢单
   */
  async findByTransactionId(transactionId: string): Promise<Bid[]> {
    const rows = await this.db.query(
      'SELECT * FROM transaction_bids WHERE transaction_id = ? ORDER BY timestamp ASC',
      [transactionId]
    );
    return Promise.all(rows.map((row: any) => this.rowToBid(row)));
  }

  /**
   * 检查用户是否已经抢单
   */
  async hasUserBid(transactionId: string, userId: string): Promise<boolean> {
    const row = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM transaction_bids WHERE transaction_id = ? AND user_id = ?',
      [transactionId, userId]
    );
    return (row?.count || 0) > 0;
  }

  /**
   * 删除抢单
   */
  async delete(bidId: string, userId: string): Promise<boolean> {
    const result = await this.db.execute(
      'DELETE FROM transaction_bids WHERE id = ? AND user_id = ?',
      [bidId, userId]
    );
    return result.success === true;
  }
}

import { pool } from '../config.js';
import { Transaction, TransactionReply, TransactionType, Privacy, OTCState, Currency } from '../../types.js';
import { UserRepository } from './userRepository.js';

/**
 * 交易数据仓库
 */
export class TransactionRepository {
  /**
   * 将数据库行转换为 Transaction 对象
   */
  private static async rowToTransaction(row: any): Promise<Transaction> {
    const fromUser = await UserRepository.findById(row.from_user_id);
    if (!fromUser) {
      throw new Error(`User not found: ${row.from_user_id}`);
    }

    let toUser = null;
    if (row.to_user_id) {
      toUser = await UserRepository.findById(row.to_user_id);
    }

    // 获取回复
    const repliesResult = await pool.query(
      'SELECT * FROM transaction_replies WHERE transaction_id = $1 ORDER BY timestamp ASC',
      [row.id]
    );

    const replies: TransactionReply[] = await Promise.all(
      repliesResult.rows.map(async (replyRow) => {
        const replyUser = await UserRepository.findById(replyRow.user_id);
        if (!replyUser) {
          throw new Error(`User not found: ${replyRow.user_id}`);
        }
        return {
          id: replyRow.id,
          user: replyUser,
          text: replyRow.text,
          proof: replyRow.proof || undefined,
          timestamp: parseInt(replyRow.timestamp),
        };
      })
    );

    return {
      id: row.id,
      fromUser,
      toUser,
      amount: parseFloat(row.amount),
      currency: row.currency as Currency,
      note: row.note,
      sticker: row.sticker || undefined,
      timestamp: parseInt(row.timestamp),
      privacy: row.privacy as Privacy,
      type: row.type as TransactionType,
      xPostId: row.x_post_id || undefined,
      isOTC: row.is_otc,
      otcState: row.otc_state as OTCState,
      otcFiatCurrency: row.otc_fiat_currency as Currency | undefined,
      otcOfferAmount: row.otc_offer_amount ? parseFloat(row.otc_offer_amount) : undefined,
      otcProofImage: row.otc_proof_image || undefined,
      relatedTransactionId: row.related_transaction_id || undefined,
      likes: row.likes || 0,
      comments: row.comments || 0,
      replies: replies.length > 0 ? replies : undefined,
    };
  }

  /**
   * 获取所有交易
   */
  static async findAll(filters?: {
    userId?: string;
    type?: TransactionType;
    privacy?: Privacy;
  }): Promise<Transaction[]> {
    let query = `
      SELECT t.* FROM transactions t
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.userId) {
      query += ` AND (t.from_user_id = $${paramIndex} OR t.to_user_id = $${paramIndex})`;
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters?.type) {
      query += ` AND t.type = $${paramIndex}`;
      params.push(filters.type);
      paramIndex++;
    }

    if (filters?.privacy) {
      query += ` AND t.privacy = $${paramIndex}`;
      params.push(filters.privacy);
      paramIndex++;
    }

    query += ' ORDER BY t.timestamp DESC';

    const result = await pool.query(query, params);
    return Promise.all(result.rows.map(row => this.rowToTransaction(row)));
  }

  /**
   * 根据 ID 获取交易
   */
  static async findById(id: string): Promise<Transaction | null> {
    const result = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.rowToTransaction(result.rows[0]);
  }

  /**
   * 创建交易
   */
  static async create(transaction: Omit<Transaction, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): Promise<Transaction> {
    const id = transaction.id || `t${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = transaction.timestamp || Date.now();

    await pool.query(
      `INSERT INTO transactions (
        id, from_user_id, to_user_id, amount, currency, note, sticker,
        timestamp, privacy, type, x_post_id, is_otc, otc_state,
        otc_fiat_currency, otc_offer_amount, otc_proof_image,
        related_transaction_id, likes, comments
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        id,
        transaction.fromUser.id,
        transaction.toUser?.id || null,
        transaction.amount,
        transaction.currency,
        transaction.note,
        transaction.sticker || null,
        timestamp,
        transaction.privacy,
        transaction.type,
        transaction.xPostId || null,
        transaction.isOTC,
        transaction.otcState,
        transaction.otcFiatCurrency || null,
        transaction.otcOfferAmount || null,
        transaction.otcProofImage || null,
        transaction.relatedTransactionId || null,
        transaction.likes || 0,
        transaction.comments || 0,
      ]
    );

    return this.findById(id) as Promise<Transaction>;
  }

  /**
   * 更新交易
   */
  static async update(id: string, updates: Partial<Transaction> & { newReply?: TransactionReply }): Promise<Transaction | null> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 处理新回复
      if (updates.newReply) {
        const replyId = updates.newReply.id || `r${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await client.query(
          `INSERT INTO transaction_replies (id, transaction_id, user_id, text, proof, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            replyId,
            id,
            updates.newReply.user.id,
            updates.newReply.text,
            updates.newReply.proof || null,
            updates.newReply.timestamp,
          ]
        );

        // 更新评论数
        await client.query(
          'UPDATE transactions SET comments = comments + 1 WHERE id = $1',
          [id]
        );
      }

      // 更新其他字段
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.toUser !== undefined) {
        fields.push(`to_user_id = $${paramIndex++}`);
        values.push(updates.toUser?.id || null);
      }
      if (updates.amount !== undefined) {
        fields.push(`amount = $${paramIndex++}`);
        values.push(updates.amount);
      }
      if (updates.currency !== undefined) {
        fields.push(`currency = $${paramIndex++}`);
        values.push(updates.currency);
      }
      if (updates.note !== undefined) {
        fields.push(`note = $${paramIndex++}`);
        values.push(updates.note);
      }
      if (updates.sticker !== undefined) {
        fields.push(`sticker = $${paramIndex++}`);
        values.push(updates.sticker || null);
      }
      if (updates.privacy !== undefined) {
        fields.push(`privacy = $${paramIndex++}`);
        values.push(updates.privacy);
      }
      if (updates.type !== undefined) {
        fields.push(`type = $${paramIndex++}`);
        values.push(updates.type);
      }
      if (updates.xPostId !== undefined) {
        fields.push(`x_post_id = $${paramIndex++}`);
        values.push(updates.xPostId || null);
      }
      if (updates.isOTC !== undefined) {
        fields.push(`is_otc = $${paramIndex++}`);
        values.push(updates.isOTC);
      }
      if (updates.otcState !== undefined) {
        fields.push(`otc_state = $${paramIndex++}`);
        values.push(updates.otcState);
      }
      if (updates.otcFiatCurrency !== undefined) {
        fields.push(`otc_fiat_currency = $${paramIndex++}`);
        values.push(updates.otcFiatCurrency || null);
      }
      if (updates.otcOfferAmount !== undefined) {
        fields.push(`otc_offer_amount = $${paramIndex++}`);
        values.push(updates.otcOfferAmount || null);
      }
      if (updates.otcProofImage !== undefined) {
        fields.push(`otc_proof_image = $${paramIndex++}`);
        values.push(updates.otcProofImage || null);
      }
      if (updates.relatedTransactionId !== undefined) {
        fields.push(`related_transaction_id = $${paramIndex++}`);
        values.push(updates.relatedTransactionId || null);
      }
      if (updates.likes !== undefined) {
        fields.push(`likes = $${paramIndex++}`);
        values.push(updates.likes);
      }
      if (updates.comments !== undefined) {
        fields.push(`comments = $${paramIndex++}`);
        values.push(updates.comments);
      }

      if (fields.length > 0) {
        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        await client.query(
          `UPDATE transactions SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
          values
        );
      }

      await client.query('COMMIT');
      return this.findById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 删除交易
   */
  static async delete(id: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM transactions WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}


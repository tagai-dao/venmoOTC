import { pool } from '../config.js';
import { Transaction, TransactionReply, TransactionType, Privacy, OTCState, Currency, Bid } from '../../types.js';
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
    const [repliesRows] = await pool.execute(
      'SELECT * FROM transaction_replies WHERE transaction_id = ? ORDER BY timestamp ASC',
      [row.id]
    );

    const repliesResult = repliesRows as any[];
    const replies: TransactionReply[] = await Promise.all(
      repliesResult.map(async (replyRow) => {
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
          privacy: replyRow.privacy || 'PUBLIC',
          xCommentId: replyRow.x_comment_id || undefined,
        };
      })
    );

    // 获取抢单（bids）
    const [bidsRows] = await pool.execute(
      'SELECT * FROM transaction_bids WHERE transaction_id = ? ORDER BY timestamp ASC',
      [row.id]
    );

    const bidsResult = bidsRows as any[];
    const bids: Bid[] = await Promise.all(
      bidsResult.map(async (bidRow) => {
        const bidUser = await UserRepository.findById(bidRow.user_id);
        if (!bidUser) {
          throw new Error(`User not found: ${bidRow.user_id}`);
        }
        return {
          id: bidRow.id,
          userId: bidRow.user_id,
          user: bidUser,
          transactionId: bidRow.transaction_id,
          timestamp: parseInt(bidRow.timestamp),
          message: bidRow.message || undefined,
        };
      })
    );

    // 获取选中的交易者
    let selectedTrader = null;
    if (row.selected_trader_id) {
      selectedTrader = await UserRepository.findById(row.selected_trader_id);
    }

    return {
      id: row.id,
      fromUser,
      toUser: selectedTrader || toUser, // Use selected trader if available
      amount: parseFloat(row.amount),
      currency: row.currency as Currency,
      note: row.note,
      sticker: row.sticker || undefined,
      timestamp: parseInt(row.timestamp),
      privacy: row.privacy as Privacy,
      type: row.type as TransactionType,
      xPostId: row.x_post_id || undefined,
      isOTC: Boolean(row.is_otc),
      otcState: row.otc_state as OTCState,
      otcFiatCurrency: row.otc_fiat_currency as Currency | undefined,
      otcOfferAmount: row.otc_offer_amount ? parseFloat(row.otc_offer_amount) : undefined,
      otcProofImage: row.otc_proof_image || undefined,
      relatedTransactionId: row.related_transaction_id || undefined,
      fiatRejectionCount: row.fiat_rejection_count || 0,
      bids: bids.length > 0 ? bids : undefined,
      selectedTraderId: row.selected_trader_id || undefined,
      multisigContractAddress: row.multisig_contract_address || undefined,
      usdtInEscrow: Boolean(row.usdt_in_escrow),
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
      query += ` AND (t.from_user_id = ? OR t.to_user_id = ?)`;
      params.push(filters.userId, filters.userId);
    }

    if (filters?.type) {
      query += ` AND t.type = ?`;
      params.push(filters.type);
    }

    if (filters?.privacy) {
      query += ` AND t.privacy = ?`;
      params.push(filters.privacy);
    }

    query += ' ORDER BY t.timestamp DESC';

    const [rows] = await pool.execute(query, params);
    const result = rows as any[];
    return Promise.all(result.map(row => this.rowToTransaction(row)));
  }

  /**
   * 根据 ID 获取交易
   */
  static async findById(id: string): Promise<Transaction | null> {
    const [rows] = await pool.execute('SELECT * FROM transactions WHERE id = ?', [id]);
    const result = rows as any[];
    if (result.length === 0) {
      return null;
    }
    return this.rowToTransaction(result[0]);
  }

  /**
   * 创建交易
   */
  static async create(transaction: Omit<Transaction, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): Promise<Transaction> {
    const id = transaction.id || `t${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = transaction.timestamp || Date.now();

    await pool.execute(
      `INSERT INTO transactions (
        id, from_user_id, to_user_id, amount, currency, note, sticker,
        timestamp, privacy, type, x_post_id, is_otc, otc_state,
        otc_fiat_currency, otc_offer_amount, otc_proof_image,
        related_transaction_id, fiat_rejection_count, likes, comments,
        selected_trader_id, multisig_contract_address, usdt_in_escrow
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        transaction.isOTC ? 1 : 0,
        transaction.otcState,
        transaction.otcFiatCurrency || null,
        transaction.otcOfferAmount || null,
        transaction.otcProofImage || null,
        transaction.relatedTransactionId || null,
        transaction.fiatRejectionCount || 0,
        transaction.likes || 0,
        transaction.comments || 0,
        transaction.selectedTraderId || null,
        transaction.multisigContractAddress || null,
        transaction.usdtInEscrow ? 1 : 0,
      ]
    );

    return this.findById(id) as Promise<Transaction>;
  }

  /**
   * 更新交易
   */
  static async update(id: string, updates: Partial<Transaction> & { newReply?: TransactionReply }): Promise<Transaction | null> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // 处理新回复
      if (updates.newReply) {
        const replyId = updates.newReply.id || `r${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await connection.execute(
          `INSERT INTO transaction_replies (id, transaction_id, user_id, text, proof, timestamp)
           VALUES (?, ?, ?, ?, ?, ?)`,
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
        await connection.execute(
          'UPDATE transactions SET comments = comments + 1 WHERE id = ?',
          [id]
        );
      }

      // 更新其他字段
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.toUser !== undefined) {
        fields.push(`to_user_id = ?`);
        values.push(updates.toUser?.id || null);
      }
      if (updates.amount !== undefined) {
        fields.push(`amount = ?`);
        values.push(updates.amount);
      }
      if (updates.currency !== undefined) {
        fields.push(`currency = ?`);
        values.push(updates.currency);
      }
      if (updates.note !== undefined) {
        fields.push(`note = ?`);
        values.push(updates.note);
      }
      if (updates.sticker !== undefined) {
        fields.push(`sticker = ?`);
        values.push(updates.sticker || null);
      }
      if (updates.privacy !== undefined) {
        fields.push(`privacy = ?`);
        values.push(updates.privacy);
      }
      if (updates.type !== undefined) {
        fields.push(`type = ?`);
        values.push(updates.type);
      }
      if (updates.xPostId !== undefined) {
        fields.push(`x_post_id = ?`);
        values.push(updates.xPostId || null);
      }
      if (updates.isOTC !== undefined) {
        fields.push(`is_otc = ?`);
        values.push(updates.isOTC ? 1 : 0);
      }
      if (updates.otcState !== undefined) {
        fields.push(`otc_state = ?`);
        values.push(updates.otcState);
      }
      if (updates.otcFiatCurrency !== undefined) {
        fields.push(`otc_fiat_currency = ?`);
        values.push(updates.otcFiatCurrency || null);
      }
      if (updates.otcOfferAmount !== undefined) {
        fields.push(`otc_offer_amount = ?`);
        values.push(updates.otcOfferAmount || null);
      }
      if (updates.otcProofImage !== undefined) {
        fields.push(`otc_proof_image = ?`);
        values.push(updates.otcProofImage || null);
      }
      if (updates.relatedTransactionId !== undefined) {
        fields.push(`related_transaction_id = ?`);
        values.push(updates.relatedTransactionId || null);
      }
      if (updates.fiatRejectionCount !== undefined) {
        fields.push(`fiat_rejection_count = ?`);
        values.push(updates.fiatRejectionCount);
      }
      if (updates.selectedTraderId !== undefined) {
        fields.push(`selected_trader_id = ?`);
        values.push(updates.selectedTraderId || null);
      }
      if (updates.multisigContractAddress !== undefined) {
        fields.push(`multisig_contract_address = ?`);
        values.push(updates.multisigContractAddress || null);
      }
      if (updates.usdtInEscrow !== undefined) {
        fields.push(`usdt_in_escrow = ?`);
        values.push(updates.usdtInEscrow ? 1 : 0);
      }
      if (updates.likes !== undefined) {
        fields.push(`likes = ?`);
        values.push(updates.likes);
      }
      if (updates.comments !== undefined) {
        fields.push(`comments = ?`);
        values.push(updates.comments);
      }

      if (fields.length > 0) {
        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        await connection.execute(
          `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`,
          values
        );
      }

      await connection.commit();
      return this.findById(id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 删除交易
   */
  static async delete(id: string): Promise<boolean> {
    const [result] = await pool.execute('DELETE FROM transactions WHERE id = ?', [id]);
    const deleteResult = result as any;
    return deleteResult.affectedRows > 0;
  }
}


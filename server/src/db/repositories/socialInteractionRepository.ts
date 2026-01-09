import { pool } from '../config.js';
import { Privacy } from '../../types.js';
import { UserRepository } from './userRepository.js';

/**
 * 社交互动数据仓库（点赞、评论）
 */
export class SocialInteractionRepository {
  /**
   * 点赞交易
   */
  static async likeTransaction(
    transactionId: string,
    userId: string,
    privacy: Privacy
  ): Promise<{ id: string; xLikeId?: string }> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // 检查是否已经点赞
      const [existing] = await connection.execute(
        'SELECT id FROM transaction_likes WHERE transaction_id = ? AND user_id = ?',
        [transactionId, userId]
      );

      const existingRows = existing as any[];
      if (existingRows.length > 0) {
        // 已经点赞，取消点赞
        await connection.execute(
          'DELETE FROM transaction_likes WHERE transaction_id = ? AND user_id = ?',
          [transactionId, userId]
        );
        await connection.execute(
          'UPDATE transactions SET likes = GREATEST(likes - 1, 0) WHERE id = ?',
          [transactionId]
        );
        await connection.commit();
        return { id: '' }; // 返回空 ID 表示取消点赞
      } else {
        // 添加点赞
        const likeId = `like_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await connection.execute(
          `INSERT INTO transaction_likes (id, transaction_id, user_id, privacy, x_like_id)
           VALUES (?, ?, ?, ?, ?)`,
          [likeId, transactionId, userId, privacy, null]
        );
        await connection.execute(
          'UPDATE transactions SET likes = likes + 1 WHERE id = ?',
          [transactionId]
        );
        await connection.commit();
        return { id: likeId };
      }
    } catch (error: any) {
      await connection.rollback();
      console.error('Like transaction repository error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 检查用户是否已点赞
   */
  static async hasUserLiked(transactionId: string, userId: string): Promise<boolean> {
    try {
      const [rows] = await pool.execute(
        'SELECT COUNT(*) as count FROM transaction_likes WHERE transaction_id = ? AND user_id = ?',
        [transactionId, userId]
      );
      const result = rows as any[];
      if (result.length === 0) return false;
      // MySQL 返回的 count 可能是 BigInt 或 number
      const count = result[0].count;
      return Number(count) > 0;
    } catch (error: any) {
      // 如果表不存在，返回 false
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 1146) {
        console.warn('transaction_likes table does not exist yet');
        return false;
      }
      throw error;
    }
  }

  /**
   * 获取交易的点赞列表
   */
  static async getLikes(transactionId: string): Promise<Array<{ user: any; privacy: Privacy; createdAt: Date }>> {
    const [rows] = await pool.execute(
      'SELECT * FROM transaction_likes WHERE transaction_id = ? ORDER BY created_at DESC',
      [transactionId]
    );

    const likes = await Promise.all(
      (rows as any[]).map(async (row) => {
        const user = await UserRepository.findById(row.user_id);
        if (!user) {
          throw new Error(`User not found: ${row.user_id}`);
        }
        return {
          user,
          privacy: row.privacy as Privacy,
          createdAt: row.created_at,
        };
      })
    );

    return likes;
  }

  /**
   * 添加评论
   */
  static async addComment(
    transactionId: string,
    userId: string,
    text: string,
    privacy: Privacy,
    proof?: string,
    xCommentId?: string
  ): Promise<string> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      const commentId = `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await connection.execute(
        `INSERT INTO transaction_replies (id, transaction_id, user_id, text, proof, timestamp, privacy, x_comment_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [commentId, transactionId, userId, text, proof || null, Date.now(), privacy, xCommentId || null]
      );

      await connection.execute(
        'UPDATE transactions SET comments = comments + 1 WHERE id = ?',
        [transactionId]
      );

      await connection.commit();
      return commentId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 删除评论
   */
  static async deleteComment(commentId: string, userId: string): Promise<boolean> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // 获取评论信息
      const [commentRows] = await connection.execute(
        'SELECT transaction_id FROM transaction_replies WHERE id = ? AND user_id = ?',
        [commentId, userId]
      );

      if ((commentRows as any[]).length === 0) {
        await connection.rollback();
        return false;
      }

      const transactionId = (commentRows as any[])[0].transaction_id;

      // 删除评论
      await connection.execute(
        'DELETE FROM transaction_replies WHERE id = ? AND user_id = ?',
        [commentId, userId]
      );

      // 更新评论数
      await connection.execute(
        'UPDATE transactions SET comments = GREATEST(comments - 1, 0) WHERE id = ?',
        [transactionId]
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 更新点赞的 X ID（用于同步到 X）
   */
  static async updateLikeXId(likeId: string, xLikeId: string): Promise<void> {
    await pool.execute(
      'UPDATE transaction_likes SET x_like_id = ? WHERE id = ?',
      [xLikeId, likeId]
    );
  }

  /**
   * 更新评论的 X ID（用于同步到 X）
   */
  static async updateCommentXId(commentId: string, xCommentId: string): Promise<void> {
    await pool.execute(
      'UPDATE transaction_replies SET x_comment_id = ? WHERE id = ?',
      [xCommentId, commentId]
    );
  }
}

import { D1Adapter } from '../d1Adapter.js';
import { Privacy } from '../../types.js';
import { UserRepository } from './userRepository.js';

/**
 * 社交互动数据仓库（D1 版本）
 */
export class SocialInteractionRepository {
  constructor(
    private db: D1Adapter,
    private userRepo: UserRepository
  ) {}

  /**
   * 点赞交易
   */
  async likeTransaction(
    transactionId: string,
    userId: string,
    privacy: Privacy
  ): Promise<{ id: string; xLikeId?: string }> {
    // 检查是否已经点赞
    const existing = await this.db.queryOne<{ id: string }>(
      'SELECT id FROM transaction_likes WHERE transaction_id = ? AND user_id = ?',
      [transactionId, userId]
    );

    if (existing) {
      // 已经点赞，取消点赞
      await this.db.execute(
        'DELETE FROM transaction_likes WHERE transaction_id = ? AND user_id = ?',
        [transactionId, userId]
      );
      await this.db.execute(
        'UPDATE transactions SET likes = MAX(likes - 1, 0) WHERE id = ?',
        [transactionId]
      );
      return { id: '' }; // 返回空 ID 表示取消点赞
    } else {
      // 添加点赞
      const likeId = `like_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await this.db.execute(
        `INSERT INTO transaction_likes (id, transaction_id, user_id, privacy, x_like_id)
         VALUES (?, ?, ?, ?, ?)`,
        [likeId, transactionId, userId, privacy, null]
      );
      await this.db.execute(
        'UPDATE transactions SET likes = likes + 1 WHERE id = ?',
        [transactionId]
      );
      return { id: likeId };
    }
  }

  /**
   * 检查用户是否已点赞
   */
  async hasUserLiked(transactionId: string, userId: string): Promise<boolean> {
    const row = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM transaction_likes WHERE transaction_id = ? AND user_id = ?',
      [transactionId, userId]
    );
    return (row?.count || 0) > 0;
  }

  /**
   * 获取交易的点赞列表
   */
  async getLikes(transactionId: string): Promise<Array<{ user: any; privacy: Privacy; createdAt: number }>> {
    const rows = await this.db.query(
      'SELECT * FROM transaction_likes WHERE transaction_id = ? ORDER BY created_at DESC',
      [transactionId]
    );

    const likes = await Promise.all(
      rows.map(async (row: any) => {
        const user = await this.userRepo.findById(row.user_id);
        if (!user) {
          throw new Error(`User not found: ${row.user_id}`);
        }
        return {
          user,
          privacy: row.privacy as Privacy,
          createdAt: parseInt(row.created_at),
        };
      })
    );

    return likes;
  }

  /**
   * 添加评论
   */
  async addComment(
    transactionId: string,
    userId: string,
    text: string,
    privacy: Privacy,
    proof?: string,
    xCommentId?: string
  ): Promise<string> {
    const commentId = `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await this.db.execute(
      `INSERT INTO transaction_replies (id, transaction_id, user_id, text, proof, timestamp, privacy, x_comment_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [commentId, transactionId, userId, text, proof || null, Date.now(), privacy, xCommentId || null]
    );

    await this.db.execute(
      'UPDATE transactions SET comments = comments + 1 WHERE id = ?',
      [transactionId]
    );

    return commentId;
  }

  /**
   * 删除评论
   */
  async deleteComment(commentId: string, userId: string): Promise<boolean> {
    // 获取评论信息
    const commentRow = await this.db.queryOne<{ transaction_id: string }>(
      'SELECT transaction_id FROM transaction_replies WHERE id = ? AND user_id = ?',
      [commentId, userId]
    );

    if (!commentRow) {
      return false;
    }

    const transactionId = commentRow.transaction_id;

    // 删除评论
    await this.db.execute(
      'DELETE FROM transaction_replies WHERE id = ? AND user_id = ?',
      [commentId, userId]
    );

    // 更新评论数
    await this.db.execute(
      'UPDATE transactions SET comments = MAX(comments - 1, 0) WHERE id = ?',
      [transactionId]
    );

    return true;
  }

  /**
   * 更新点赞的 X ID（用于同步到 X）
   */
  async updateLikeXId(likeId: string, xLikeId: string): Promise<void> {
    await this.db.execute(
      'UPDATE transaction_likes SET x_like_id = ? WHERE id = ?',
      [xLikeId, likeId]
    );
  }

  /**
   * 更新评论的 X ID（用于同步到 X）
   */
  async updateCommentXId(commentId: string, xCommentId: string): Promise<void> {
    await this.db.execute(
      'UPDATE transaction_replies SET x_comment_id = ? WHERE id = ?',
      [xCommentId, commentId]
    );
  }
}

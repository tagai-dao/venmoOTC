import { Hono } from 'hono';
import { authenticateToken } from '../middleware/auth.js';
import {
  likeTransaction,
  addComment,
  deleteComment,
  checkUserLiked
} from '../controllers/socialInteractionController.js';
import { Env } from '../types.js';

const router = new Hono<{ Bindings: Env }>();

/**
 * POST /api/social-interactions/:transactionId/like
 * 点赞/取消点赞交易
 */
router.post('/:transactionId/like', authenticateToken, likeTransaction);

/**
 * GET /api/social-interactions/:transactionId/liked
 * 检查用户是否已点赞
 */
router.get('/:transactionId/liked', authenticateToken, checkUserLiked);

/**
 * POST /api/social-interactions/:transactionId/comment
 * 添加评论
 */
router.post('/:transactionId/comment', authenticateToken, addComment);

/**
 * DELETE /api/social-interactions/comment/:commentId
 * 删除评论
 */
router.delete('/comment/:commentId', authenticateToken, deleteComment);

export default router;

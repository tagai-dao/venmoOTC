import { Hono } from 'hono';
import { postTweet, replyToTweet } from '../controllers/socialController.js';
import { authenticateToken } from '../middleware/auth.js';
import { Env } from '../types.js';

const router = new Hono<{ Bindings: Env }>();

/**
 * POST /api/social/tweet
 * 发布推文到 X (Twitter)（需要认证）
 */
router.post('/tweet', authenticateToken, postTweet);

/**
 * POST /api/social/reply
 * 回复推文（需要认证）
 */
router.post('/reply', authenticateToken, replyToTweet);

export default router;

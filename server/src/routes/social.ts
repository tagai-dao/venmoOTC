import express from 'express';
import { postTweet, replyToTweet } from '../controllers/socialController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

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


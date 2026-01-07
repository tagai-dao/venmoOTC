import express from 'express';
import { postTweet, replyToTweet } from '../controllers/socialController.js';

const router = express.Router();

/**
 * POST /api/social/tweet
 * 发布推文到 X (Twitter)
 */
router.post('/tweet', postTweet);

/**
 * POST /api/social/reply
 * 回复推文
 */
router.post('/reply', replyToTweet);

export default router;


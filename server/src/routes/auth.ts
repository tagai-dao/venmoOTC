import express from 'express';
import { loginWithX, logout, twitterAuthorize, twitterCallback } from '../controllers/authController.js';

const router = express.Router();

/**
 * GET /api/auth/twitter/authorize
 * Twitter OAuth 2.0 授权端点（重定向到 Twitter）
 */
router.get('/twitter/authorize', twitterAuthorize);

/**
 * GET /api/auth/twitter/callback
 * Twitter OAuth 2.0 回调端点
 */
router.get('/twitter/callback', twitterCallback);

/**
 * POST /api/auth/login
 * X (Twitter) 登录（兼容旧版本，通过 handle 登录）
 */
router.post('/login', loginWithX);

/**
 * POST /api/auth/logout
 * 登出
 */
router.post('/logout', logout);

export default router;


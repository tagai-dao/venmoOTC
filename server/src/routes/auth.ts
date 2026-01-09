import express from 'express';
import { logout, loginWithPrivy } from '../controllers/authController.js';

const router = express.Router();

/**
 * POST /api/auth/privy
 * Privy 登录（同步用户到后端）
 * 这是唯一的登录方式，通过 Privy 钱包登录（支持 Twitter 登录）
 */
router.post('/privy', loginWithPrivy);

/**
 * POST /api/auth/logout
 * 登出
 */
router.post('/logout', logout);

export default router;


import { Hono } from 'hono';
import { loginWithPrivy, logout } from '../controllers/authController.js';
import { Env } from '../types.js';

const router = new Hono<{ Bindings: Env }>();

/**
 * POST /api/auth/privy
 * Privy 登录（同步用户到后端）
 */
router.post('/privy', loginWithPrivy);

/**
 * POST /api/auth/logout
 * 登出
 */
router.post('/logout', logout);

export default router;

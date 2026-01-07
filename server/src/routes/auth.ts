import express from 'express';
import { loginWithX, logout } from '../controllers/authController.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * X (Twitter) 登录
 */
router.post('/login', loginWithX);

/**
 * POST /api/auth/logout
 * 登出
 */
router.post('/logout', logout);

export default router;


import express from 'express';
import { getUser, getUsers, getCurrentUser } from '../controllers/userController.js';
import { optionalAuth, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/users
 * 获取用户列表（公开，但可选认证）
 */
router.get('/', optionalAuth, getUsers);

/**
 * GET /api/users/me
 * 获取当前用户信息（需要认证）
 */
router.get('/me', authenticateToken, getCurrentUser);

/**
 * GET /api/users/:id
 * 获取用户信息（公开，但可选认证）
 */
router.get('/:id', optionalAuth, getUser);

export default router;


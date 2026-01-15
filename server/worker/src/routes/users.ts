import { Hono } from 'hono';
import { getUser, getUsers, getCurrentUser, updateCurrentUser } from '../controllers/userController.js';
import { optionalAuth, authenticateToken } from '../middleware/auth.js';
import { Env } from '../types.js';

const router = new Hono<{ Bindings: Env }>();

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
 * PUT /api/users/me
 * 更新当前用户信息（需要认证）
 */
router.put('/me', authenticateToken, updateCurrentUser);

/**
 * GET /api/users/:id
 * 获取用户信息（公开，但可选认证）
 */
router.get('/:id', optionalAuth, getUser);

export default router;

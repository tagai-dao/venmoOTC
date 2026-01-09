import express from 'express';
import { getUser, getUsers } from '../controllers/userController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/users
 * 获取用户列表（公开，但可选认证）
 */
router.get('/', optionalAuth, getUsers);

/**
 * GET /api/users/:id
 * 获取用户信息（公开，但可选认证）
 */
router.get('/:id', optionalAuth, getUser);

export default router;


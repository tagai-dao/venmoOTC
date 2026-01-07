import express from 'express';
import { getUser, getUsers } from '../controllers/userController.js';

const router = express.Router();

/**
 * GET /api/users
 * 获取用户列表
 */
router.get('/', getUsers);

/**
 * GET /api/users/:id
 * 获取用户信息
 */
router.get('/:id', getUser);

export default router;


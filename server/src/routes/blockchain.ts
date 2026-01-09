import express from 'express';
import { getBalance, sendUSDT } from '../controllers/blockchainController.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/blockchain/balance/:address/:currency
 * 获取钱包余额（可选认证）
 */
router.get('/balance/:address/:currency', optionalAuth, getBalance);

/**
 * POST /api/blockchain/send
 * 发送 USDT（需要认证）
 */
router.post('/send', authenticateToken, sendUSDT);

export default router;


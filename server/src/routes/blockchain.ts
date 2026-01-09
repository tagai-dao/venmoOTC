import express from 'express';
import { getBalance, sendUSDT, getTransaction, getMultipleBalances } from '../controllers/blockchainController.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/blockchain/balance/:address/:currency
 * 获取钱包余额（可选认证）
 * 支持: USDT (链上查询), BNB (链上查询), NGN/VES/USD (数据库)
 */
router.get('/balance/:address/:currency', optionalAuth, getBalance);

/**
 * POST /api/blockchain/send
 * 发送 USDT（需要认证）
 * 在 BNB Chain 上执行真实的 USDT 转账
 */
router.post('/send', authenticateToken, sendUSDT);

/**
 * GET /api/blockchain/transaction/:txHash
 * 获取交易详情（可选认证）
 */
router.get('/transaction/:txHash', optionalAuth, getTransaction);

/**
 * POST /api/blockchain/balances
 * 批量获取多个地址的 USDT 余额（可选认证）
 */
router.post('/balances', optionalAuth, getMultipleBalances);

export default router;


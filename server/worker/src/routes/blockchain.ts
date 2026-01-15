import { Hono } from 'hono';
import { getBalance, sendUSDT, getTransaction, getMultipleBalances } from '../controllers/blockchainController.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { Env } from '../types.js';

const router = new Hono<{ Bindings: Env }>();

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

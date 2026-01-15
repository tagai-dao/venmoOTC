import { Hono } from 'hono';
import { getTransactions, createTransaction, updateTransaction, selectTrader } from '../controllers/transactionController.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { Env } from '../types.js';

const router = new Hono<{ Bindings: Env }>();

/**
 * GET /api/transactions
 * 获取交易列表（公开，但可选认证）
 */
router.get('/', optionalAuth, getTransactions);

/**
 * POST /api/transactions
 * 创建新交易（需要认证）
 */
router.post('/', authenticateToken, createTransaction);

/**
 * PUT /api/transactions/:id
 * 更新交易（需要认证）
 */
router.put('/:id', authenticateToken, updateTransaction);

/**
 * POST /api/transactions/:id/select-trader
 * 选择交易者（从抢单列表中选择）
 */
router.post('/:id/select-trader', authenticateToken, selectTrader);

export default router;

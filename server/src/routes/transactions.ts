import express from 'express';
import { getTransactions, createTransaction, updateTransaction } from '../controllers/transactionController.js';

const router = express.Router();

/**
 * GET /api/transactions
 * 获取交易列表
 */
router.get('/', getTransactions);

/**
 * POST /api/transactions
 * 创建新交易
 */
router.post('/', createTransaction);

/**
 * PUT /api/transactions/:id
 * 更新交易
 */
router.put('/:id', updateTransaction);

export default router;


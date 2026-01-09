import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createBid,
  getBids,
  deleteBid,
} from '../controllers/bidController.js';

const router = express.Router();

/**
 * POST /api/bids/:transactionId
 * 创建抢单
 */
router.post('/:transactionId', authenticateToken, createBid);

/**
 * GET /api/bids/:transactionId
 * 获取交易的所有抢单
 */
router.get('/:transactionId', authenticateToken, getBids);

/**
 * DELETE /api/bids/:bidId
 * 删除抢单
 */
router.delete('/:bidId', authenticateToken, deleteBid);

export default router;

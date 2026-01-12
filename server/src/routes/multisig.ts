import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  recordMultisigOrder,
  recordSignature,
  getMultisigInfo
} from '../controllers/multisigController.js';

const router = express.Router();

/**
 * POST /api/multisig/record-order
 * 记录链上创建的多签订单
 */
router.post('/record-order', authenticateToken, recordMultisigOrder);

/**
 * POST /api/multisig/record-signature
 * 记录多签签名
 */
router.post('/record-signature', authenticateToken, recordSignature);

/**
 * GET /api/multisig/:transactionId
 * 获取多签合约信息
 */
router.get('/:transactionId', authenticateToken, getMultisigInfo);

export default router;

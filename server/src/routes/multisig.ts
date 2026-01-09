import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createMultisigContract,
  sendUSDTToMultisig,
  activateMultisig,
  getMultisig,
  signMultisigByTrader,
  signMultisigByRequester,
} from '../controllers/multisigController.js';

const router = express.Router();

/**
 * POST /api/multisig/create
 * 创建多签合约
 */
router.post('/create', authenticateToken, createMultisigContract);

/**
 * POST /api/multisig/send-usdt
 * 发送 USDT 到多签合约
 */
router.post('/send-usdt', authenticateToken, sendUSDTToMultisig);

/**
 * POST /api/multisig/sign-trader
 * 交易者签名多签合约
 */
router.post('/sign-trader', authenticateToken, signMultisigByTrader);

/**
 * POST /api/multisig/sign-requester
 * 请求者签名多签合约
 */
router.post('/sign-requester', authenticateToken, signMultisigByRequester);

/**
 * POST /api/multisig/activate
 * 激活多签合约（释放 USDT）
 */
router.post('/activate', authenticateToken, activateMultisig);

/**
 * GET /api/multisig/:transactionId
 * 获取多签合约信息
 */
router.get('/:transactionId', authenticateToken, getMultisig);

export default router;

import express from 'express';
import { getBalance, sendUSDT } from '../controllers/blockchainController.js';

const router = express.Router();

/**
 * GET /api/blockchain/balance/:address/:currency
 * 获取钱包余额
 */
router.get('/balance/:address/:currency', getBalance);

/**
 * POST /api/blockchain/send
 * 发送 USDT
 */
router.post('/send', sendUSDT);

export default router;


import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { BidRepository } from '../db/repositories/bidRepository.js';
import { TransactionRepository } from '../db/repositories/transactionRepository.js';
import { OTCState } from '../types.js';

/**
 * 创建抢单
 */
export const createBid = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { transactionId } = req.params;
    const { message } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    // 检查交易是否存在
    const transaction = await TransactionRepository.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // 检查交易状态是否允许抢单（必须是 OPEN_REQUEST 或 BIDDING）
    if (transaction.otcState !== OTCState.OPEN_REQUEST && transaction.otcState !== OTCState.BIDDING) {
      return res.status(400).json({ error: 'Transaction is not open for bidding' });
    }

    // 检查是否已经抢单
    const hasBid = await BidRepository.hasUserBid(transactionId, userId);
    if (hasBid) {
      return res.status(400).json({ error: 'You have already bid on this transaction' });
    }

    // 不能对自己的请求抢单
    if (transaction.fromUser.id === userId) {
      return res.status(400).json({ error: 'You cannot bid on your own request' });
    }

    // 创建抢单
    const bid = await BidRepository.create({
      transactionId,
      userId,
      message: message || undefined,
      timestamp: Date.now(),
    });

    // 如果交易状态是 OPEN_REQUEST，更新为 BIDDING
    if (transaction.otcState === OTCState.OPEN_REQUEST) {
      await TransactionRepository.update(transactionId, {
        otcState: OTCState.BIDDING,
      });
    }

    res.status(201).json({ bid });
  } catch (error: any) {
    console.error('Create bid error:', error);
    res.status(500).json({ error: error.message || 'Failed to create bid' });
  }
};

/**
 * 获取交易的所有抢单
 */
export const getBids = async (req: AuthRequest, res: Response) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const bids = await BidRepository.findByTransactionId(transactionId);
    res.json({ bids });
  } catch (error: any) {
    console.error('Get bids error:', error);
    res.status(500).json({ error: error.message || 'Failed to get bids' });
  }
};

/**
 * 删除抢单
 */
export const deleteBid = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { bidId } = req.params;

    const success = await BidRepository.delete(bidId, userId);
    if (!success) {
      return res.status(404).json({ error: 'Bid not found or not authorized' });
    }

    res.json({ message: 'Bid deleted' });
  } catch (error: any) {
    console.error('Delete bid error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete bid' });
  }
};

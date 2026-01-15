import { Context } from 'hono';
import { D1Adapter } from '../db/d1Adapter.js';
import { BidRepository } from '../db/repositories/bidRepository.js';
import { TransactionRepository } from '../db/repositories/transactionRepository.js';
import { UserRepository } from '../db/repositories/userRepository.js';
import { AuthContext } from '../middleware/auth.js';
import { Env, OTCState } from '../types.js';

/**
 * 创建抢单
 */
export const createBid = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const userId = c.user?.userId;
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const transactionId = c.req.param('transactionId');
    const body = await c.req.json();
    const { message } = body;

    if (!transactionId) {
      return c.json({ error: 'Transaction ID is required' }, 400);
    }

    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const transactionRepo = new TransactionRepository(db, userRepo);
    const bidRepo = new BidRepository(db, userRepo);

    // 检查交易是否存在
    const transaction = await transactionRepo.findById(transactionId);
    if (!transaction) {
      return c.json({ error: 'Transaction not found' }, 404);
    }

    // 检查交易状态是否允许抢单
    if (transaction.otcState !== OTCState.OPEN_REQUEST && transaction.otcState !== OTCState.BIDDING) {
      return c.json({ error: 'Transaction is not open for bidding' }, 400);
    }

    // 检查是否已经抢单
    const hasBid = await bidRepo.hasUserBid(transactionId, userId);
    if (hasBid) {
      return c.json({ error: 'You have already bid on this transaction' }, 400);
    }

    // 不能对自己的请求抢单
    if (transaction.fromUser.id === userId) {
      return c.json({ error: 'You cannot bid on your own request' }, 400);
    }

    // 获取用户信息
    const user = await userRepo.findById(userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // 创建抢单
    const bid = await bidRepo.create({
      transactionId,
      userId,
      user,
      message: message || undefined,
      timestamp: Date.now(),
    });

    // 如果交易状态是 OPEN_REQUEST，更新为 BIDDING
    if (transaction.otcState === OTCState.OPEN_REQUEST) {
      await transactionRepo.update(transactionId, {
        otcState: OTCState.BIDDING,
      });
    }

    return c.json({ bid }, 201);
  } catch (error: any) {
    console.error('Create bid error:', error);
    return c.json({ error: error.message || 'Failed to create bid' }, 500);
  }
};

/**
 * 获取交易的所有抢单
 */
export const getBids = async (c: Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const transactionId = c.req.param('transactionId');

    if (!transactionId) {
      return c.json({ error: 'Transaction ID is required' }, 400);
    }

    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const bidRepo = new BidRepository(db, userRepo);
    const bids = await bidRepo.findByTransactionId(transactionId);
    
    return c.json({ bids });
  } catch (error: any) {
    console.error('Get bids error:', error);
    return c.json({ error: error.message || 'Failed to get bids' }, 500);
  }
};

/**
 * 删除抢单
 */
export const deleteBid = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const userId = c.user?.userId;
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const bidId = c.req.param('bidId');

    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const bidRepo = new BidRepository(db, userRepo);
    const success = await bidRepo.delete(bidId, userId);
    
    if (!success) {
      return c.json({ error: 'Bid not found or not authorized' }, 404);
    }

    return c.json({ message: 'Bid deleted' });
  } catch (error: any) {
    console.error('Delete bid error:', error);
    return c.json({ error: error.message || 'Failed to delete bid' }, 500);
  }
};

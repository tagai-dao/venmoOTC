import { Response } from 'express';
import { CreateTransactionRequest, UpdateTransactionRequest, TransactionType, Privacy, OTCState } from '../types.js';
import { TransactionRepository } from '../db/repositories/transactionRepository.js';
import { AuthRequest } from '../middleware/auth.js';
import { NotificationService } from '../services/notificationService.js';
import { TwitterService } from '../services/twitterService.js';

/**
 * 获取交易列表
 */
export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, type, privacy } = req.query;
    
    const filters = {
      userId: userId ? String(userId) : undefined,
      type: type ? type as TransactionType : undefined,
      privacy: privacy ? privacy as Privacy : undefined,
    };
    
    const transactions = await TransactionRepository.findAll(filters);
    
    res.json({ transactions });
  } catch (error: any) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: error.message || 'Failed to get transactions' });
  }
};

/**
 * 创建新交易
 */
export const createTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const { transaction } = req.body as CreateTransactionRequest;
    
    if (!transaction) {
      return res.status(400).json({ error: 'Transaction is required' });
    }
    
    console.log('📝 Creating transaction:', JSON.stringify({
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      isOTC: transaction.isOTC,
      privacy: transaction.privacy,
    }));
    
    const newTransaction = await TransactionRepository.create(transaction);
    console.log('✅ Transaction created:', newTransaction.id);
    
    // 如果隐私设置为 PUBLIC_X，发布到 Twitter
    if (newTransaction.privacy === Privacy.PUBLIC_X) {
      try {
        console.log('🐦 Generating tweet content...');
        const tweetContent = TwitterService.generateTweetContent(newTransaction);
        console.log('📝 Tweet content:', tweetContent);
        
        const tweetResult = await TwitterService.postTweet(tweetContent);
        
        // 更新交易，保存推文 ID
        await TransactionRepository.update(newTransaction.id, {
          xPostId: tweetResult.tweetId,
        });
        
        console.log(`✅ Transaction posted to Twitter: ${tweetResult.tweetId}`);
      } catch (error: any) {
        // 如果 Twitter 发布失败，记录错误但不阻止交易创建
        console.error('❌ Failed to post transaction to Twitter:', error.message);
        console.error('Error details:', error);
        // 继续执行，不阻止交易创建
      }
    }
    
    // 创建通知（使用 try-catch 确保通知失败不会影响交易创建）
    try {
      // 1. 如果是 REQUEST，通知目标用户
      if (newTransaction.type === TransactionType.REQUEST) {
        await NotificationService.notifyRequestCreated(newTransaction);
      }
      // 2. 如果是 PAYMENT，通知收款人
      else if (newTransaction.type === TransactionType.PAYMENT && newTransaction.toUser) {
        await NotificationService.notifyPaymentReceived(newTransaction);
      }
    } catch (error: any) {
      console.error('❌ Failed to create notification:', error.message);
      // 通知失败不影响交易创建
    }
    
    // 重新获取交易（包含更新的 xPostId）
    const updatedTransaction = await TransactionRepository.findById(newTransaction.id);
    
    res.status(201).json({ transaction: updatedTransaction || newTransaction });
  } catch (error: any) {
    console.error('❌ Create transaction error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Failed to create transaction',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * 更新交易
 */
export const updateTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { updates } = req.body as UpdateTransactionRequest;
    
    // 获取旧交易状态（用于检测状态变化）
    const oldTransaction = await TransactionRepository.findById(id);
    const oldState = oldTransaction?.otcState;
    
    const transaction = await TransactionRepository.update(id, updates);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // 如果状态发生变化，创建通知
    if (oldState !== undefined && transaction.otcState !== oldState) {
      await NotificationService.notifyRequestStateChanged(transaction, oldState, transaction.otcState);
    }
    
    res.json({ transaction });
  } catch (error: any) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to update transaction' });
  }
};

/**
 * 选择交易者（从抢单列表中选择）
 */
export const selectTrader = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { traderId } = req.body;

    if (!traderId) {
      return res.status(400).json({ error: 'Trader ID is required' });
    }

    // 检查交易是否存在
    const transaction = await TransactionRepository.findById(id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // 检查是否是请求发起者
    if (transaction.fromUser.id !== userId) {
      return res.status(403).json({ error: 'Only the requester can select a trader' });
    }

    // 检查交易状态
    if (transaction.otcState !== OTCState.BIDDING && transaction.otcState !== OTCState.OPEN_REQUEST) {
      return res.status(400).json({ error: 'Transaction must be in BIDDING or OPEN_REQUEST state' });
    }

    // 更新交易：选择交易者并更新状态
    const updatedTransaction = await TransactionRepository.update(id, {
      selectedTraderId: traderId,
      otcState: OTCState.SELECTED_TRADER,
    });

    if (!updatedTransaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // 创建通知
    await NotificationService.notifyRequestStateChanged(transaction, transaction.otcState, OTCState.SELECTED_TRADER);

    res.json({ transaction: updatedTransaction });
  } catch (error: any) {
    console.error('Select trader error:', error);
    res.status(500).json({ error: error.message || 'Failed to select trader' });
  }
};


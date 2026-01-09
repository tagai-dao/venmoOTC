import { Response } from 'express';
import { CreateTransactionRequest, UpdateTransactionRequest, TransactionType, Privacy, OTCState } from '../types.js';
import { TransactionRepository } from '../db/repositories/transactionRepository.js';
import { AuthRequest } from '../middleware/auth.js';
import { NotificationService } from '../services/notificationService.js';

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
    
    const newTransaction = await TransactionRepository.create(transaction);
    
    // 创建通知
    // 1. 如果是 REQUEST，通知目标用户
    if (newTransaction.type === TransactionType.REQUEST) {
      await NotificationService.notifyRequestCreated(newTransaction);
    }
    // 2. 如果是 PAYMENT，通知收款人
    else if (newTransaction.type === TransactionType.PAYMENT && newTransaction.toUser) {
      await NotificationService.notifyPaymentReceived(newTransaction);
    }
    
    res.status(201).json({ transaction: newTransaction });
  } catch (error: any) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to create transaction' });
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


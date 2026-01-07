import { Request, Response } from 'express';
import { CreateTransactionRequest, UpdateTransactionRequest, Transaction } from '../types.js';
import { mockTransactions, generateTransactionId } from '../mockData.js';

// 使用 mock 数据初始化（生产环境应使用数据库）
let transactions: Transaction[] = [...mockTransactions];

/**
 * 获取交易列表
 */
export const getTransactions = async (req: Request, res: Response) => {
  try {
    const { userId, type, privacy } = req.query;
    
    let filteredTransactions = [...transactions];
    
    if (userId) {
      filteredTransactions = filteredTransactions.filter(
        t => t.fromUser.id === userId || t.toUser?.id === userId
      );
    }
    
    if (type) {
      filteredTransactions = filteredTransactions.filter(t => t.type === type);
    }
    
    if (privacy) {
      filteredTransactions = filteredTransactions.filter(t => t.privacy === privacy);
    }
    
    // 按时间戳倒序排序
    filteredTransactions.sort((a, b) => b.timestamp - a.timestamp);
    
    res.json({ transactions: filteredTransactions });
  } catch (error: any) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: error.message || 'Failed to get transactions' });
  }
};

/**
 * 创建新交易
 */
export const createTransaction = async (req: Request, res: Response) => {
  try {
    const { transaction } = req.body as CreateTransactionRequest;
    
    if (!transaction) {
      return res.status(400).json({ error: 'Transaction is required' });
    }
    
    const newTransaction: Transaction = {
      ...transaction,
      id: generateTransactionId(),
      timestamp: Date.now(),
    };
    
    transactions.unshift(newTransaction);
    
    res.status(201).json({ transaction: newTransaction });
  } catch (error: any) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to create transaction' });
  }
};

/**
 * 更新交易
 */
export const updateTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { updates } = req.body as UpdateTransactionRequest;
    
    const index = transactions.findIndex(t => t.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const transaction = transactions[index];
    
    // 处理回复
    if (updates.newReply) {
      const replies = transaction.replies || [];
      transaction.replies = [...replies, updates.newReply];
      transaction.comments = (transaction.comments || 0) + 1;
    }
    
    // 更新其他字段
    Object.assign(transaction, updates);
    delete (transaction as any).newReply;
    
    transactions[index] = transaction;
    
    res.json({ transaction });
  } catch (error: any) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to update transaction' });
  }
};


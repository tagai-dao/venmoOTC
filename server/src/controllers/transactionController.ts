import { Request, Response } from 'express';
import { CreateTransactionRequest, UpdateTransactionRequest, TransactionType, Privacy } from '../types.js';
import { TransactionRepository } from '../db/repositories/transactionRepository.js';

/**
 * 获取交易列表
 */
export const getTransactions = async (req: Request, res: Response) => {
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
export const createTransaction = async (req: Request, res: Response) => {
  try {
    const { transaction } = req.body as CreateTransactionRequest;
    
    if (!transaction) {
      return res.status(400).json({ error: 'Transaction is required' });
    }
    
    const newTransaction = await TransactionRepository.create(transaction);
    
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
    
    const transaction = await TransactionRepository.update(id, updates);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json({ transaction });
  } catch (error: any) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to update transaction' });
  }
};


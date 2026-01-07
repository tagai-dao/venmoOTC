import { Request, Response } from 'express';
import { Currency } from '../types.js';
import { generateTxHash } from '../mockData.js';
import { WalletBalanceRepository } from '../db/repositories/walletBalanceRepository.js';

/**
 * 获取钱包余额
 * 从数据库读取余额
 */
export const getBalance = async (req: Request, res: Response) => {
  try {
    const { address, currency } = req.params;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }
    
    console.log(`📊 Querying balance for ${address}, currency: ${currency}`);
    
    const currencyEnum = currency as Currency;
    const balance = await WalletBalanceRepository.getBalance(address, currencyEnum);
    
    res.json({ 
      balance, 
      currency: currencyEnum, 
      address,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: error.message || 'Failed to get balance' });
  }
};

/**
 * 发送 USDT
 * 使用 Mock 数据模拟交易
 */
export const sendUSDT = async (req: Request, res: Response) => {
  try {
    const { toAddress, amount, fromAddress } = req.body;
    
    if (!toAddress || !amount || !fromAddress) {
      return res.status(400).json({ error: 'toAddress, amount, and fromAddress are required' });
    }
    
    console.log(`⛓️ Initiating Transaction on BNB Chain`);
    console.log(`💸 Transfer ${amount} USDT from ${fromAddress} to ${toAddress}`);
    
    // 模拟交易确认时间
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 生成模拟交易哈希
    const txHash = generateTxHash();
    
    console.log(`✅ Transaction Confirmed! Hash: ${txHash}`);
    
    res.json({ 
      txHash, 
      toAddress, 
      amount, 
      fromAddress,
      status: 'confirmed',
      blockNumber: Math.floor(Math.random() * 10000000),
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Send USDT error:', error);
    res.status(500).json({ error: error.message || 'Failed to send USDT' });
  }
};


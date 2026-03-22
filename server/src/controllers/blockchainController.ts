import { Request, Response } from 'express';
import { Currency } from '../types.js';
import { blockchainService, BlockchainService } from '../services/blockchainService.js';
import { WalletBalanceRepository } from '../db/repositories/walletBalanceRepository.js';

/**
 * 获取钱包余额
 * 从 BNB Chain 链上查询真实余额，并同步到数据库
 */
export const getBalance = async (req: Request, res: Response) => {
  try {
    const { address, currency } = req.params;
    
    if (!address) {
      return res.status(400).json({ error: { message: 'Address is required' } });
    }

    // 验证地址格式（使用静态方法）
    if (!BlockchainService.isValidAddress(address)) {
      return res.status(400).json({ error: { message: 'Invalid address format' } });
    }
    
    console.log(`📊 Querying balance for ${address}, currency: ${currency}`);
    
    if (currency && !Object.values(Currency).includes(currency as Currency) && currency !== 'BNB') {
      return res.status(400).json({ error: { message: `Invalid currency: ${currency}` } });
    }
    const currencyEnum = currency as Currency;
    let balance: number;

    // 根据货币类型查询余额
    if (currencyEnum === Currency.USDT) {
      // USDT: 从链上查询
      balance = await blockchainService.getUSDTBalance(address);
    } else if (currencyEnum === Currency.BNB || currency === 'BNB') {
      // BNB: 从链上查询原生代币余额
      balance = await blockchainService.getBNBBalance(address);
    } else {
      // 其他货币（NGN, VES, USD）: 从数据库读取（这些是法币，不在链上）
      balance = await WalletBalanceRepository.getBalance(address, currencyEnum);
    }
    
    res.json({ 
      balance, 
      currency: currencyEnum, 
      address,
      timestamp: Date.now(),
      source: currencyEnum === Currency.USDT ? 'blockchain' : 'database',
    });
  } catch (error: any) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: { message: error.message || 'Failed to get balance' } });
  }
};

/**
 * 发送 USDT
 * 在 BNB Chain 上执行真实的 USDT 转账
 */
export const sendUSDT = async (req: Request, res: Response) => {
  try {
    const { toAddress, amount, fromAddress } = req.body;
    
    if (!toAddress || !amount || !fromAddress) {
      return res.status(400).json({ error: { message: 'toAddress, amount, and fromAddress are required' } });
    }

    // 验证地址格式（使用静态方法）
    if (!BlockchainService.isValidAddress(fromAddress) || !BlockchainService.isValidAddress(toAddress)) {
      return res.status(400).json({ error: { message: 'Invalid address format' } });
    }

    // 验证金额
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: { message: 'Invalid amount' } });
    }
    
    console.log(`⛓️ Initiating Transaction on BNB Chain`);
    console.log(`💸 Transfer ${amount} USDT from ${fromAddress} to ${toAddress}`);
    
    // 执行真实的链上转账
    const result = await blockchainService.sendUSDT(fromAddress, toAddress, amount);
    
    console.log(`✅ Transaction Confirmed! Hash: ${result.txHash}`);
    
    res.json({ 
      txHash: result.txHash, 
      toAddress, 
      amount, 
      fromAddress,
      status: 'confirmed',
      blockNumber: result.blockNumber,
      timestamp: result.timestamp,
    });
  } catch (error: any) {
    console.error('Send USDT error:', error);
    res.status(500).json({ error: { message: error.message || 'Failed to send USDT' } });
  }
};

/**
 * 获取交易详情
 */
export const getTransaction = async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;
    
    if (!txHash) {
      return res.status(400).json({ error: { message: 'Transaction hash is required' } });
    }

    const tx = await blockchainService.getTransaction(txHash);
    const receipt = await blockchainService.getTransactionReceipt(txHash);
    
    if (!tx) {
      return res.status(404).json({ error: { message: 'Transaction not found' } });
    }
    
    res.json({
      transaction: tx,
      receipt: receipt,
      status: receipt ? 'confirmed' : 'pending',
    });
  } catch (error: any) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: { message: error.message || 'Failed to get transaction' } });
  }
};

/**
 * 批量获取余额
 */
export const getMultipleBalances = async (req: Request, res: Response) => {
  try {
    const { addresses } = req.body;
    
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: { message: 'addresses array is required' } });
    }

    // 验证所有地址（使用静态方法）
    const invalidAddresses = addresses.filter(addr => !BlockchainService.isValidAddress(addr));
    if (invalidAddresses.length > 0) {
      return res.status(400).json({ 
        error: { message: `Invalid addresses: ${invalidAddresses.join(', ')}` } 
      });
    }

    const balances = await blockchainService.getMultipleUSDTBalances(addresses);
    
    res.json({
      balances,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Get multiple balances error:', error);
    res.status(500).json({ error: { message: error.message || 'Failed to get balances' } });
  }
};


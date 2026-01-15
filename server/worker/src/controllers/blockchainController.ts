import { Context } from 'hono';
import { Currency } from '../types.js';
import { D1Adapter } from '../db/d1Adapter.js';
import { BlockchainService } from '../services/blockchainService.js';
import { WalletBalanceRepository } from '../db/repositories/walletBalanceRepository.js';
import { AuthContext } from '../middleware/auth.js';
import { Env } from '../types.js';

/**
 * 获取钱包余额
 */
export const getBalance = async (c: Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const address = c.req.param('address');
    const currency = c.req.param('currency');
    
    if (!address) {
      return c.json({ error: { message: 'Address is required' } }, 400);
    }

    if (!BlockchainService.isValidAddress(address)) {
      return c.json({ error: { message: 'Invalid address format' } }, 400);
    }
    
    console.log(`📊 Querying balance for ${address}, currency: ${currency}`);
    
    const db = new D1Adapter(c.env.DB);
    const walletBalanceRepo = new WalletBalanceRepository(db);
    const blockchainService = new BlockchainService(c.env, walletBalanceRepo);
    
    const currencyEnum = currency as Currency;
    let balance: number;

    if (currencyEnum === Currency.USDT) {
      balance = await blockchainService.getUSDTBalance(address);
    } else if (currencyEnum === Currency.BNB || currency === 'BNB') {
      balance = await blockchainService.getBNBBalance(address);
    } else {
      balance = await walletBalanceRepo.getBalance(address, currencyEnum);
    }
    
    return c.json({ 
      balance, 
      currency: currencyEnum, 
      address,
      timestamp: Date.now(),
      source: currencyEnum === Currency.USDT ? 'blockchain' : 'database',
    });
  } catch (error: any) {
    console.error('Get balance error:', error);
    return c.json({ error: { message: error.message || 'Failed to get balance' } }, 500);
  }
};

/**
 * 发送 USDT
 */
export const sendUSDT = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { toAddress, amount, fromAddress } = body;
    
    if (!toAddress || !amount || !fromAddress) {
      return c.json({ error: { message: 'toAddress, amount, and fromAddress are required' } }, 400);
    }

    if (!BlockchainService.isValidAddress(fromAddress) || !BlockchainService.isValidAddress(toAddress)) {
      return c.json({ error: { message: 'Invalid address format' } }, 400);
    }

    if (isNaN(amount) || amount <= 0) {
      return c.json({ error: { message: 'Invalid amount' } }, 400);
    }
    
    console.log(`⛓️ Initiating Transaction on BNB Chain`);
    console.log(`💸 Transfer ${amount} USDT from ${fromAddress} to ${toAddress}`);
    
    const db = new D1Adapter(c.env.DB);
    const walletBalanceRepo = new WalletBalanceRepository(db);
    const blockchainService = new BlockchainService(c.env, walletBalanceRepo);
    
    const result = await blockchainService.sendUSDT(fromAddress, toAddress, amount);
    
    console.log(`✅ Transaction Confirmed! Hash: ${result.txHash}`);
    
    return c.json({ 
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
    return c.json({ error: { message: error.message || 'Failed to send USDT' } }, 500);
  }
};

/**
 * 获取交易详情
 */
export const getTransaction = async (c: Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const txHash = c.req.param('txHash');
    
    if (!txHash) {
      return c.json({ error: { message: 'Transaction hash is required' } }, 400);
    }

    const db = new D1Adapter(c.env.DB);
    const walletBalanceRepo = new WalletBalanceRepository(db);
    const blockchainService = new BlockchainService(c.env, walletBalanceRepo);
    
    const tx = await blockchainService.getTransaction(txHash);
    const receipt = await blockchainService.getTransactionReceipt(txHash);
    
    if (!tx) {
      return c.json({ error: { message: 'Transaction not found' } }, 404);
    }
    
    return c.json({
      transaction: {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value?.toString(),
        data: tx.data,
        blockNumber: tx.blockNumber,
        blockHash: tx.blockHash,
        transactionIndex: tx.index,
      },
      receipt: receipt ? {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed?.toString(),
        status: receipt.status,
      } : null,
      status: receipt ? 'confirmed' : 'pending',
    });
  } catch (error: any) {
    console.error('Get transaction error:', error);
    return c.json({ error: { message: error.message || 'Failed to get transaction' } }, 500);
  }
};

/**
 * 批量获取余额
 */
export const getMultipleBalances = async (c: Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { addresses } = body;
    
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return c.json({ error: { message: 'addresses array is required' } }, 400);
    }

    const invalidAddresses = addresses.filter(addr => !BlockchainService.isValidAddress(addr));
    if (invalidAddresses.length > 0) {
      return c.json({ 
        error: { message: `Invalid addresses: ${invalidAddresses.join(', ')}` } 
      }, 400);
    }

    const db = new D1Adapter(c.env.DB);
    const walletBalanceRepo = new WalletBalanceRepository(db);
    const blockchainService = new BlockchainService(c.env, walletBalanceRepo);
    
    const balances = await blockchainService.getMultipleUSDTBalances(addresses);
    
    return c.json({
      balances,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Get multiple balances error:', error);
    return c.json({ error: { message: error.message || 'Failed to get balances' } }, 500);
  }
};

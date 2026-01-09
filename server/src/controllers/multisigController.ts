import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { MultisigRepository } from '../db/repositories/multisigRepository.js';
import { TransactionRepository } from '../db/repositories/transactionRepository.js';
import { WalletBalanceRepository } from '../db/repositories/walletBalanceRepository.js';
import { OTCState, Currency } from '../types.js';
import { generateTxHash } from '../mockData.js';

/**
 * 创建多签合约（模拟）
 */
export const createMultisigContract = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { transactionId, traderAddress, usdtAmount } = req.body;

    if (!transactionId || !traderAddress || !usdtAmount) {
      return res.status(400).json({ error: 'Transaction ID, trader address, and USDT amount are required' });
    }

    // 检查交易是否存在
    const transaction = await TransactionRepository.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // 判断是法币 Request 还是 USDT Request
    const isFiatRequest = transaction.currency !== Currency.USDT;
    
    if (isFiatRequest) {
      // 法币 Request：只有请求发起者可以创建多签合约
      if (transaction.fromUser.id !== userId) {
        return res.status(403).json({ error: 'Only the requester can create multisig contract' });
      }

      // 检查交易状态
      if (transaction.otcState !== OTCState.SELECTED_TRADER) {
        return res.status(400).json({ error: 'Transaction must be in SELECTED_TRADER state' });
      }
    } else {
      // USDT Request：支付者可以创建多签合约
      // 检查是否是支付者（不能是请求发起者自己）
      if (transaction.fromUser.id === userId) {
        return res.status(403).json({ error: 'Requester cannot pay their own request' });
      }

      // 检查交易状态
      if (transaction.otcState !== OTCState.OPEN_REQUEST) {
        return res.status(400).json({ error: 'Transaction must be in OPEN_REQUEST state' });
      }

      // 检查是否已经有人支付（通过检查 toUser 或 selectedTraderId）
      if (transaction.toUser || transaction.selectedTraderId) {
        return res.status(400).json({ error: 'This request has already been paid' });
      }
    }

    // 模拟创建多签合约地址
    const contractAddress = `0x${Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    // 创建多签合约记录
    // 对于法币 Request：requesterAddress 是请求者，traderAddress 是交易者
    // 对于 USDT Request：requesterAddress 是请求者（发布者），traderAddress 是支付者
    const multisig = await MultisigRepository.create(
      transactionId,
      contractAddress,
      transaction.fromUser.walletAddress, // 请求者的钱包地址
      traderAddress, // 交易者/支付者的钱包地址
      usdtAmount
    );

    // 更新交易状态和合约地址
    if (isFiatRequest) {
      // 法币 Request：状态变为 USDT_IN_ESCROW
      await TransactionRepository.update(transactionId, {
        multisigContractAddress: contractAddress,
        otcState: OTCState.USDT_IN_ESCROW,
      });
    } else {
      // USDT Request：状态变为 USDT_IN_ESCROW（USDT 已在多签合约中）
      await TransactionRepository.update(transactionId, {
        multisigContractAddress: contractAddress,
        selectedTraderId: userId, // 设置支付者为选中的交易者
        otcState: OTCState.USDT_IN_ESCROW,
      });
    }

    res.status(201).json({ 
      multisig,
      message: 'Multisig contract created. Please send USDT to the contract address.',
    });
  } catch (error: any) {
    console.error('Create multisig contract error:', error);
    res.status(500).json({ error: error.message || 'Failed to create multisig contract' });
  }
};

/**
 * 发送 USDT 到多签合约（模拟）
 */
export const sendUSDTToMultisig = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    // 检查交易是否存在
    const transaction = await TransactionRepository.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // 判断是法币 Request 还是 USDT Request
    const isFiatRequest = transaction.currency !== Currency.USDT;
    
    if (isFiatRequest) {
      // 法币 Request：只有请求发起者可以发送 USDT 到多签合约
      if (transaction.fromUser.id !== userId) {
        return res.status(403).json({ error: 'Only the requester can send USDT to multisig' });
      }
    } else {
      // USDT Request：支付者可以发送 USDT 到多签合约
      // 检查是否是支付者（selectedTraderId 应该是当前用户）
      if (transaction.selectedTraderId !== userId) {
        return res.status(403).json({ error: 'Only the payer can send USDT to multisig' });
      }
    }

    // 检查交易状态
    if (transaction.otcState !== OTCState.USDT_IN_ESCROW) {
      return res.status(400).json({ error: 'Transaction must be in USDT_IN_ESCROW state' });
    }

    // 检查多签合约是否存在
    const multisig = await MultisigRepository.findByTransactionId(transactionId);
    if (!multisig) {
      return res.status(404).json({ error: 'Multisig contract not found' });
    }

    // 确定发送者的钱包地址
    const senderAddress = isFiatRequest 
      ? transaction.fromUser.walletAddress  // 法币 Request：请求者发送
      : multisig.traderAddress;  // USDT Request：支付者发送
    
    // 实际发送 USDT 到多签合约（从发送者的钱包地址发送到多签合约地址）
    // 这是 2/2 多签合约，由请求者和支付者/交易者共同控制
    console.log(`⛓️ Sending ${multisig.usdtAmount} USDT from ${senderAddress} to multisig contract ${multisig.contractAddress}`);
    console.log(`📝 Multisig contract controlled by: ${multisig.requesterAddress} (requester) and ${multisig.traderAddress} (payer/trader)`);
    
    // 检查发送者钱包余额
    const currentBalance = await WalletBalanceRepository.getBalance(
      senderAddress,
      Currency.USDT
    );
    
    if (currentBalance < multisig.usdtAmount) {
      return res.status(400).json({ 
        error: `Insufficient balance. Required: ${multisig.usdtAmount} USDT, Available: ${currentBalance} USDT` 
      });
    }
    
    // 模拟交易确认时间
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 生成模拟交易哈希
    const txHash = generateTxHash();
    
    // 更新发送者的钱包余额（扣除 USDT）
    await WalletBalanceRepository.subtractBalance(
      senderAddress,
      Currency.USDT,
      multisig.usdtAmount
    );
    
    console.log(`✅ USDT sent to multisig contract! Hash: ${txHash}`);
    console.log(`💰 ${multisig.usdtAmount} USDT is now in escrow, controlled by 2/2 multisig (requester + payer/trader)`);
    console.log(`💳 Sender balance updated: ${currentBalance} -> ${currentBalance - multisig.usdtAmount} USDT`);

    // 更新交易状态
    await TransactionRepository.update(transactionId, {
      usdtInEscrow: true,
      otcState: OTCState.AWAITING_FIAT_PAYMENT,
    });

    res.json({ 
      txHash,
      contractAddress: multisig.contractAddress,
      message: 'USDT sent to multisig contract successfully',
    });
  } catch (error: any) {
    console.error('Send USDT to multisig error:', error);
    res.status(500).json({ error: error.message || 'Failed to send USDT to multisig' });
  }
};

/**
 * 交易者签名多签合约（在支付法币并发布回复后）
 */
export const signMultisigByTrader = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    // 检查交易是否存在
    const transaction = await TransactionRepository.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // 检查是否是所选交易者
    if (transaction.selectedTraderId !== userId) {
      return res.status(403).json({ error: 'Only the selected trader can sign the multisig contract' });
    }

    // 检查多签合约是否存在
    const multisig = await MultisigRepository.findByTransactionId(transactionId);
    if (!multisig) {
      return res.status(404).json({ error: 'Multisig contract not found' });
    }

    if (multisig.traderSigned) {
      return res.status(400).json({ error: 'Multisig contract already signed by trader' });
    }

    // 交易者签名
    await MultisigRepository.signByTrader(transactionId);
    console.log(`✍️ Trader signed multisig contract for transaction ${transactionId}`);

    res.json({ 
      message: 'Multisig contract signed by trader successfully',
    });
  } catch (error: any) {
    console.error('Sign multisig by trader error:', error);
    res.status(500).json({ error: error.message || 'Failed to sign multisig contract' });
  }
};

/**
 * 请求者签名多签合约（在确认收到法币后）
 */
export const signMultisigByRequester = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    // 检查交易是否存在
    const transaction = await TransactionRepository.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // 检查是否是请求发起者
    if (transaction.fromUser.id !== userId) {
      return res.status(403).json({ error: 'Only the requester can sign the multisig contract' });
    }

    // 检查多签合约是否存在
    const multisig = await MultisigRepository.findByTransactionId(transactionId);
    if (!multisig) {
      return res.status(404).json({ error: 'Multisig contract not found' });
    }

    if (multisig.requesterSigned) {
      return res.status(400).json({ error: 'Multisig contract already signed by requester' });
    }

    // 请求者签名
    await MultisigRepository.signByRequester(transactionId);
    console.log(`✍️ Requester signed multisig contract for transaction ${transactionId}`);

    // 检查是否两个签名都已完成，如果是，则自动激活多签合约
    const areBothSigned = await MultisigRepository.areBothSigned(transactionId);
    if (areBothSigned && !multisig.isActivated) {
      // 两个签名都完成，激活多签合约并释放 USDT
      console.log(`🔓 Both signatures received! Activating multisig contract ${multisig.contractAddress}`);
      console.log(`💰 Releasing ${multisig.usdtAmount} USDT to ${multisig.traderAddress}`);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      const txHash = generateTxHash();
      console.log(`✅ Multisig activated! USDT released. Hash: ${txHash}`);

      // 激活多签合约
      await MultisigRepository.activate(transactionId);

      // 更新交易状态为完成
      await TransactionRepository.update(transactionId, {
        otcState: OTCState.COMPLETED,
      });

      // 将 USDT 从多签合约转移到交易者钱包
      await WalletBalanceRepository.addBalance(
        multisig.traderAddress,
        Currency.USDT,
        multisig.usdtAmount
      );

      res.json({ 
        txHash,
        message: 'Multisig contract signed and activated. USDT released to trader.',
      });
      return;
    }

    res.json({ 
      message: 'Multisig contract signed by requester. Waiting for trader signature.',
    });
  } catch (error: any) {
    console.error('Sign multisig by requester error:', error);
    res.status(500).json({ error: error.message || 'Failed to sign multisig contract' });
  }
};

/**
 * 激活多签合约（释放 USDT 给交易者）
 * 注意：现在这个函数主要用于兼容性，实际激活会在 requester 签名时自动完成
 */
export const activateMultisig = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    // 检查交易是否存在
    const transaction = await TransactionRepository.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // 检查是否是请求发起者
    if (transaction.fromUser.id !== userId) {
      return res.status(403).json({ error: 'Only the requester can activate multisig contract' });
    }

    // 检查交易状态
    if (transaction.otcState !== OTCState.AWAITING_FIAT_CONFIRMATION) {
      return res.status(400).json({ error: 'Transaction must be in AWAITING_FIAT_CONFIRMATION state' });
    }

    // 检查多签合约是否存在且未激活
    const multisig = await MultisigRepository.findByTransactionId(transactionId);
    if (!multisig) {
      return res.status(404).json({ error: 'Multisig contract not found' });
    }

    if (multisig.isActivated) {
      return res.status(400).json({ error: 'Multisig contract already activated' });
    }

    // 检查是否两个签名都已完成
    const areBothSigned = await MultisigRepository.areBothSigned(transactionId);
    if (!areBothSigned) {
      return res.status(400).json({ error: 'Both signatures are required to activate multisig contract' });
    }

    // 模拟激活多签合约（2/2 多签，需要双方签名）
    console.log(`🔓 Activating multisig contract ${multisig.contractAddress}`);
    console.log(`💰 Releasing ${multisig.usdtAmount} USDT to ${multisig.traderAddress}`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const txHash = generateTxHash();
    console.log(`✅ Multisig activated! USDT released. Hash: ${txHash}`);

    // 激活多签合约
    await MultisigRepository.activate(transactionId);

    // 更新交易状态为完成
    await TransactionRepository.update(transactionId, {
      otcState: OTCState.COMPLETED,
    });

    // 将 USDT 从多签合约转移到交易者钱包
    await WalletBalanceRepository.addBalance(
      multisig.traderAddress,
      Currency.USDT,
      multisig.usdtAmount
    );

    res.json({ 
      txHash,
      message: 'Multisig contract activated. USDT released to trader.',
    });
  } catch (error: any) {
    console.error('Activate multisig error:', error);
    res.status(500).json({ error: error.message || 'Failed to activate multisig contract' });
  }
};

/**
 * 获取多签合约信息
 */
export const getMultisig = async (req: AuthRequest, res: Response) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const multisig = await MultisigRepository.findByTransactionId(transactionId);
    if (!multisig) {
      return res.status(404).json({ error: 'Multisig contract not found' });
    }

    res.json({ multisig });
  } catch (error: any) {
    console.error('Get multisig error:', error);
    res.status(500).json({ error: error.message || 'Failed to get multisig contract' });
  }
};

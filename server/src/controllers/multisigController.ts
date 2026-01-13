import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { MultisigRepository } from '../db/repositories/multisigRepository.js';
import { TransactionRepository } from '../db/repositories/transactionRepository.js';
import { OTCState, Currency, TransactionType } from '../types.js';
import { config } from '../config.js';
import { NotificationService } from '../services/notificationService.js';

/**
 * 记录链上创建的多签订单
 */
export const recordMultisigOrder = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { transactionId, traderAddress, usdtAmount, onchainOrderId } = req.body;

    if (!transactionId || !traderAddress || !onchainOrderId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const transaction = await TransactionRepository.findById(transactionId);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    // 只有发起人可以创建订单（法币 Request）或参与人（USDT Request）
    // 逻辑根据前端调用决定，这里主要记录
    
    const contractAddress = config.blockchain.multisigContractAddress;

    const multisig = await MultisigRepository.create(
      transactionId,
      contractAddress,
      transaction.fromUser.walletAddress,
      traderAddress,
      parseFloat(usdtAmount),
      parseInt(onchainOrderId)
    );

    // 更新交易状态
    const updatedTransaction = await TransactionRepository.update(transactionId, {
      multisigContractAddress: contractAddress,
      otcState: OTCState.USDT_IN_ESCROW, // USDT 已存入合约
      usdtInEscrow: true
    });

    if (!updatedTransaction) {
      return res.status(404).json({ error: 'Transaction not found after update' });
    }

    // 发送通知给被选中的交易者：USDT 已存入多签合约，请支付法币并签名
    if (updatedTransaction.selectedTraderId) {
      await NotificationService.notifyUSDTInEscrow(updatedTransaction);
    }

    res.status(201).json({ multisig });
  } catch (error: any) {
    console.error('Record multisig order error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 记录多签签名
 */
export const recordSignature = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { transactionId, choice, paymentProofUrl } = req.body;

    const transaction = await TransactionRepository.findById(transactionId);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    const ms = await MultisigRepository.findByTransactionId(transactionId);
    if (!ms) return res.status(404).json({ error: 'Multisig record not found' });

    const isInitiator = transaction.fromUser.id === userId;
    const isCounterparty = transaction.selectedTraderId === userId;

    if (!isInitiator && !isCounterparty) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // 判断是否是 Request U（请求 USDT）
    const isRequestU = transaction.type === TransactionType.REQUEST && transaction.currency === Currency.USDT;

    const updates: any = {};
    if (isInitiator) {
      updates.initiatorChoice = choice;
      updates.initiatorSigned = true;
      // Request U：发起者支付法币，需要保存支付凭证
      if (isRequestU && paymentProofUrl) {
        updates.paymentProofUrl = paymentProofUrl;
        // 同步更新到 transaction 表
        await TransactionRepository.update(transactionId, { paymentProofUrl });
      }
    } else {
      updates.counterpartyChoice = choice;
      updates.counterpartySigned = true;
      // Request 法币：交易者支付法币，需要保存支付凭证
      if (!isRequestU && paymentProofUrl) {
        updates.paymentProofUrl = paymentProofUrl;
        // 同步更新到 transaction 表
        await TransactionRepository.update(transactionId, { paymentProofUrl });
      }
    }

    await MultisigRepository.update(transactionId, updates);

    // 检查是否达成一致
    const isAgreed = await MultisigRepository.isAgreed(transactionId);
    if (isAgreed) {
      // 如果一致，更新多签记录状态
      await MultisigRepository.update(transactionId, { 
        status: 'EXECUTED',
        isActivated: true 
      });
      // 更新交易状态为完成
      await TransactionRepository.update(transactionId, { otcState: OTCState.COMPLETED });
    } else {
      // 如果还没有达成一致，根据签名者和 Request 类型更新交易状态
      const currentTransaction = await TransactionRepository.findById(transactionId);
      
      if (isRequestU) {
        // Request U 场景：
        // - 发起者支付法币并签名（choice = 2），等待交易者确认
        // - 交易者确认收到法币并签名（choice = 2），完成交易
        if (isInitiator && updates.initiatorSigned && updates.initiatorChoice === 2) {
          // 发起者已支付法币并签名，等待交易者确认
          if (currentTransaction && 
              (currentTransaction.otcState === OTCState.USDT_IN_ESCROW || 
               currentTransaction.otcState === OTCState.AWAITING_FIAT_PAYMENT)) {
            await TransactionRepository.update(transactionId, { 
              otcState: OTCState.AWAITING_FIAT_CONFIRMATION 
            });
          }
        } else if (isInitiator && updates.initiatorSigned && updates.initiatorChoice === 1) {
          // 发起者申请退回资产（choice = 1），通知交易者
          if (currentTransaction && currentTransaction.selectedTraderId) {
            await NotificationService.notifyRefundRequested(currentTransaction);
          }
        }
        // 如果交易者签名但还没达成一致，状态保持不变（等待发起者签名）
      } else {
        // Request 法币场景：
        // - 交易者支付法币并签名（choice = 2），等待发起者确认
        // - 发起者确认收到法币并签名（choice = 2），完成交易
        if (isCounterparty && updates.counterpartySigned) {
          // 交易者已签名（通常意味着已支付法币并上传凭证），等待发起者确认
          // 只有当交易状态还是 USDT_IN_ESCROW 或 AWAITING_FIAT_PAYMENT 时才更新
          if (currentTransaction && 
              (currentTransaction.otcState === OTCState.USDT_IN_ESCROW || 
               currentTransaction.otcState === OTCState.AWAITING_FIAT_PAYMENT)) {
            await TransactionRepository.update(transactionId, { 
              otcState: OTCState.AWAITING_FIAT_CONFIRMATION 
            });
          }
        } else if (isInitiator && updates.initiatorSigned && updates.initiatorChoice === 1) {
          // 发起者申请退回资产（choice = 1），通知交易者
          if (currentTransaction && currentTransaction.selectedTraderId) {
            await NotificationService.notifyRefundRequested(currentTransaction);
          }
        }
        // 如果发起者签名但还没达成一致，状态保持不变（等待交易者签名）
      }
    }

    res.json({ message: 'Signature recorded', isAgreed });
  } catch (error: any) {
    console.error('Record signature error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 获取多签信息
 */
export const getMultisigInfo = async (req: AuthRequest, res: Response) => {
  try {
    const { transactionId } = req.params;
    const ms = await MultisigRepository.findByTransactionId(transactionId);
    if (!ms) return res.status(404).json({ error: 'Not found' });
    res.json({ multisig: ms });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

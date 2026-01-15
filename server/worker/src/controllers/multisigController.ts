import { Context } from 'hono';
import { D1Adapter } from '../db/d1Adapter.js';
import { MultisigRepository } from '../db/repositories/multisigRepository.js';
import { TransactionRepository } from '../db/repositories/transactionRepository.js';
import { UserRepository } from '../db/repositories/userRepository.js';
import { AuthContext } from '../middleware/auth.js';
import { Env, OTCState, Currency, TransactionType } from '../types.js';

/**
 * 记录链上创建的多签订单
 */
export const recordMultisigOrder = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const userId = c.user?.userId;
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { transactionId, traderAddress, usdtAmount, onchainOrderId } = body;

    if (!transactionId || !traderAddress || !onchainOrderId) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const transactionRepo = new TransactionRepository(db, userRepo);
    const multisigRepo = new MultisigRepository(db);

    const transaction = await transactionRepo.findById(transactionId);
    if (!transaction) {
      return c.json({ error: 'Transaction not found' }, 404);
    }

    const contractAddress = c.env.MULTISIG_CONTRACT_ADDRESS;

    const multisig = await multisigRepo.create(
      transactionId,
      contractAddress,
      transaction.fromUser.walletAddress,
      traderAddress,
      parseFloat(usdtAmount),
      parseInt(onchainOrderId)
    );

    // 更新交易状态
    const updatedTransaction = await transactionRepo.update(transactionId, {
      multisigContractAddress: contractAddress,
      otcState: OTCState.USDT_IN_ESCROW,
      usdtInEscrow: true
    });

    if (!updatedTransaction) {
      return c.json({ error: 'Transaction not found after update' }, 404);
    }

    // TODO: 发送通知给被选中的交易者

    return c.json({ multisig }, 201);
  } catch (error: any) {
    console.error('Record multisig order error:', error);
    return c.json({ error: error.message }, 500);
  }
};

/**
 * 记录多签签名（简化版，不包含通知功能）
 */
export const recordSignature = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const userId = c.user?.userId;
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { transactionId, choice, paymentProofUrl } = body;

    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const transactionRepo = new TransactionRepository(db, userRepo);
    const multisigRepo = new MultisigRepository(db);

    const transaction = await transactionRepo.findById(transactionId);
    if (!transaction) {
      return c.json({ error: 'Transaction not found' }, 404);
    }

    const ms = await multisigRepo.findByTransactionId(transactionId);
    if (!ms) {
      return c.json({ error: 'Multisig record not found' }, 404);
    }

    const isInitiator = transaction.fromUser.id === userId;
    const isCounterparty = transaction.selectedTraderId === userId;

    if (!isInitiator && !isCounterparty) {
      return c.json({ error: 'Not authorized' }, 403);
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
        await transactionRepo.update(transactionId, { paymentProofUrl });
      }
    } else {
      updates.counterpartyChoice = choice;
      updates.counterpartySigned = true;
      // Request 法币：交易者支付法币，需要保存支付凭证
      if (!isRequestU && paymentProofUrl) {
        updates.paymentProofUrl = paymentProofUrl;
        await transactionRepo.update(transactionId, { paymentProofUrl });
      }
    }

    await multisigRepo.update(transactionId, updates);

    // 检查是否达成一致
    const isAgreed = await multisigRepo.isAgreed(transactionId);
    if (isAgreed) {
      // 如果一致，更新多签记录状态
      await multisigRepo.update(transactionId, { 
        status: 'EXECUTED',
        isActivated: true 
      });
      // 更新交易状态为完成
      await transactionRepo.update(transactionId, { otcState: OTCState.COMPLETED });
    } else {
      // 如果还没有达成一致，根据签名者和 Request 类型更新交易状态
      const currentTransaction = await transactionRepo.findById(transactionId);
      
      if (isRequestU) {
        if (isInitiator && updates.initiatorSigned && updates.initiatorChoice === 2) {
          if (currentTransaction && 
              (currentTransaction.otcState === OTCState.USDT_IN_ESCROW || 
               currentTransaction.otcState === OTCState.AWAITING_FIAT_PAYMENT)) {
            await transactionRepo.update(transactionId, { 
              otcState: OTCState.AWAITING_FIAT_CONFIRMATION 
            });
          }
        }
      } else {
        if (isCounterparty && updates.counterpartySigned) {
          if (currentTransaction && 
              (currentTransaction.otcState === OTCState.USDT_IN_ESCROW || 
               currentTransaction.otcState === OTCState.AWAITING_FIAT_PAYMENT)) {
            await transactionRepo.update(transactionId, { 
              otcState: OTCState.AWAITING_FIAT_CONFIRMATION 
            });
          }
        }
      }
    }

    return c.json({ message: 'Signature recorded', isAgreed });
  } catch (error: any) {
    console.error('Record signature error:', error);
    return c.json({ error: error.message }, 500);
  }
};

/**
 * 获取多签信息
 */
export const getMultisigInfo = async (c: Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const transactionId = c.req.param('transactionId');
    const db = new D1Adapter(c.env.DB);
    const multisigRepo = new MultisigRepository(db);
    const ms = await multisigRepo.findByTransactionId(transactionId);
    
    if (!ms) {
      return c.json({ error: 'Not found' }, 404);
    }
    
    return c.json({ multisig: ms });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
};

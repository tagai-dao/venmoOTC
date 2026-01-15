import { D1Adapter } from '../d1Adapter.js';

/**
 * 多签合约数据仓库（D1 版本）
 */
export interface MultisigContract {
  id: string;
  transactionId: string;
  contractAddress: string;
  requesterAddress: string;
  traderAddress: string;
  usdtAmount: number;
  onchainOrderId?: number;
  initiatorChoice: number;
  counterpartyChoice: number;
  initiatorSigned: boolean;
  counterpartySigned: boolean;
  status: string;
  paymentProofUrl?: string;
  isActivated: boolean;
  activatedAt?: number;
  createdAt: number;
}

export class MultisigRepository {
  constructor(private db: D1Adapter) {}

  /**
   * 将数据库行转换为 MultisigContract 对象
   */
  private static rowToMultisig(row: any): MultisigContract {
    return {
      id: row.id,
      transactionId: row.transaction_id,
      contractAddress: row.contract_address,
      requesterAddress: row.requester_address,
      traderAddress: row.trader_address,
      usdtAmount: parseFloat(row.usdt_amount),
      onchainOrderId: row.onchain_order_id || undefined,
      initiatorChoice: row.initiator_choice || 0,
      counterpartyChoice: row.counterparty_choice || 0,
      initiatorSigned: Boolean(row.initiator_signed),
      counterpartySigned: Boolean(row.counterparty_signed),
      status: row.status || 'OPEN',
      paymentProofUrl: row.payment_proof_url || undefined,
      isActivated: Boolean(row.is_activated),
      activatedAt: row.activated_at ? parseInt(row.activated_at) : undefined,
      createdAt: parseInt(row.created_at),
    };
  }

  /**
   * 创建多签合约记录
   */
  async create(
    transactionId: string,
    contractAddress: string,
    requesterAddress: string,
    traderAddress: string,
    usdtAmount: number,
    onchainOrderId?: number
  ): Promise<MultisigContract> {
    const id = `multisig_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await this.db.execute(
      `INSERT INTO multisig_contracts 
       (id, transaction_id, contract_address, requester_address, trader_address, usdt_amount, onchain_order_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, transactionId, contractAddress, requesterAddress, traderAddress, usdtAmount, onchainOrderId || null, 'OPEN']
    );

    const multisig = await this.findByTransactionId(transactionId);
    if (!multisig) {
      throw new Error('Failed to create multisig contract');
    }
    return multisig;
  }

  /**
   * 根据交易 ID 获取多签合约
   */
  async findByTransactionId(transactionId: string): Promise<MultisigContract | null> {
    const row = await this.db.queryOne(
      'SELECT * FROM multisig_contracts WHERE transaction_id = ?',
      [transactionId]
    );
    if (!row) {
      return null;
    }
    return MultisigRepository.rowToMultisig(row);
  }

  /**
   * 更新多签记录
   */
  async update(transactionId: string, updates: Partial<MultisigContract>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.onchainOrderId !== undefined) {
      fields.push('onchain_order_id = ?');
      values.push(updates.onchainOrderId);
    }
    if (updates.initiatorChoice !== undefined) {
      fields.push('initiator_choice = ?');
      values.push(updates.initiatorChoice);
    }
    if (updates.counterpartyChoice !== undefined) {
      fields.push('counterparty_choice = ?');
      values.push(updates.counterpartyChoice);
    }
    if (updates.initiatorSigned !== undefined) {
      fields.push('initiator_signed = ?');
      values.push(updates.initiatorSigned ? 1 : 0);
    }
    if (updates.counterpartySigned !== undefined) {
      fields.push('counterparty_signed = ?');
      values.push(updates.counterpartySigned ? 1 : 0);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.paymentProofUrl !== undefined) {
      fields.push('payment_proof_url = ?');
      values.push(updates.paymentProofUrl || null);
    }
    if (updates.isActivated !== undefined) {
      fields.push('is_activated = ?');
      values.push(updates.isActivated ? 1 : 0);
      if (updates.isActivated) {
        fields.push('activated_at = strftime(\'%s\', \'now\')');
      }
    }

    if (fields.length === 0) return;

    values.push(transactionId);
    await this.db.execute(
      `UPDATE multisig_contracts SET ${fields.join(', ')} WHERE transaction_id = ?`,
      values
    );
  }

  /**
   * 判断是否已经达成一致并可以执行
   */
  async isAgreed(transactionId: string): Promise<boolean> {
    const ms = await this.findByTransactionId(transactionId);
    if (!ms) return false;
    return (
      ms.initiatorSigned &&
      ms.counterpartySigned &&
      ms.initiatorChoice !== 0 &&
      ms.initiatorChoice === ms.counterpartyChoice
    );
  }
}

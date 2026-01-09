import { pool } from '../config.js';

/**
 * 多签合约数据仓库
 */
export interface MultisigContract {
  id: string;
  transactionId: string;
  contractAddress: string;
  requesterAddress: string;
  traderAddress: string;
  usdtAmount: number;
  isActivated: boolean;
  activatedAt?: Date;
  createdAt: Date;
  traderSigned: boolean;
  requesterSigned: boolean;
  traderSignedAt?: Date;
  requesterSignedAt?: Date;
}

export class MultisigRepository {
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
      isActivated: row.is_activated === 1,
      activatedAt: row.activated_at || undefined,
      createdAt: row.created_at,
      traderSigned: (row.trader_signed === 1) || (row.trader_signed === true) || false,
      requesterSigned: (row.requester_signed === 1) || (row.requester_signed === true) || false,
      traderSignedAt: row.trader_signed_at || undefined,
      requesterSignedAt: row.requester_signed_at || undefined,
    };
  }

  /**
   * 创建多签合约记录
   */
  static async create(
    transactionId: string,
    contractAddress: string,
    requesterAddress: string,
    traderAddress: string,
    usdtAmount: number
  ): Promise<MultisigContract> {
    const id = `multisig_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await pool.execute(
      `INSERT INTO multisig_contracts (id, transaction_id, contract_address, requester_address, trader_address, usdt_amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, transactionId, contractAddress, requesterAddress, traderAddress, usdtAmount]
    );

    const [rows] = await pool.execute('SELECT * FROM multisig_contracts WHERE id = ?', [id]);
    return this.rowToMultisig((rows as any[])[0]);
  }

  /**
   * 根据交易 ID 获取多签合约
   */
  static async findByTransactionId(transactionId: string): Promise<MultisigContract | null> {
    const [rows] = await pool.execute(
      'SELECT * FROM multisig_contracts WHERE transaction_id = ?',
      [transactionId]
    );
    const result = rows as any[];
    if (result.length === 0) {
      return null;
    }
    return this.rowToMultisig(result[0]);
  }

  /**
   * 激活多签合约（释放 USDT）
   */
  static async activate(transactionId: string): Promise<boolean> {
    const [result] = await pool.execute(
      'UPDATE multisig_contracts SET is_activated = 1, activated_at = CURRENT_TIMESTAMP WHERE transaction_id = ? AND is_activated = 0',
      [transactionId]
    );
    return (result as any).affectedRows > 0;
  }

  /**
   * 检查多签合约是否已激活
   */
  static async isActivated(transactionId: string): Promise<boolean> {
    const [rows] = await pool.execute(
      'SELECT is_activated FROM multisig_contracts WHERE transaction_id = ?',
      [transactionId]
    );
    const result = rows as any[];
    if (result.length === 0) {
      return false;
    }
    return result[0].is_activated === 1;
  }

  /**
   * 交易者签名多签合约
   */
  static async signByTrader(transactionId: string): Promise<boolean> {
    try {
      const [result] = await pool.execute(
        'UPDATE multisig_contracts SET trader_signed = 1, trader_signed_at = CURRENT_TIMESTAMP WHERE transaction_id = ? AND (trader_signed = 0 OR trader_signed IS NULL)',
        [transactionId]
      );
      return (result as any).affectedRows > 0;
    } catch (error: any) {
      // 如果字段不存在，先尝试添加字段
      if (error.code === 'ER_BAD_FIELD_ERROR' || error.code === 1054) {
        console.warn('Multisig signature fields not found, attempting to add them...');
        try {
          await pool.execute(
            'ALTER TABLE multisig_contracts ADD COLUMN trader_signed TINYINT(1) DEFAULT 0, ADD COLUMN requester_signed TINYINT(1) DEFAULT 0, ADD COLUMN trader_signed_at TIMESTAMP NULL, ADD COLUMN requester_signed_at TIMESTAMP NULL'
          );
          // 重试签名
          const [result] = await pool.execute(
            'UPDATE multisig_contracts SET trader_signed = 1, trader_signed_at = CURRENT_TIMESTAMP WHERE transaction_id = ? AND (trader_signed = 0 OR trader_signed IS NULL)',
            [transactionId]
          );
          return (result as any).affectedRows > 0;
        } catch (alterError: any) {
          if (alterError.code === 'ER_DUP_FIELDNAME' || alterError.code === 1060) {
            // 字段已存在，重试更新
            const [result] = await pool.execute(
              'UPDATE multisig_contracts SET trader_signed = 1, trader_signed_at = CURRENT_TIMESTAMP WHERE transaction_id = ? AND (trader_signed = 0 OR trader_signed IS NULL)',
              [transactionId]
            );
            return (result as any).affectedRows > 0;
          }
          throw alterError;
        }
      }
      throw error;
    }
  }

  /**
   * 请求者签名多签合约
   */
  static async signByRequester(transactionId: string): Promise<boolean> {
    try {
      const [result] = await pool.execute(
        'UPDATE multisig_contracts SET requester_signed = 1, requester_signed_at = CURRENT_TIMESTAMP WHERE transaction_id = ? AND (requester_signed = 0 OR requester_signed IS NULL)',
        [transactionId]
      );
      return (result as any).affectedRows > 0;
    } catch (error: any) {
      // 如果字段不存在，先尝试添加字段
      if (error.code === 'ER_BAD_FIELD_ERROR' || error.code === 1054) {
        console.warn('Multisig signature fields not found, attempting to add them...');
        try {
          await pool.execute(
            'ALTER TABLE multisig_contracts ADD COLUMN trader_signed TINYINT(1) DEFAULT 0, ADD COLUMN requester_signed TINYINT(1) DEFAULT 0, ADD COLUMN trader_signed_at TIMESTAMP NULL, ADD COLUMN requester_signed_at TIMESTAMP NULL'
          );
          // 重试签名
          const [result] = await pool.execute(
            'UPDATE multisig_contracts SET requester_signed = 1, requester_signed_at = CURRENT_TIMESTAMP WHERE transaction_id = ? AND (requester_signed = 0 OR requester_signed IS NULL)',
            [transactionId]
          );
          return (result as any).affectedRows > 0;
        } catch (alterError: any) {
          if (alterError.code === 'ER_DUP_FIELDNAME' || alterError.code === 1060) {
            // 字段已存在，重试更新
            const [result] = await pool.execute(
              'UPDATE multisig_contracts SET requester_signed = 1, requester_signed_at = CURRENT_TIMESTAMP WHERE transaction_id = ? AND (requester_signed = 0 OR requester_signed IS NULL)',
              [transactionId]
            );
            return (result as any).affectedRows > 0;
          }
          throw alterError;
        }
      }
      throw error;
    }
  }

  /**
   * 检查是否两个签名都已完成
   */
  static async areBothSigned(transactionId: string): Promise<boolean> {
    try {
      const [rows] = await pool.execute(
        'SELECT trader_signed, requester_signed FROM multisig_contracts WHERE transaction_id = ?',
        [transactionId]
      );
      const result = rows as any[];
      if (result.length === 0) {
        return false;
      }
      const row = result[0];
      // 处理字段可能为 null 或不存在的情况
      const traderSigned = row.trader_signed === 1 || row.trader_signed === true;
      const requesterSigned = row.requester_signed === 1 || row.requester_signed === true;
      return traderSigned && requesterSigned;
    } catch (error: any) {
      // 如果字段不存在，返回 false
      if (error.code === 'ER_BAD_FIELD_ERROR' || error.code === 1054) {
        console.warn('Multisig signature fields not found, returning false');
        return false;
      }
      throw error;
    }
  }
}

import { pool } from '../config.js';
import { Currency } from '../../types.js';

/**
 * 钱包余额数据仓库
 */
export class WalletBalanceRepository {
  /**
   * 获取钱包余额
   */
  static async getBalance(walletAddress: string, currency: Currency): Promise<number> {
    const currencyColumn = this.getCurrencyColumn(currency);
    const [rows] = await pool.execute(
      `SELECT ${currencyColumn} FROM wallet_balances WHERE wallet_address = ?`,
      [walletAddress]
    );
    
    const result = rows as any[];
    if (result.length === 0) {
      // 如果钱包不存在，创建默认余额记录
      await this.createDefaultBalance(walletAddress);
      return 0;
    }
    
    return parseFloat(result[0][currencyColumn] || '0');
  }

  /**
   * 更新钱包余额
   */
  static async updateBalance(
    walletAddress: string,
    currency: Currency,
    amount: number
  ): Promise<void> {
    const currencyColumn = this.getCurrencyColumn(currency);
    
    // 使用 INSERT ... ON DUPLICATE KEY UPDATE 确保记录存在
    await pool.execute(
      `INSERT INTO wallet_balances (wallet_address, ${currencyColumn})
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE ${currencyColumn} = ?, updated_at = CURRENT_TIMESTAMP`,
      [walletAddress, amount, amount]
    );
  }

  /**
   * 增加钱包余额
   */
  static async addBalance(
    walletAddress: string,
    currency: Currency,
    amount: number
  ): Promise<void> {
    const currencyColumn = this.getCurrencyColumn(currency);
    
    // 先确保记录存在
    await pool.execute(
      `INSERT INTO wallet_balances (wallet_address, ${currencyColumn})
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE ${currencyColumn} = wallet_balances.${currencyColumn} + ?, updated_at = CURRENT_TIMESTAMP`,
      [walletAddress, amount, amount]
    );
  }

  /**
   * 减少钱包余额
   */
  static async subtractBalance(
    walletAddress: string,
    currency: Currency,
    amount: number
  ): Promise<void> {
    const currencyColumn = this.getCurrencyColumn(currency);
    
    await pool.execute(
      `UPDATE wallet_balances
       SET ${currencyColumn} = ${currencyColumn} - ?, updated_at = CURRENT_TIMESTAMP
       WHERE wallet_address = ?`,
      [amount, walletAddress]
    );
  }

  /**
   * 获取所有货币的余额
   */
  static async getAllBalances(walletAddress: string): Promise<Record<Currency, number>> {
    const [rows] = await pool.execute(
      `SELECT usdt_balance, ngn_balance, ves_balance, usd_balance
       FROM wallet_balances
       WHERE wallet_address = ?`,
      [walletAddress]
    );
    
    const result = rows as any[];
    if (result.length === 0) {
      await this.createDefaultBalance(walletAddress);
      return {
        [Currency.USDT]: 0,
        [Currency.NGN]: 0,
        [Currency.VES]: 0,
        [Currency.USD]: 0,
      };
    }
    
    const row = result[0];
    return {
      [Currency.USDT]: parseFloat(row.usdt_balance || '0'),
      [Currency.NGN]: parseFloat(row.ngn_balance || '0'),
      [Currency.VES]: parseFloat(row.ves_balance || '0'),
      [Currency.USD]: parseFloat(row.usd_balance || '0'),
    };
  }

  /**
   * 创建默认余额记录
   */
  private static async createDefaultBalance(walletAddress: string): Promise<void> {
    await pool.execute(
      `INSERT INTO wallet_balances (wallet_address, usdt_balance, ngn_balance, ves_balance, usd_balance)
       VALUES (?, 0, 0, 0, 0)
       ON DUPLICATE KEY UPDATE wallet_address = wallet_address`,
      [walletAddress]
    );
  }

  /**
   * 获取货币对应的数据库列名
   */
  private static getCurrencyColumn(currency: Currency): string {
    const mapping: Record<Currency, string> = {
      [Currency.USDT]: 'usdt_balance',
      [Currency.NGN]: 'ngn_balance',
      [Currency.VES]: 'ves_balance',
      [Currency.USD]: 'usd_balance',
    };
    return mapping[currency];
  }
}




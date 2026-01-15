import { D1Adapter } from '../d1Adapter.js';
import { Currency } from '../../types.js';

/**
 * 钱包余额数据仓库（D1 版本）
 */
export class WalletBalanceRepository {
  constructor(private db: D1Adapter) {}

  /**
   * 获取钱包余额
   */
  async getBalance(walletAddress: string, currency: Currency): Promise<number> {
    const currencyColumn = this.getCurrencyColumn(currency);
    const row = await this.db.queryOne<Record<string, any>>(
      `SELECT ${currencyColumn} FROM wallet_balances WHERE wallet_address = ?`,
      [walletAddress]
    );
    
    if (!row) {
      // 如果钱包不存在，创建默认余额记录
      await this.createDefaultBalance(walletAddress);
      return 0;
    }
    
    return parseFloat(row[currencyColumn] || '0');
  }

  /**
   * 更新钱包余额
   */
  async updateBalance(
    walletAddress: string,
    currency: Currency,
    amount: number
  ): Promise<void> {
    const currencyColumn = this.getCurrencyColumn(currency);
    
    // SQLite 使用 INSERT OR REPLACE 或 INSERT ... ON CONFLICT
    await this.db.execute(
      `INSERT INTO wallet_balances (wallet_address, ${currencyColumn}, updated_at)
       VALUES (?, ?, strftime('%s', 'now'))
       ON CONFLICT(wallet_address) DO UPDATE SET ${currencyColumn} = ?, updated_at = strftime('%s', 'now')`,
      [walletAddress, amount, amount]
    );
  }

  /**
   * 增加钱包余额
   */
  async addBalance(
    walletAddress: string,
    currency: Currency,
    amount: number
  ): Promise<void> {
    const currencyColumn = this.getCurrencyColumn(currency);
    
    // 先确保记录存在
    await this.db.execute(
      `INSERT INTO wallet_balances (wallet_address, ${currencyColumn}, updated_at)
       VALUES (?, ?, strftime('%s', 'now'))
       ON CONFLICT(wallet_address) DO UPDATE SET ${currencyColumn} = ${currencyColumn} + ?, updated_at = strftime('%s', 'now')`,
      [walletAddress, amount, amount]
    );
  }

  /**
   * 减少钱包余额
   */
  async subtractBalance(
    walletAddress: string,
    currency: Currency,
    amount: number
  ): Promise<void> {
    const currencyColumn = this.getCurrencyColumn(currency);
    
    await this.db.execute(
      `UPDATE wallet_balances
       SET ${currencyColumn} = ${currencyColumn} - ?, updated_at = strftime('%s', 'now')
       WHERE wallet_address = ?`,
      [amount, walletAddress]
    );
  }

  /**
   * 获取所有货币的余额
   */
  async getAllBalances(walletAddress: string): Promise<Partial<Record<Currency, number>>> {
    const row = await this.db.queryOne<{
      usdt_balance: number;
      ngn_balance: number;
      ves_balance: number;
      usd_balance: number;
    }>(
      `SELECT usdt_balance, ngn_balance, ves_balance, usd_balance
       FROM wallet_balances
       WHERE wallet_address = ?`,
      [walletAddress]
    );
    
    if (!row) {
      await this.createDefaultBalance(walletAddress);
      return {
        [Currency.USDT]: 0,
        [Currency.NGN]: 0,
        [Currency.VES]: 0,
        [Currency.USD]: 0,
      };
    }
    
    return {
      [Currency.USDT]: parseFloat(String(row.usdt_balance || '0')),
      [Currency.NGN]: parseFloat(String(row.ngn_balance || '0')),
      [Currency.VES]: parseFloat(String(row.ves_balance || '0')),
      [Currency.USD]: parseFloat(String(row.usd_balance || '0')),
    };
  }

  /**
   * 创建默认余额记录
   */
  private async createDefaultBalance(walletAddress: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO wallet_balances (wallet_address, usdt_balance, ngn_balance, ves_balance, usd_balance, updated_at)
       VALUES (?, 0, 0, 0, 0, strftime('%s', 'now'))
       ON CONFLICT(wallet_address) DO NOTHING`,
      [walletAddress]
    );
  }

  /**
   * 获取货币对应的数据库列名
   */
  private getCurrencyColumn(currency: Currency): string {
    const mapping: Partial<Record<Currency, string>> = {
      [Currency.USDT]: 'usdt_balance',
      [Currency.NGN]: 'ngn_balance',
      [Currency.VES]: 'ves_balance',
      [Currency.USD]: 'usd_balance',
      // BNB 不在数据库中存储，是链上原生代币
    };
    const column = mapping[currency];
    if (!column) {
      throw new Error(`Currency ${currency} is not supported in database`);
    }
    return column;
  }
}

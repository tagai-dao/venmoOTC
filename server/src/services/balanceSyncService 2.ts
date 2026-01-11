import { blockchainService, BlockchainService } from './blockchainService.js';
import { WalletBalanceRepository } from '../db/repositories/walletBalanceRepository.js';
import { Currency } from '../types.js';
import { pool } from '../db/config.js';

/**
 * 余额同步服务
 * 定期从链上同步 USDT 余额到数据库
 */
export class BalanceSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;

  /**
   * 同步单个地址的余额
   */
  async syncAddressBalance(walletAddress: string): Promise<void> {
    try {
      // 先验证地址格式（使用静态方法）
      if (!BlockchainService.isValidAddress(walletAddress)) {
        console.warn(`⚠️ Skipping invalid address: ${walletAddress}`);
        return;
      }

      // 从链上获取最新余额
      const chainBalance = await blockchainService.getUSDTBalance(walletAddress);
      
      // 更新数据库（getUSDTBalance 已经会自动更新数据库，这里只是确保）
      await WalletBalanceRepository.updateBalance(walletAddress, Currency.USDT, chainBalance);
      
      console.log(`✅ Synced balance for ${walletAddress}: ${chainBalance} USDT`);
    } catch (error: any) {
      // 只记录错误，不抛出，避免影响其他地址的同步
      console.error(`❌ Failed to sync balance for ${walletAddress}:`, error.message);
    }
  }

  /**
   * 同步所有已知地址的余额
   */
  async syncAllBalances(): Promise<void> {
    if (this.isSyncing) {
      console.log('⏸️ Balance sync already in progress, skipping...');
      return;
    }

    this.isSyncing = true;
    console.log('🔄 Starting balance sync...');

    try {
      // 从数据库获取所有钱包地址
      const [rows] = await pool.execute(
        'SELECT DISTINCT wallet_address FROM wallet_balances'
      ) as any[];

      const allAddresses = rows.map((row: any) => row.wallet_address);
      
      // 过滤出有效的地址（使用静态方法）
      const validAddresses = allAddresses.filter((address: string) => 
        BlockchainService.isValidAddress(address)
      );
      
      const invalidCount = allAddresses.length - validAddresses.length;
      if (invalidCount > 0) {
        console.log(`⚠️ Skipping ${invalidCount} invalid addresses`);
      }
      
      if (validAddresses.length === 0) {
        console.log('📭 No valid addresses to sync');
        return;
      }

      console.log(`📊 Syncing balances for ${validAddresses.length} valid addresses...`);

      // 批量同步（限制并发数，避免 RPC 限制）
      const batchSize = 5;
      for (let i = 0; i < validAddresses.length; i += batchSize) {
        const batch = validAddresses.slice(i, i + batchSize);
        await Promise.all(
          batch.map(address => this.syncAddressBalance(address))
        );
        
        // 批次之间稍作延迟
        if (i + batchSize < validAddresses.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('✅ Balance sync completed');
    } catch (error: any) {
      console.error('❌ Balance sync failed:', error.message);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 启动定期同步
   * @param intervalMinutes 同步间隔（分钟），默认 5 分钟
   */
  startPeriodicSync(intervalMinutes: number = 5): void {
    if (this.syncInterval) {
      console.log('⚠️ Periodic sync already started');
      return;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    
    // 立即执行一次
    this.syncAllBalances();
    
    // 然后定期执行
    this.syncInterval = setInterval(() => {
      this.syncAllBalances();
    }, intervalMs);

    console.log(`🔄 Started periodic balance sync (every ${intervalMinutes} minutes)`);
  }

  /**
   * 停止定期同步
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ Stopped periodic balance sync');
    }
  }

  /**
   * 同步特定用户的余额（用于实时更新）
   */
  async syncUserBalance(walletAddress: string): Promise<number> {
    try {
      const balance = await blockchainService.getUSDTBalance(walletAddress);
      return balance;
    } catch (error: any) {
      console.error(`Failed to sync user balance for ${walletAddress}:`, error);
      // 如果链上查询失败，返回数据库余额
      return await WalletBalanceRepository.getBalance(walletAddress, Currency.USDT);
    }
  }
}

// 导出单例实例
export const balanceSyncService = new BalanceSyncService();

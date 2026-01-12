import { ethers } from 'ethers';
import { config } from '../config.js';
import { Currency } from '../types.js';
import { WalletBalanceRepository } from '../db/repositories/walletBalanceRepository.js';

// ERC20 ABI (只需要 balanceOf 和 transfer 方法)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

/**
 * 区块链服务
 * 使用 ethers.js 连接 BNB Chain
 */
export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private usdtContract: ethers.Contract;
  private wallet: ethers.Wallet | null = null;

  constructor() {
    // 定义 BSC 网络配置（避免自动检测网络导致的超时）
    const bscNetwork = {
      name: 'BSC',
      chainId: config.blockchain.chainId,
    };
    
    // 初始化 BNB Chain provider，使用静态网络配置避免自动检测网络
    // 这样可以避免启动时的网络检测超时问题
    this.provider = new ethers.JsonRpcProvider(
      config.blockchain.bnbChainRpcUrl,
      bscNetwork,
      {
        staticNetwork: true,
      }
    );
    
    // 初始化 USDT 合约
    this.usdtContract = new ethers.Contract(
      config.blockchain.usdtContractAddress,
      ERC20_ABI,
      this.provider
    );

    // 如果有私钥，初始化钱包（用于发送交易）
    if (config.blockchain.privateKey && config.blockchain.privateKey !== 'your_private_key_here' && !config.blockchain.privateKey.startsWith('0xyour_')) {
      try {
        this.wallet = new ethers.Wallet(config.blockchain.privateKey, this.provider);
        console.log('✅ Blockchain wallet initialized:', this.wallet.address);
      } catch (error: any) {
        console.warn('⚠️ Invalid private key format. Send transactions will not work:', error.message);
        this.wallet = null;
      }
    } else {
      console.warn('⚠️ No private key configured. Send transactions will not work.');
    }
  }

  /**
   * 获取 USDT 余额（从链上查询）
   */
  async getUSDTBalance(address: string): Promise<number> {
    // 验证地址格式
    if (!ethers.isAddress(address)) {
      // 对于无效地址，直接返回 0 而不是抛出错误
      console.warn(`⚠️ Invalid address format: ${address}, returning 0`);
      return 0;
    }

    try {
      // 从链上查询余额
      const balance = await this.usdtContract.balanceOf(address);
      const decimals = await this.usdtContract.decimals();
      
      // 转换为可读格式
      const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals));
      
      console.log(`📊 Chain balance for ${address}: ${balanceFormatted} USDT`);
      
      // 同步到数据库
      await WalletBalanceRepository.updateBalance(address, Currency.USDT, balanceFormatted);
      
      return balanceFormatted;
    } catch (error: any) {
      console.error(`❌ Failed to get USDT balance for ${address}:`, error.message);
      
      // 如果链上查询失败，尝试从数据库读取
      try {
        const dbBalance = await WalletBalanceRepository.getBalance(address, Currency.USDT);
        console.log(`📊 Using database balance as fallback: ${dbBalance} USDT`);
        return dbBalance;
      } catch (dbError) {
        console.error('❌ Database fallback also failed:', dbError);
        // 返回 0 而不是抛出错误，避免影响其他地址的查询
        return 0;
      }
    }
  }

  /**
   * 获取 BNB 余额（原生代币）
   */
  async getBNBBalance(address: string): Promise<number> {
    // 验证地址格式
    if (!ethers.isAddress(address)) {
      // 对于无效地址，直接返回 0 而不是抛出错误
      console.warn(`⚠️ Invalid address format: ${address}, returning 0`);
      return 0;
    }

    try {
      const balance = await this.provider.getBalance(address);
      const balanceFormatted = parseFloat(ethers.formatEther(balance));
      
      console.log(`📊 BNB balance for ${address}: ${balanceFormatted} BNB`);
      
      return balanceFormatted;
    } catch (error: any) {
      console.error(`❌ Failed to get BNB balance for ${address}:`, error.message);
      // 返回 0 而不是抛出错误，避免影响其他地址的查询
      return 0;
    }
  }

  /**
   * 发送 USDT 转账
   * 注意：这需要私钥配置，并且发送者需要有足够的 USDT 和 BNB（作为 gas）
   */
  async sendUSDT(
    fromAddress: string,
    toAddress: string,
    amount: number
  ): Promise<{ txHash: string; blockNumber: number; timestamp: number }> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized. Please configure PRIVATE_KEY in .env');
    }

    // 验证地址
    if (!ethers.isAddress(fromAddress) || !ethers.isAddress(toAddress)) {
      throw new Error('Invalid address format');
    }

    // 验证发送者地址是否匹配钱包地址
    if (this.wallet.address.toLowerCase() !== fromAddress.toLowerCase()) {
      throw new Error(`Wallet address (${this.wallet.address}) does not match fromAddress (${fromAddress})`);
    }

    try {
      // 获取合约实例（使用钱包签名）
      const usdtContractWithSigner = this.usdtContract.connect(this.wallet);
      
      // 获取代币精度
      const decimals = await this.usdtContract.decimals();
      
      // 转换金额为 BigNumber
      const amountWei = ethers.parseUnits(amount.toString(), decimals);
      
      console.log(`⛓️ Sending ${amount} USDT from ${fromAddress} to ${toAddress}`);
      
      // 发送交易
      const tx = await usdtContractWithSigner.transfer(toAddress, amountWei);
      console.log(`📝 Transaction sent: ${tx.hash}`);
      
      // 等待交易确认
      console.log('⏳ Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      
      console.log(`✅ Transaction confirmed! Block: ${receipt.blockNumber}, Hash: ${tx.hash}`);
      
      // 更新数据库余额
      const fromBalance = await this.getUSDTBalance(fromAddress);
      const toBalance = await this.getUSDTBalance(toAddress);
      
      await WalletBalanceRepository.updateBalance(fromAddress, Currency.USDT, fromBalance);
      await WalletBalanceRepository.updateBalance(toAddress, Currency.USDT, toBalance);
      
      return {
        txHash: tx.hash,
        blockNumber: receipt.blockNumber || 0,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error('❌ Failed to send USDT:', error);
      
      // 提供更友好的错误信息
      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error('Insufficient USDT balance');
      } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        throw new Error('Transaction would fail. Check balance and gas settings.');
      } else if (error.reason) {
        throw new Error(error.reason);
      }
      
      throw new Error(`Failed to send USDT: ${error.message}`);
    }
  }

  /**
   * 获取交易详情
   */
  async getTransaction(txHash: string): Promise<ethers.TransactionResponse | null> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      return tx;
    } catch (error: any) {
      console.error(`❌ Failed to get transaction ${txHash}:`, error.message);
      return null;
    }
  }

  /**
   * 获取交易收据
   */
  async getTransactionReceipt(txHash: string): Promise<ethers.TransactionReceipt | null> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      return receipt;
    } catch (error: any) {
      console.error(`❌ Failed to get transaction receipt ${txHash}:`, error.message);
      return null;
    }
  }

  /**
   * 批量获取多个地址的 USDT 余额
   */
  async getMultipleUSDTBalances(addresses: string[]): Promise<Record<string, number>> {
    const balances: Record<string, number> = {};
    
    // 并行查询所有地址的余额
    const balancePromises = addresses.map(async (address) => {
      try {
        const balance = await this.getUSDTBalance(address);
        return { address, balance };
      } catch (error) {
        console.error(`Failed to get balance for ${address}:`, error);
        return { address, balance: 0 };
      }
    });
    
    const results = await Promise.all(balancePromises);
    
    results.forEach(({ address, balance }) => {
      balances[address] = balance;
    });
    
    return balances;
  }

  /**
   * 验证地址格式
   */
  static isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * 格式化地址（校验和格式）
   */
  static formatAddress(address: string): string {
    if (!ethers.isAddress(address)) {
      throw new Error('Invalid address');
    }
    return ethers.getAddress(address);
  }

  /**
   * 测试 RPC 连接（用于初始化时检查）
   */
  async testConnection(): Promise<boolean> {
    try {
      // 使用 getNetwork() 测试连接，设置超时
      const networkPromise = this.provider.getNetwork();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      );
      
      await Promise.race([networkPromise, timeoutPromise]);
      return true;
    } catch (error: any) {
      console.warn('⚠️ RPC connection test failed:', error.message);
      return false;
    }
  }
}

// 导出单例实例
export const blockchainService = new BlockchainService();

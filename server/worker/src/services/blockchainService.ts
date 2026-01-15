import { ethers } from 'ethers';
import { Currency } from '../types.js';
import { WalletBalanceRepository } from '../db/repositories/walletBalanceRepository.js';
import { Env } from '../types.js';

// ERC20 ABI (只需要 balanceOf 和 transfer 方法)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

/**
 * 区块链服务（Workers 版本）
 * 使用 ethers.js 连接 BNB Chain
 */
export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private usdtContract: ethers.Contract;
  private wallet: ethers.Wallet | null = null;
  private walletBalanceRepo: WalletBalanceRepository;

  constructor(env: Env, walletBalanceRepo: WalletBalanceRepository) {
    // 定义 BSC 网络配置
    const bscNetwork = {
      name: 'BSC',
      chainId: 56,
    };
    
    // 初始化 BNB Chain provider
    this.provider = new ethers.JsonRpcProvider(
      env.BNB_CHAIN_RPC_URL,
      bscNetwork,
      {
        staticNetwork: true,
      }
    );
    
    // 初始化 USDT 合约
    this.usdtContract = new ethers.Contract(
      env.USDT_CONTRACT_ADDRESS,
      ERC20_ABI,
      this.provider
    );

    this.walletBalanceRepo = walletBalanceRepo;

    // 如果有私钥，初始化钱包
    if (env.PRIVATE_KEY && env.PRIVATE_KEY !== 'your_private_key_here' && !env.PRIVATE_KEY.startsWith('0xyour_')) {
      try {
        this.wallet = new ethers.Wallet(env.PRIVATE_KEY, this.provider);
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
    if (!ethers.isAddress(address)) {
      console.warn(`⚠️ Invalid address format: ${address}, returning 0`);
      return 0;
    }

    try {
      const balance = await this.usdtContract.balanceOf(address);
      const decimals = await this.usdtContract.decimals();
      const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals));
      
      console.log(`📊 Chain balance for ${address}: ${balanceFormatted} USDT`);
      
      // 同步到数据库
      await this.walletBalanceRepo.updateBalance(address, Currency.USDT, balanceFormatted);
      
      return balanceFormatted;
    } catch (error: any) {
      console.error(`❌ Failed to get USDT balance for ${address}:`, error.message);
      
      // 如果链上查询失败，尝试从数据库读取
      try {
        const dbBalance = await this.walletBalanceRepo.getBalance(address, Currency.USDT);
        console.log(`📊 Using database balance as fallback: ${dbBalance} USDT`);
        return dbBalance;
      } catch (dbError) {
        console.error('❌ Database fallback also failed:', dbError);
        return 0;
      }
    }
  }

  /**
   * 获取 BNB 余额（原生代币）
   */
  async getBNBBalance(address: string): Promise<number> {
    if (!ethers.isAddress(address)) {
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
      return 0;
    }
  }

  /**
   * 发送 USDT 转账
   */
  async sendUSDT(
    fromAddress: string,
    toAddress: string,
    amount: number
  ): Promise<{ txHash: string; blockNumber: number; timestamp: number }> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized. Please configure PRIVATE_KEY');
    }

    if (!ethers.isAddress(fromAddress) || !ethers.isAddress(toAddress)) {
      throw new Error('Invalid address format');
    }

    if (this.wallet.address.toLowerCase() !== fromAddress.toLowerCase()) {
      throw new Error(`Wallet address (${this.wallet.address}) does not match fromAddress (${fromAddress})`);
    }

    try {
      const usdtContractWithSigner = this.usdtContract.connect(this.wallet) as ethers.Contract;
      const decimals = await this.usdtContract.decimals();
      const amountWei = ethers.parseUnits(amount.toString(), decimals);
      
      console.log(`⛓️ Sending ${amount} USDT from ${fromAddress} to ${toAddress}`);
      
      const tx = await (usdtContractWithSigner as any).transfer(toAddress, amountWei);
      console.log(`📝 Transaction sent: ${tx.hash}`);
      
      console.log('⏳ Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      
      console.log(`✅ Transaction confirmed! Block: ${receipt.blockNumber}, Hash: ${tx.hash}`);
      
      // 更新数据库余额
      const fromBalance = await this.getUSDTBalance(fromAddress);
      const toBalance = await this.getUSDTBalance(toAddress);
      
      await this.walletBalanceRepo.updateBalance(fromAddress, Currency.USDT, fromBalance);
      await this.walletBalanceRepo.updateBalance(toAddress, Currency.USDT, toBalance);
      
      return {
        txHash: tx.hash,
        blockNumber: receipt.blockNumber || 0,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error('❌ Failed to send USDT:', error);
      
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
}

/**
 * Privy 区块链服务
 * 使用 Privy 钱包在前端直接发送交易
 */

import { ethers } from 'ethers';

// USDT 合约地址（BSC 主网）
const USDT_CONTRACT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';

// ERC20 ABI（只需要 transfer 方法）
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

/**
 * 使用 Privy 钱包发送 USDT
 * @param provider Privy 提供的 ethers provider
 * @param toAddress 接收地址
 * @param amount USDT 数量
 * @returns 交易哈希
 */
export async function sendUSDTWithPrivy(
  provider: ethers.Provider,
  toAddress: string,
  amount: number
): Promise<string> {
  try {
    // 验证地址格式
    if (!ethers.isAddress(toAddress)) {
      throw new Error(`Invalid address: ${toAddress}`);
    }

    // 获取签名者（当前连接的钱包）
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();

    // 创建 USDT 合约实例
    const usdtContract = new ethers.Contract(
      USDT_CONTRACT_ADDRESS,
      ERC20_ABI,
      signer
    );

    // 获取代币精度
    const decimals = await usdtContract.decimals();

    // 转换金额为 BigNumber
    const amountWei = ethers.parseUnits(amount.toString(), decimals);

    console.log(`⛓️ Sending ${amount} USDT from ${signerAddress} to ${toAddress}`);

    // 发送交易
    const tx = await usdtContract.transfer(toAddress, amountWei);
    console.log(`📝 Transaction sent: ${tx.hash}`);

    // 等待交易确认
    console.log('⏳ Waiting for transaction confirmation...');
    const receipt = await tx.wait();

    console.log(`✅ Transaction confirmed! Block: ${receipt.blockNumber}, Hash: ${tx.hash}`);

    return tx.hash;
  } catch (error: any) {
    console.error('❌ Failed to send USDT with Privy:', error);
    
    // 提供更友好的错误信息
    if (error.code === 'ACTION_REJECTED') {
      throw new Error('交易被用户取消');
    } else if (error.code === 'INSUFFICIENT_FUNDS') {
      throw new Error('USDT 余额不足');
    } else if (error.reason) {
      throw new Error(error.reason);
    }
    
    throw new Error(`发送 USDT 失败: ${error.message}`);
  }
}

/**
 * 验证地址格式
 */
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

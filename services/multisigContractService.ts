import { ethers } from 'ethers';

// 多签合约 ABI (简化版，仅包含所需方法)
const MULTISIG_ABI = [
  "function createOrder(address _counterparty, uint256 _amount) external returns (uint256)",
  "function signOrder(uint256 _orderId, uint8 _choice) external",
  "function updateChoice(uint256 _orderId, uint8 _newChoice) external",
  "function getOrder(uint256 _orderId) external view returns (address initiator, address counterparty, uint256 amount, uint8 initiatorChoice, uint8 counterpartyChoice, uint8 status, bool initiatorSigned, bool counterpartySigned)",
  "event OrderCreated(uint256 indexed orderId, address indexed initiator, address indexed counterparty, uint256 amount)",
  "event OrderExecuted(uint256 indexed orderId, address indexed recipient, uint256 amount)"
];

// USDT ABI (仅包含 approve)
const USDT_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

const BSC_CHAIN_ID = '0x38'; // 56 in hex

export const MultisigContractService = {
  /**
   * 确保用户在正确的网络上
   */
  ensureCorrectNetwork: async (walletProvider: any) => {
    try {
      const chainId = await walletProvider.request({ method: 'eth_chainId' });
      if (chainId !== BSC_CHAIN_ID) {
        console.log(`🔌 Switching to BSC Mainnet (current: ${chainId})...`);
        try {
          await walletProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BSC_CHAIN_ID }],
          });
        } catch (switchError: any) {
          // 如果钱包没有配置 BSC 网络，尝试添加
          if (switchError.code === 4902) {
            await walletProvider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: BSC_CHAIN_ID,
                chainName: 'BNB Smart Chain Mainnet',
                nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                rpcUrls: ['https://bsc-dataseed.binance.org/'],
                blockExplorerUrls: ['https://bscscan.com/'],
              }],
            });
          } else {
            throw switchError;
          }
        }
      }
    } catch (error) {
      console.error("Failed to check/switch network:", error);
      // 继续执行，让 ethers 抛出具体的网络错误
    }
  },

  /**
   * 创建多签订单 (用户 A 存入 USDT)
   */
  createOrder: async (
    walletProvider: any,
    multisigAddress: string,
    usdtAddress: string,
    counterpartyAddress: string,
    amount: string
  ) => {
    // 1. 检查并切换网络
    await MultisigContractService.ensureCorrectNetwork(walletProvider);

    const provider = new ethers.BrowserProvider(walletProvider);
    const signer = await provider.getSigner();
    
    const usdtContract = new ethers.Contract(usdtAddress, USDT_ABI, signer);
    const multisigContract = new ethers.Contract(multisigAddress, MULTISIG_ABI, signer);
    
    // BSC USDT 是 18 位
    const amountWei = ethers.parseUnits(amount, 18);

    // 2. 检查授权
    console.log("🔍 Checking USDT allowance...");
    const userAddress = await signer.getAddress();
    const allowance = await usdtContract.allowance(userAddress, multisigAddress);
    
    if (allowance < amountWei) {
      console.log("🔓 Approving USDT...");
      const approveTx = await usdtContract.approve(multisigAddress, amountWei);
      console.log("⏳ Waiting for approval transaction...");
      await approveTx.wait();
      console.log("✅ USDT approved");
    }

    // 3. 创建订单
    console.log("📝 Creating multisig order...");
    const tx = await multisigContract.createOrder(counterpartyAddress, amountWei);
    console.log("⏳ Waiting for order creation...");
    const receipt = await tx.wait();
    
    // 4. 解析事件获取 orderId
    const event = receipt.logs.find((log: any) => {
      try {
        const decoded = multisigContract.interface.parseLog(log);
        return decoded?.name === 'OrderCreated';
      } catch (e) {
        return false;
      }
    });

    if (!event) throw new Error("OrderCreated event not found");
    const decodedLog = multisigContract.interface.parseLog(event);
    const orderId = decodedLog?.args[0].toString();
    
    console.log(`✅ Order created! ID: ${orderId}`);
    return { orderId, txHash: tx.hash };
  },

  /**
   * 签名订单 (Choice 1: INITIATOR, 2: COUNTERPARTY)
   */
  signOrder: async (
    walletProvider: any,
    multisigAddress: string,
    orderId: string,
    choice: number
  ) => {
    await MultisigContractService.ensureCorrectNetwork(walletProvider);
    const provider = new ethers.BrowserProvider(walletProvider);
    const signer = await provider.getSigner();
    const multisigContract = new ethers.Contract(multisigAddress, MULTISIG_ABI, signer);

    console.log(`✍️ Signing order ${orderId} with choice ${choice}...`);
    const tx = await multisigContract.signOrder(orderId, choice);
    const receipt = await tx.wait();
    console.log(`✅ Signed order ${orderId}`);
    return { txHash: tx.hash };
  },

  /**
   * 修改签名意图 (Choice 1: INITIATOR, 2: COUNTERPARTY)
   */
  updateChoice: async (
    walletProvider: any,
    multisigAddress: string,
    orderId: string,
    newChoice: number
  ) => {
    await MultisigContractService.ensureCorrectNetwork(walletProvider);
    const provider = new ethers.BrowserProvider(walletProvider);
    const signer = await provider.getSigner();
    const multisigContract = new ethers.Contract(multisigAddress, MULTISIG_ABI, signer);

    console.log(`🔄 Updating choice for order ${orderId} to ${newChoice}...`);
    const tx = await multisigContract.updateChoice(orderId, newChoice);
    await tx.wait();
    console.log(`✅ Choice updated for order ${orderId}`);
    return { txHash: tx.hash };
  }
};

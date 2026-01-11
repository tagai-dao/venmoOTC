import React, { useState, useEffect, useRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { X, CheckCircle, XCircle, Loader, Copy } from 'lucide-react';

interface SignatureTestModalProps {
  onClose: () => void;
}

// 检查是否配置了 Privy
const hasPrivy = !!import.meta.env.VITE_PRIVY_APP_ID;

// 内部组件：只有在 PrivyProvider 存在时才调用 usePrivy
const SignatureTestModalWithPrivy: React.FC<SignatureTestModalProps> = (props) => {
  const { ready, authenticated, getEthersProvider } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  
  // 调试日志
  useEffect(() => {
    console.log('🔍 SignatureTestModal Privy 状态:', {
      ready,
      authenticated,
      walletsReady,
      walletsCount: wallets?.length || 0,
      hasGetEthersProvider: !!getEthersProvider,
      isFunction: typeof getEthersProvider === 'function'
    });
  }, [ready, authenticated, walletsReady, wallets, getEthersProvider]);
  
  return (
    <SignatureTestModalContent
      {...props}
      ready={ready && walletsReady}
      authenticated={authenticated}
      getEthersProvider={getEthersProvider}
      wallets={wallets}
    />
  );
};

// 内部组件：没有 Privy 时的版本
const SignatureTestModalWithoutPrivy: React.FC<SignatureTestModalProps> = (props) => {
  return (
    <SignatureTestModalContent
      {...props}
      ready={false}
      authenticated={false}
      getEthersProvider={undefined}
      wallets={[]}
    />
  );
};

interface ModalContentProps extends SignatureTestModalProps {
  ready: boolean;
  authenticated: boolean;
  getEthersProvider?: () => Promise<any>;
  wallets?: any[];
}

const SignatureTestModalContent: React.FC<ModalContentProps> = ({ 
  onClose, 
  ready, 
  authenticated, 
  getEthersProvider,
  wallets = []
}) => {
  const [textToSign, setTextToSign] = useState('Hello, this is a test message for wallet signature.');
  const [isSigning, setIsSigning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [signerAddress, setSignerAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // 使用 ref 存储最新的 Privy 状态
  const privyStateRef = useRef({ ready, authenticated, getEthersProvider, wallets });
  const [providerReady, setProviderReady] = useState(false);
  
  // 当 Privy 状态改变时，更新 ref
  useEffect(() => {
    privyStateRef.current = { ready, authenticated, getEthersProvider, wallets };
    
    // 检查 provider 是否可用：方法1 使用 getEthersProvider，方法2 使用 wallets
    const hasGetEthersProvider = getEthersProvider && typeof getEthersProvider === 'function';
    const hasWallets = wallets && wallets.length > 0 && wallets.some((w: any) => typeof w.getEthereumProvider === 'function');
    const isReady = ready && authenticated && (hasGetEthersProvider || hasWallets);
    
    setProviderReady(isReady);
    console.log('🔍 SignatureTestModalContent 状态更新:', {
      ready,
      authenticated,
      hasGetEthersProvider,
      hasWallets,
      walletsCount: wallets?.length || 0,
      providerReady: isReady
    });
  }, [ready, authenticated, getEthersProvider, wallets]);
  
  // 定期检查 provider 是否可用（用于自动更新状态显示）
  useEffect(() => {
    if (!ready || !authenticated) {
      setProviderReady(false);
      return;
    }
    
    const checkProvider = () => {
      const currentState = privyStateRef.current;
      
      // 方法1: 检查 getEthersProvider
      const hasGetEthersProvider = currentState.getEthersProvider && typeof currentState.getEthersProvider === 'function';
      
      // 方法2: 检查 wallets
      const hasWallets = currentState.wallets && currentState.wallets.length > 0 && 
                         currentState.wallets.some((w: any) => typeof w.getEthereumProvider === 'function');
      
      const isReady = hasGetEthersProvider || hasWallets;
      setProviderReady(isReady);
      return isReady;
    };
    
    // 立即检查一次
    checkProvider();
    
    // 每 1 秒检查一次，最多检查 10 次（总共 10 秒）
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(() => {
      attempts++;
      const isReady = checkProvider();
      if (attempts >= maxAttempts || isReady) {
        clearInterval(interval);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [ready, authenticated, wallets]); // 添加 wallets 依赖

  const handleSign = async () => {
    if (!textToSign.trim()) {
      setError('请输入要签名的文本');
      return;
    }

    setIsSigning(true);
    setError(null);
    setSignature(null);
    setSignerAddress(null);

    try {
      // 方法1: 尝试使用 getEthersProvider（如果可用）
      let provider: any = null;
      const currentState = privyStateRef.current;
      
      if (currentState.getEthersProvider && typeof currentState.getEthersProvider === 'function') {
        try {
          provider = await currentState.getEthersProvider();
          if (provider) {
            console.log('✅ 使用 getEthersProvider 获取 provider');
          }
        } catch (err) {
          console.warn('⚠️ getEthersProvider 失败，尝试备用方法...', err);
        }
      }
      
      // 方法2: 如果 getEthersProvider 不可用，使用 wallets 获取 provider（Privy v3 推荐方法）
      if (!provider && currentState.wallets && currentState.wallets.length > 0) {
        console.log('📝 尝试从 wallets 获取 provider...', {
          walletsCount: currentState.wallets.length,
          walletTypes: currentState.wallets.map((w: any) => w.walletClientType)
        });
        
        // 优先使用 privy 嵌入钱包
        const embeddedWallet = currentState.wallets.find((w: any) => w.walletClientType === 'privy') || currentState.wallets[0];
        
        if (embeddedWallet && typeof embeddedWallet.getEthereumProvider === 'function') {
          try {
            console.log('🔍 调用 wallet.getEthereumProvider()...');
            const ethereumProvider = await embeddedWallet.getEthereumProvider();
            if (ethereumProvider) {
              // 使用 ethers v6 的 BrowserProvider
              provider = new ethers.BrowserProvider(ethereumProvider);
              console.log('✅ 使用 wallets.getEthereumProvider 获取 provider');
            }
          } catch (err: any) {
            console.error('❌ 从 wallets 获取 provider 失败:', err);
            console.error('错误详情:', {
              message: err.message,
              code: err.code,
              stack: err.stack
            });
          }
        } else {
          console.warn('⚠️ 钱包对象不包含 getEthereumProvider 方法:', {
            hasEmbeddedWallet: !!embeddedWallet,
            hasGetEthereumProvider: embeddedWallet && typeof embeddedWallet.getEthereumProvider === 'function',
            walletClientType: embeddedWallet?.walletClientType
          });
        }
      }
      
      // 如果两种方法都失败，抛出错误
      if (!provider) {
        console.error('❌ 无法获取 provider，最终状态:', {
          ready: currentState.ready,
          authenticated: currentState.authenticated,
          hasGetEthersProvider: !!currentState.getEthersProvider,
          walletsCount: currentState.wallets?.length || 0,
          wallets: currentState.wallets?.map((w: any) => ({ 
            address: w.address, 
            walletClientType: w.walletClientType,
            hasGetEthereumProvider: typeof w.getEthereumProvider === 'function'
          }))
        });
        throw new Error('无法获取钱包连接。请确保钱包已连接并已创建嵌入钱包。如果问题持续，请刷新页面后重试。');
      }

      // 获取 signer
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setSignerAddress(address);

      console.log('📝 准备签名文本:', textToSign);
      console.log('💼 签名者地址:', address);

      // 使用 ethers 的 signMessage 方法签名文本
      // 这会弹出钱包确认框
      const signedMessage = await signer.signMessage(textToSign);
      
      console.log('✅ 签名成功:', signedMessage);
      setSignature(signedMessage);
    } catch (err: any) {
      console.error('❌ 签名失败:', err);
      
      // 提供更友好的错误信息
      if (err.code === 'ACTION_REJECTED' || err.message?.includes('rejected') || err.message?.includes('User rejected')) {
        setError('签名被用户取消');
      } else if (err.code === 'INSUFFICIENT_FUNDS') {
        setError('余额不足（虽然签名不需要费用，但钱包可能有问题）');
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('签名失败: ' + String(err));
      }
    } finally {
      setIsSigning(false);
    }
  };

  const handleCopy = () => {
    if (signature) {
      navigator.clipboard.writeText(signature);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerify = async () => {
    if (!signature || !signerAddress || !textToSign) {
      setError('缺少签名信息，无法验证');
      return;
    }

    try {
      // 使用 ethers 验证签名
      const recoveredAddress = ethers.verifyMessage(textToSign, signature);
      const isValid = recoveredAddress.toLowerCase() === signerAddress.toLowerCase();
      
      if (isValid) {
        alert('✅ 签名验证成功！\n\n签名者地址: ' + recoveredAddress);
      } else {
        alert('❌ 签名验证失败！\n\n期望地址: ' + signerAddress + '\n恢复地址: ' + recoveredAddress);
      }
    } catch (err: any) {
      console.error('验证签名失败:', err);
      alert('验证签名时出错: ' + (err.message || String(err)));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">钱包签名测试</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wallet Status */}
        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">钱包状态:</span>
            {ready && authenticated ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-bold">已连接</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-bold">未连接</span>
              </div>
            )}
          </div>
          
          {/* 详细状态信息 */}
          {(process.env.NODE_ENV === 'development' || !providerReady) && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-500 space-y-1">
                <div>Ready: {ready ? '✅' : '❌'}</div>
                <div>Authenticated: {authenticated ? '✅' : '❌'}</div>
                <div>getEthersProvider: {getEthersProvider && typeof getEthersProvider === 'function' ? '✅' : '❌'}</div>
                <div>Wallets: {wallets?.length || 0} 个</div>
                <div>Wallets Ready: {wallets && wallets.length > 0 && wallets.some((w: any) => typeof w.getEthereumProvider === 'function') ? '✅' : '❌'}</div>
                <div>Provider Ready: {providerReady ? '✅' : '⏳'}</div>
              </div>
            </div>
          )}
          
          {!ready && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-600">钱包服务正在初始化，请稍候...</p>
            </div>
          )}
          
          {ready && !authenticated && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-600">请先在 Profile 页面连接 Privy 钱包</p>
            </div>
          )}
          
          {ready && authenticated && !providerReady && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2 text-xs text-yellow-600">
                <Loader className="w-3 h-3 animate-spin" />
                <span>等待钱包创建...（首次登录可能需要几秒钟创建嵌入钱包）</span>
              </div>
              {wallets && wallets.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">提示：如果等待时间过长，请刷新页面</p>
              )}
            </div>
          )}
          
          {signerAddress && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">签名者地址:</span>
                <span className="text-xs font-mono text-gray-700 break-all">{signerAddress}</span>
              </div>
            </div>
          )}
        </div>

        {/* Text Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            要签名的文本:
          </label>
          <textarea
            value={textToSign}
            onChange={(e) => setTextToSign(e.target.value)}
            placeholder="输入要签名的文本..."
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            rows={4}
            disabled={isSigning}
          />
        </div>

        {/* Sign Button */}
        <button
          onClick={handleSign}
          disabled={isSigning || !ready || !authenticated || !providerReady || !textToSign.trim()}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {isSigning ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              签名中...
            </>
          ) : !providerReady ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              等待钱包就绪...
            </>
          ) : (
            '签名文本'
          )}
        </button>
        
        {ready && authenticated && providerReady && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">钱包已就绪，可以开始签名测试</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-2 text-red-700">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Signature Result */}
        {signature && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-bold text-green-800">签名成功！</span>
            </div>
            
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                签名结果:
              </label>
              <div className="relative">
                <textarea
                  value={signature}
                  readOnly
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-mono break-all resize-none"
                  rows={4}
                />
                <button
                  onClick={handleCopy}
                  className="absolute top-2 right-2 p-1.5 hover:bg-gray-100 rounded transition"
                  title="复制签名"
                >
                  {copied ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={handleVerify}
              className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
            >
              验证签名
            </button>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="text-sm font-bold text-blue-900 mb-2">使用说明:</h3>
          <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
            <li>输入要签名的文本（可以是任意内容）</li>
            <li>点击"签名文本"按钮，钱包会弹出确认框</li>
            <li>在钱包中确认签名</li>
            <li>签名成功后，可以复制签名结果</li>
            <li>点击"验证签名"可以验证签名的有效性</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// 主组件：根据是否配置了 Privy 来选择使用哪个版本
const SignatureTestModal: React.FC<SignatureTestModalProps> = (props) => {
  if (hasPrivy) {
    return <SignatureTestModalWithPrivy {...props} />;
  } else {
    return <SignatureTestModalWithoutPrivy {...props} />;
  }
};

export default SignatureTestModal;

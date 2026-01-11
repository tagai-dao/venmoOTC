import React, { useState, useMemo, useEffect, useRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useApp } from '../context/AppContext';
import { User, Currency, Privacy, TransactionType, OTCState } from '../utils';
import { Services } from '../services';
import { sendUSDTWithPrivy } from '../services/privyBlockchainService';
import { ethers } from 'ethers';
import { X, Search, Globe, Users, Lock, ArrowDown, ChevronLeft, Twitter, Loader } from 'lucide-react';

interface Props {
  onClose: () => void;
  initialType?: TransactionType;
  initialUser?: User | null;
  initialAddress?: string | null;
}

const STICKERS = ['🍕', '☕️', '🎵', '🚗', '🍔', '🎁', '💡', '✈️'];

// Mock Exchange Rates (1 USDT = X Fiat)
const EXCHANGE_RATES: Record<string, number> = {
    [Currency.NGN]: 1650.00,
    [Currency.VES]: 45.50,
    [Currency.USD]: 1.00
};

// 检查是否配置了 Privy（确保与 App.tsx 中的 PrivyWrapper 逻辑完全一致）
const privyAppId = (import.meta.env as any).VITE_PRIVY_APP_ID || '';
const hasPrivy = !!(privyAppId && privyAppId.trim() !== '');

// 内部组件：只有在 PrivyProvider 存在时才调用 usePrivy
const OTCActionModalWithPrivy: React.FC<Props> = (props) => {
  // 只有在 PrivyProvider 存在时才调用 usePrivy
  // 注意：如果 PrivyProvider 没有正确初始化，usePrivy 会抛出错误
  // 这应该不会发生，因为 App.tsx 中的 PrivyWrapper 会根据 hasPrivy 决定是否渲染 PrivyProvider
  const privy = usePrivy();
  const { ready, authenticated, login: privyLogin } = privy;
  const { wallets, ready: walletsReady } = useWallets();
  
  // getEthersProvider 可能已被弃用，使用 wallets 来获取 provider
  // 如果 usePrivy 返回了 getEthersProvider，使用它；否则从 wallets 获取
  const getEthersProvider = async () => {
    // 尝试使用 usePrivy 返回的 getEthersProvider（如果存在）
    if ((privy as any).getEthersProvider && typeof (privy as any).getEthersProvider === 'function') {
      try {
        return await (privy as any).getEthersProvider();
      } catch (error) {
        console.warn('getEthersProvider from usePrivy failed, falling back to wallets');
      }
    }
    
    // 降级方案：从 wallets 获取 provider
    if (wallets.length > 0) {
      const wallet = wallets[0];
      if (typeof wallet.getEthereumProvider === 'function') {
        const ethereumProvider = await wallet.getEthereumProvider();
        return new ethers.BrowserProvider(ethereumProvider);
      }
    }
    return null;
  };
  
  return (
    <OTCActionModalContent
      {...props}
      ready={ready && walletsReady}
      authenticated={authenticated}
      getEthersProvider={getEthersProvider}
      privyLogin={privyLogin}
      wallets={wallets}
    />
  );
};

// 内部组件：没有 Privy 时的版本
const OTCActionModalWithoutPrivy: React.FC<Props> = (props) => {
  return (
    <OTCActionModalContent
      {...props}
      ready={false}
      authenticated={false}
      getEthersProvider={undefined}
      privyLogin={undefined}
      wallets={[]}
    />
  );
};

// 主要的 Modal 内容组件
interface ModalContentProps extends Props {
  ready: boolean;
  authenticated: boolean;
  getEthersProvider?: () => Promise<any>;
  privyLogin?: (options?: any) => Promise<void>;
  wallets?: any[];
}

const OTCActionModalContent: React.FC<ModalContentProps> = ({ 
  onClose, 
  initialType = TransactionType.REQUEST, 
  initialUser = null, 
  initialAddress = null,
  ready,
  authenticated,
  getEthersProvider,
  privyLogin,
  wallets = []
}) => {
  const { addTransaction, currentUser, friends, walletBalance } = useApp();
  const [step, setStep] = useState(initialUser || initialAddress ? 2 : 1);
  const [selectedUser, setSelectedUser] = useState<User | null>(initialUser);
  const [targetAddress, setTargetAddress] = useState<string | null>(initialAddress);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>(Currency.USDT);
  const [note, setNote] = useState('');
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<Privacy>(initialType === TransactionType.REQUEST ? Privacy.PUBLIC : Privacy.PUBLIC);
  const [otcTargetCurrency, setOtcTargetCurrency] = useState<Currency>(Currency.NGN);
  const [transactionType, setTransactionType] = useState<TransactionType>(initialType);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddressInput, setShowAddressInput] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [usdtBalance, setUsdtBalance] = useState<number | null>(null);
  const [ngnBalance, setNgnBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [tweetContent, setTweetContent] = useState<string>(''); // 推文内容（用户编写）
  
  // 使用 ref 存储最新的 Privy 状态，确保在异步函数中能访问到最新值
  const privyStateRef = useRef({ ready, authenticated, getEthersProvider, privyLogin, wallets });
  
  // 当 Privy 状态改变时，更新 ref
  useEffect(() => {
    privyStateRef.current = { ready, authenticated, getEthersProvider, privyLogin, wallets };
  }, [ready, authenticated, getEthersProvider, privyLogin, wallets]);
  
  // Direction: True = USDT -> Fiat (Selling USDT), False = Fiat -> USDT (Buying USDT)
  const [isUSDTSource, setIsUSDTSource] = useState(true);
  
  // 当选择 PUBLIC_X 或 OTC 设置改变时，自动生成推文内容预览
  // 使用 ref 跟踪用户是否手动编辑过推文内容
  const hasManuallyEditedTweet = useRef(false);
  
  useEffect(() => {
    // 如果用户已经手动编辑过推文，不再自动更新
    if (hasManuallyEditedTweet.current) return;
    
    if (transactionType === TransactionType.REQUEST && privacy === Privacy.PUBLIC_X) {
      const numAmount = parseFloat(amount);
      if (!numAmount || isNaN(numAmount)) {
        setTweetContent('');
        return;
      }
      
      const rate = EXCHANGE_RATES[otcTargetCurrency] || 1;
      const isOTC = transactionType === TransactionType.REQUEST;
      
      // 自动生成推文内容预览（用户仍可以编辑）
      let autoContent = '';
      
      if (isOTC) {
        let requestAmount = 0;
        let requestCurrency = currency;
        let offerAmount = 0;
        let offerCurrency = '';
        
        if (isUSDTSource) {
          // Offer USDT, Request Fiat
          requestAmount = numAmount * rate;
          requestCurrency = otcTargetCurrency;
          offerAmount = numAmount;
          offerCurrency = Currency.USDT;
          autoContent = `Requesting ${requestAmount.toFixed(2)} ${requestCurrency} (offering ${offerAmount} ${offerCurrency}) on VenmoOTC!${note ? `\n\n${note}` : ''}\n\n#DeFi #OTC #Crypto`;
        } else {
          // Offer Fiat, Request USDT
          requestAmount = numAmount / rate;
          requestCurrency = Currency.USDT;
          offerAmount = numAmount;
          offerCurrency = otcTargetCurrency;
          autoContent = `Requesting ${requestAmount.toFixed(2)} ${requestCurrency} for ${offerAmount.toFixed(2)} ${offerCurrency} on VenmoOTC!${note ? `\n\n${note}` : ''}\n\n#DeFi #OTC #Crypto`;
        }
      } else {
        // Regular Request
        autoContent = `${currentUser?.name || 'User'} (${currentUser?.handle || '@user'}) is requesting ${numAmount} ${currency}${note ? `\n\n${note}` : ''}\n\n#DeFi #Crypto`;
      }
      
      // 确保内容不超过 280 字符
      if (autoContent.length > 280) {
        autoContent = autoContent.substring(0, 277) + '...';
      }
      
      setTweetContent(autoContent);
    } else if (privacy !== Privacy.PUBLIC_X) {
      // 如果不再选择 PUBLIC_X，清空推文内容
      setTweetContent('');
      hasManuallyEditedTweet.current = false;
    }
  }, [transactionType, privacy, amount, currency, otcTargetCurrency, isUSDTSource, note, currentUser]);
  
  // 监听推文内容的输入，标记为手动编辑
  const handleTweetContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= 280) {
      setTweetContent(text);
      hasManuallyEditedTweet.current = true; // 标记为手动编辑
    }
  };
  
  // 在第二步打开时（选择支付对象之后），获取当前账户的真实余额
  useEffect(() => {
    if (step === 2 && currentUser) {
      const fetchCurrentBalance = async () => {
        setIsLoadingBalance(true);
        try {
          console.log('💰 第二步：获取当前连接账户的余额...');
          console.log('钱包地址:', currentUser.walletAddress);
          
          // 获取 USDT 余额（链上查询）
          try {
            const usdt = await Services.blockchain.getBalance(currentUser.walletAddress, Currency.USDT);
            setUsdtBalance(usdt);
            console.log('✅ USDT 余额已更新:', usdt);
          } catch (error) {
            console.error('获取 USDT 余额失败:', error);
            // 如果链上查询失败，使用 AppContext 中的余额作为降级
            setUsdtBalance(walletBalance[Currency.USDT] || 0);
          }
          
          // 获取 NGN 余额（数据库）
          try {
            const ngn = await Services.blockchain.getBalance(currentUser.walletAddress, Currency.NGN);
            setNgnBalance(ngn);
            console.log('✅ NGN 余额已更新:', ngn);
          } catch (error) {
            console.error('获取 NGN 余额失败:', error);
            // 使用 AppContext 中的余额作为降级
            setNgnBalance(walletBalance[Currency.NGN] || 0);
          }
        } catch (error) {
          console.error('获取余额失败:', error);
          // 使用 AppContext 中的余额作为降级
          setUsdtBalance(walletBalance[Currency.USDT] || 0);
          setNgnBalance(walletBalance[Currency.NGN] || 0);
        } finally {
          setIsLoadingBalance(false);
        }
      };
      
      fetchCurrentBalance();
    }
  }, [step, currentUser?.walletAddress, walletBalance]);

  // Calculate the Target Amount based on Exchange Rate
  const convertedAmount = useMemo(() => {
      const numAmount = parseFloat(amount);
      if (!amount || isNaN(numAmount)) return '';

      const rate = EXCHANGE_RATES[otcTargetCurrency] || 1;
      
      if (isUSDTSource) {
          // Input: USDT (Offer) -> Output: Fiat (Request)
          return (numAmount * rate).toFixed(2);
      } else {
          // Input: Fiat (Offer) -> Output: USDT (Request)
          return (numAmount / rate).toFixed(2);
      }
  }, [amount, otcTargetCurrency, isUSDTSource]);

  const handleSend = async () => {
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) return;

    if (!currentUser) return;

    // 支付时必须指定收款人（用户或地址）
    if (transactionType === TransactionType.PAYMENT && !selectedUser && !targetAddress) {
      alert('请选择收款人或输入收款地址');
      return;
    }

    // 验证：支付时不能给自己转账
    if (transactionType === TransactionType.PAYMENT && selectedUser && selectedUser.id === currentUser.id) {
      alert('不能给自己转账，请选择其他收款人');
      return;
    }

    // 验证：支付时不能向自己的地址转账
    if (transactionType === TransactionType.PAYMENT && targetAddress && targetAddress.toLowerCase() === currentUser.walletAddress.toLowerCase()) {
      alert('不能向自己的地址转账');
      return;
    }

    setIsSubmitting(true);

    const isOTC = transactionType === TransactionType.REQUEST;
    const rate = EXCHANGE_RATES[otcTargetCurrency] || 1;
    
    let finalAmount = numAmount;
    let finalCurrency = transactionType === TransactionType.PAYMENT ? Currency.USDT : currency;
    let finalOtcFiat = otcTargetCurrency;
    let finalOtcOfferAmount = 0;

    if (isOTC) {
        if (isUSDTSource) {
             // Offer USDT, Request Fiat. 
             finalAmount = numAmount * rate; // Request Amount (Fiat)
             finalCurrency = otcTargetCurrency;
             finalOtcFiat = Currency.USDT; // Counter Currency
             finalOtcOfferAmount = numAmount; // Offer Amount (USDT)
        } else {
             // Offer Fiat, Request USDT. 
             finalAmount = numAmount / rate; // Request Amount (USDT)
             finalCurrency = Currency.USDT;
             finalOtcFiat = otcTargetCurrency; // Counter Currency
             finalOtcOfferAmount = numAmount; // Offer Amount (Fiat)
        }
    }

    let finalNote = note;
    if (isOTC) {
        const directionTag = isUSDTSource 
            ? ` #${Currency.USDT}_to_${otcTargetCurrency}` 
            : ` #${otcTargetCurrency}_to_${Currency.USDT}`;
        
        const rateDisplay = `(@ ${rate})`;
        finalNote = `${note.trim()}${directionTag} ${rateDisplay}`;
    }

    // 如果是支付到地址（非联系人），toUser 应该为 null（因为地址不在用户表中）
    // 但我们需要在 note 中记录地址信息，以便显示
    let finalToUser: User | null = selectedUser;
    let finalNoteWithAddress = finalNote;
    
    if (transactionType === TransactionType.PAYMENT && !selectedUser && targetAddress) {
      // 支付到地址时，toUser 为 null，地址信息记录在 note 中
      finalToUser = null;
      finalNoteWithAddress = finalNote 
        ? `${finalNote}\n\n收款地址: ${targetAddress}`
        : `支付到地址: ${targetAddress}`;
    }

    // 存储 Privy 转账的交易哈希（如果成功）
    let privyTxHash: string | null = null;
    
    // 辅助函数：等待并获取 Privy provider（如果未登录则自动触发登录）
    const getPrivyProviderWithAutoLogin = async (maxWaitTime: number = 60000): Promise<any> => {
      const startTime = Date.now();
      const checkInterval = 500; // 每 500ms 检查一次
      
      // 首先检查是否已经可以获取 provider（使用 ref 中的最新值）
      const currentState = privyStateRef.current;
      
      // 方法1: 尝试使用 getEthersProvider
      if (currentState.ready && currentState.authenticated && 
          currentState.getEthersProvider && typeof currentState.getEthersProvider === 'function') {
        try {
          const provider = await currentState.getEthersProvider();
          if (provider) {
            console.log('✅ Privy 已连接，使用 getEthersProvider 获取 provider');
            return provider;
          }
        } catch (error) {
          console.log('⚠️ getEthersProvider 失败，尝试备用方法...', error);
        }
      }
      
      // 方法2: 尝试使用 wallets 获取 provider（Privy v3 推荐方法）
      if (currentState.ready && currentState.authenticated && 
          currentState.wallets && currentState.wallets.length > 0) {
        const embeddedWallet = currentState.wallets.find((w: any) => w.walletClientType === 'privy') || currentState.wallets[0];
        if (embeddedWallet && typeof embeddedWallet.getEthereumProvider === 'function') {
          try {
            const ethereumProvider = await embeddedWallet.getEthereumProvider();
            if (ethereumProvider) {
              const provider = new ethers.BrowserProvider(ethereumProvider);
              console.log('✅ Privy 已连接，使用 wallets.getEthereumProvider 获取 provider');
              return provider;
            }
          } catch (error) {
            console.log('⚠️ wallets.getEthereumProvider 失败，继续检查...', error);
          }
        }
      }
      
      // 如果未登录且两种方法都不可用，则触发登录
      const hasGetEthersProvider = currentState.getEthersProvider && typeof currentState.getEthersProvider === 'function';
      const hasWallets = currentState.wallets && currentState.wallets.length > 0 && 
                        currentState.wallets.some((w: any) => typeof w.getEthereumProvider === 'function');
      
      if (!currentState.ready || !currentState.authenticated) {
        console.log('⚠️ Privy 未连接，自动触发 Twitter 登录...');
        console.log('Privy 状态:', {
          ready: currentState.ready,
          authenticated: currentState.authenticated,
          hasGetEthersProvider: !!currentState.getEthersProvider,
          walletsCount: currentState.wallets?.length || 0,
          hasWallets: hasWallets,
          hasPrivyLogin: !!currentState.privyLogin
        });
        
        // 检查 Privy 是否就绪
        if (!currentState.ready) {
          throw new Error('Privy 钱包服务正在初始化，请稍候几秒钟后重试。');
        }
        
        if (!currentState.privyLogin) {
          throw new Error('无法连接钱包。请检查 Privy 配置。');
        }
        
        // 优先使用 Twitter 登录（会弹出 Privy Twitter 登录框）
        // 这样可以直接使用 Twitter 关联的 Privy 钱包地址
        let loginInitiated = false;
        try {
          console.log('🔐 正在触发 Twitter 登录...');
          
          // 调用 privyLogin 会打开 Privy 登录弹窗
          // 注意：这个函数会立即返回，不会等待用户完成登录
          const loginPromise = currentState.privyLogin({ loginMethod: 'twitter' });
          
          // 等待一小段时间，确保登录弹窗已打开
          await Promise.race([
            loginPromise,
            new Promise(resolve => setTimeout(resolve, 2000)) // 最多等待 2 秒
          ]);
          
          loginInitiated = true;
          console.log('✅ Twitter 登录弹窗应已打开，请完成登录...');
          console.log('📝 登录后将使用 Twitter 关联的 Privy 钱包地址进行支付');
          console.log('💡 如果未看到登录弹窗，请检查浏览器是否阻止了弹窗');
          
          // 再等待一小段时间让 Privy 开始处理
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (twitterError: any) {
          console.error('Twitter 登录失败:', twitterError);
          
          // 检查是否是用户取消
          if (twitterError?.code === 'USER_CANCELLED' || twitterError?.message?.includes('cancelled')) {
            throw new Error('登录已取消。请重新点击 Pay 并完成登录。');
          }
          
          // 如果 Twitter 登录失败，尝试通用登录（用户可以选择 Twitter）
          try {
            console.log('⚠️ Twitter 登录失败，尝试通用登录...');
            
            // 调用 privyLogin 会打开 Privy 登录弹窗
            const loginPromise = currentState.privyLogin();
            
            // 等待一小段时间，确保登录弹窗已打开
            await Promise.race([
              loginPromise,
              new Promise(resolve => setTimeout(resolve, 2000)) // 最多等待 2 秒
            ]);
            
            loginInitiated = true;
            console.log('✅ 通用登录弹窗应已打开，请完成登录...');
            console.log('💡 如果未看到登录弹窗，请检查浏览器是否阻止了弹窗');
            
            // 再等待一小段时间让 Privy 开始处理
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (fallbackError: any) {
            console.error('通用登录也失败:', fallbackError);
            
            // 检查是否是用户取消
            if (fallbackError?.code === 'USER_CANCELLED' || fallbackError?.message?.includes('cancelled')) {
              throw new Error('登录已取消。请重新点击 Pay 并完成登录。');
            }
            
            throw new Error('无法连接钱包。请检查 Privy 配置或稍后重试。');
          }
        }
        
        // 如果登录弹窗没有打开，给用户提示
        if (!loginInitiated) {
          throw new Error('登录弹窗未能打开。请检查浏览器是否阻止了弹窗，或刷新页面后重试。');
        }
      }
      
      // 轮询等待登录完成并获取 provider
      let attemptCount = 0;
      while (Date.now() - startTime < maxWaitTime) {
        attemptCount++;
        const elapsedTime = Date.now() - startTime;
        
        try {
          // 每次检查时，使用 ref 中的最新值
          const latestState = privyStateRef.current;
          
          // 详细日志
          if (attemptCount % 10 === 0) { // 每 5 秒输出一次详细日志
            const walletsReady = latestState.wallets && latestState.wallets.length > 0 && 
                              latestState.wallets.some((w: any) => typeof w.getEthereumProvider === 'function');
            console.log(`⏳ 等待 Privy 登录... (${Math.floor(elapsedTime / 1000)}s)`, {
              ready: latestState.ready,
              authenticated: latestState.authenticated,
              hasGetEthersProvider: !!latestState.getEthersProvider,
              isFunction: typeof latestState.getEthersProvider === 'function',
              walletsCount: latestState.wallets?.length || 0,
              hasWallets: walletsReady
            });
            console.log('💡 提示：如果看到 Privy 登录弹窗，请完成登录流程');
          }
          
          // 每 10 秒提醒用户一次
          if (attemptCount % 20 === 0 && elapsedTime > 10000) {
            console.warn(`⚠️ 已等待 ${Math.floor(elapsedTime / 1000)} 秒，请确认是否已完成 Privy 登录`);
          }
          
          // 首先检查状态
          if (!latestState.ready) {
            // Privy 还未就绪，继续等待
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            continue;
          }
          
          if (!latestState.authenticated) {
            // Privy 还未认证，继续等待
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            continue;
          }
          
          // 方法1: 尝试使用 getEthersProvider
          let provider: any = null;
          if (latestState.getEthersProvider && typeof latestState.getEthersProvider === 'function') {
            try {
              console.log('🔄 尝试使用 getEthersProvider 获取 provider...');
              provider = await latestState.getEthersProvider();
              if (provider) {
                console.log('✅ Privy 登录完成，钱包已连接（使用 getEthersProvider）');
                console.log('📊 登录耗时:', Math.floor(elapsedTime / 1000), '秒');
                return provider;
              }
            } catch (err: any) {
              console.log('⚠️ getEthersProvider 失败，尝试备用方法...', err.message);
            }
          }
          
          // 方法2: 尝试使用 wallets 获取 provider（Privy v3 推荐方法）
          if (!provider && latestState.wallets && latestState.wallets.length > 0) {
            const embeddedWallet = latestState.wallets.find((w: any) => w.walletClientType === 'privy') || latestState.wallets[0];
            if (embeddedWallet && typeof embeddedWallet.getEthereumProvider === 'function') {
              try {
                console.log('🔄 尝试使用 wallets.getEthereumProvider 获取 provider...');
                const ethereumProvider = await embeddedWallet.getEthereumProvider();
                if (ethereumProvider) {
                  provider = new ethers.BrowserProvider(ethereumProvider);
                  console.log('✅ Privy 登录完成，钱包已连接（使用 wallets.getEthereumProvider）');
                  console.log('📊 登录耗时:', Math.floor(elapsedTime / 1000), '秒');
                  return provider;
                }
              } catch (err: any) {
                console.log('⚠️ wallets.getEthereumProvider 失败，继续等待...', err.message);
              }
            }
          }
          
          // 如果两种方法都失败，继续等待
          if (!provider) {
            if (attemptCount % 10 === 0) {
              console.log('⏳ 等待钱包连接...', {
                hasGetEthersProvider: !!latestState.getEthersProvider,
                walletsCount: latestState.wallets?.length || 0
              });
            }
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            continue;
          }
        } catch (error: any) {
          // 如果获取 provider 失败，记录错误但继续等待
          const errorMsg = error?.message || String(error);
          
          // 如果是"未认证"相关的错误，继续等待
          if (errorMsg.includes('not authenticated') || 
              errorMsg.includes('not ready') ||
              errorMsg.includes('not connected') ||
              errorMsg.includes('not logged in')) {
            if (attemptCount % 10 === 0) {
              console.log(`⏳ 等待 Privy 登录完成... (${Math.floor(elapsedTime / 1000)}s) - ${errorMsg}`);
            }
          } else {
            // 其他错误，详细记录
            console.warn('⚠️ 获取 Privy provider 时出错:', errorMsg);
          }
        }
        
        // 等待一段时间后再次检查
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
      
      // 超时前，最后一次尝试
      console.log('⏳ 超时前最后一次尝试获取 provider...');
      try {
        const finalState = privyStateRef.current;
        
        // 方法1: 尝试 getEthersProvider
        if (finalState.ready && finalState.authenticated && 
            finalState.getEthersProvider && typeof finalState.getEthersProvider === 'function') {
          try {
            const provider = await finalState.getEthersProvider();
            if (provider) {
              console.log('✅ 最后一次尝试成功（使用 getEthersProvider）！');
              return provider;
            }
          } catch (err) {
            console.warn('⚠️ 最后一次尝试 getEthersProvider 失败:', err);
          }
        }
        
        // 方法2: 尝试 wallets
        if (finalState.ready && finalState.authenticated && 
            finalState.wallets && finalState.wallets.length > 0) {
          const embeddedWallet = finalState.wallets.find((w: any) => w.walletClientType === 'privy') || finalState.wallets[0];
          if (embeddedWallet && typeof embeddedWallet.getEthereumProvider === 'function') {
            try {
              const ethereumProvider = await embeddedWallet.getEthereumProvider();
              if (ethereumProvider) {
                const provider = new ethers.BrowserProvider(ethereumProvider);
                console.log('✅ 最后一次尝试成功（使用 wallets.getEthereumProvider）！');
                return provider;
              }
            } catch (err) {
              console.warn('⚠️ 最后一次尝试 wallets.getEthereumProvider 失败:', err);
            }
          }
        }
      } catch (error: any) {
        console.error('❌ 最后一次尝试也失败:', error?.message);
      }
      
      // 输出最终状态用于调试
      const finalState = privyStateRef.current;
      const finalHasWallets = finalState.wallets && finalState.wallets.length > 0 && 
                        finalState.wallets.some((w: any) => typeof w.getEthereumProvider === 'function');
      
      console.error('❌ Privy 登录超时', {
        ready: finalState.ready,
        authenticated: finalState.authenticated,
        hasGetEthersProvider: !!finalState.getEthersProvider,
        isFunction: typeof finalState.getEthersProvider === 'function',
        walletsCount: finalState.wallets?.length || 0,
        hasWallets: finalHasWallets,
        elapsedTime: Math.floor((Date.now() - startTime) / 1000) + '秒'
      });
      
      // 提供更详细的错误信息
      let errorMessage = '登录超时，请重试。';
      if (!finalState.ready) {
        errorMessage += '\n\nPrivy 钱包服务未就绪，请刷新页面后重试。';
      } else if (!finalState.authenticated) {
        errorMessage += '\n\n未检测到登录完成。请确认：\n1. 是否看到了 Privy 登录弹窗？\n2. 是否完成了 Twitter 登录？\n3. 登录弹窗是否已关闭？';
      } else if (!finalState.getEthersProvider && !finalHasWallets) {
        errorMessage += '\n\n登录已完成，但钱包连接不可用。请刷新页面后重试。\n\n提示：如果钱包已创建，请尝试刷新页面。';
      } else {
        errorMessage += '\n\n钱包服务可能尚未完全初始化，请刷新页面后重试。';
      }
      
      throw new Error(errorMessage);
    };
    
    try {
      // 所有 USDT 支付都需要 Privy 发送真实的 USDT（不管是支付给联系人还是外部地址）
      // Request 不需要 Privy（因为 Request 是请求，不是支付）
      if (transactionType === TransactionType.PAYMENT && finalCurrency === Currency.USDT) {
        // 确定收款地址
        const recipientAddress = selectedUser?.walletAddress || targetAddress;
        
        if (!recipientAddress) {
          alert('请选择收款人或输入收款地址');
          setIsSubmitting(false);
          return;
        }
        
        console.log('💳 USDT 支付，准备发送...');
        console.log('收款地址:', recipientAddress);
        console.log('金额:', numAmount);
        
        try {
          // 检查 Privy 是否已配置
          if (!hasPrivy) {
            alert('钱包功能未启用。\n\n要启用钱包功能，请：\n1. 在项目根目录创建 .env 文件\n2. 添加：VITE_PRIVY_APP_ID=你的_privy_app_id\n3. 重启开发服务器\n\n详情请参考 PRIVY_SETUP.md 文件。');
            setIsSubmitting(false);
            return;
          }

          // 获取 Privy provider（如果未登录会自动触发登录并等待完成）
          console.log('🔗 获取 Privy provider...');
          const provider = await getPrivyProviderWithAutoLogin(60000);
          
          if (!provider) {
            throw new Error('无法获取钱包连接。请确保已连接 Privy 钱包。');
          }

          // 获取当前 Privy 钱包地址（用于日志记录）
          let senderAddress = 'Unknown';
          try {
            const signer = await provider.getSigner();
            senderAddress = await signer.getAddress();
            console.log('💼 使用 Privy 钱包地址:', senderAddress);
          } catch (error) {
            console.warn('无法获取发送方地址:', error);
          }
          
          // 使用 Privy 发送 USDT（会弹出签名确认框）
          console.log('📤 准备发送 USDT via Privy...');
          console.log('From: Privy 钱包地址', senderAddress);
          console.log('To:', recipientAddress);
          console.log('Amount:', numAmount, 'USDT');
          console.log('⏳ 等待用户确认签名...');
          
          // 调用 sendUSDTWithPrivy 会触发 Privy 的签名确认弹窗
          // 这将使用 Twitter 关联的 Privy 钱包地址进行支付
          privyTxHash = await sendUSDTWithPrivy(provider, recipientAddress, numAmount);
          
          if (!privyTxHash) {
            throw new Error('交易哈希为空，转账可能未成功');
          }
          
          console.log('✅ USDT sent successfully! TxHash:', privyTxHash);
          console.log('🔗 View on BscScan: https://bscscan.com/tx/' + privyTxHash);
          
          // 支付成功后，刷新余额
          if (currentUser) {
            try {
              const newUsdtBalance = await Services.blockchain.getBalance(currentUser.walletAddress, Currency.USDT);
              setUsdtBalance(newUsdtBalance);
              console.log('✅ USDT 余额已刷新:', newUsdtBalance);
            } catch (error) {
              console.error('刷新余额失败:', error);
            }
          }
          
          // 显示成功消息
          alert(`✅ USDT 发送成功！\n交易哈希: ${privyTxHash}\n\n您可以在 BscScan 上查看交易详情。`);
        } catch (error: any) {
          console.error('❌ Privy 支付失败:', error);
          console.error('错误详情:', {
            message: error?.message,
            code: error?.code,
            reason: error?.reason,
            stack: error?.stack
          });
          
          // 处理各种错误情况
          const errorMessage = error?.message || '支付失败，请重试';
          
          // 用户取消交易
          if (error?.code === 'ACTION_REJECTED' || errorMessage.includes('用户取消') || errorMessage.includes('rejected')) {
            console.log('用户取消了交易');
            setIsSubmitting(false);
            return; // 用户取消，不显示错误，直接返回
          }
          
          // 余额不足
          if (error?.code === 'INSUFFICIENT_FUNDS' || errorMessage.includes('余额不足')) {
            alert(`支付失败: 余额不足\n\n当前余额可能不足以支付 ${numAmount} USDT。`);
            setIsSubmitting(false);
            return;
          }
          
          // 其他错误
          alert(`支付失败: ${errorMessage}\n\n交易记录不会被创建。`);
          setIsSubmitting(false);
          return; // 重要：支付失败时，不创建交易记录
        }
      }
      
      await addTransaction({
        fromUser: currentUser,
        toUser: finalToUser,
        amount: finalAmount,
        currency: finalCurrency,
        note: finalNoteWithAddress,
        sticker: selectedSticker || undefined,
        privacy: privacy,
        type: transactionType,
        isOTC: isOTC,
        otcState: isOTC ? OTCState.OPEN_REQUEST : OTCState.NONE,
        otcFiatCurrency: isOTC ? finalOtcFiat : undefined,
        otcOfferAmount: isOTC ? finalOtcOfferAmount : undefined,
        likes: 0,
        comments: 0,
        // 如果选择 PUBLIC_X 且是 REQUEST，发送推文内容（如果有）
        tweetContent: (privacy === Privacy.PUBLIC_X && transactionType === TransactionType.REQUEST && tweetContent.trim()) 
          ? tweetContent.trim() 
          : undefined
      });
      
      setIsSubmitting(false);
      onClose();
    } catch (error: any) {
      console.error('交易创建失败:', error);
      alert(error?.message || '交易创建失败，请重试');
      setIsSubmitting(false);
    }
  };

  const renderRecipientSelect = () => (
    <div className="h-full flex flex-col">
       <div className="px-4 py-3 border-b flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input 
            placeholder="Name, @username, email..." 
            className="flex-1 bg-transparent outline-none text-lg"
            autoFocus
          />
       </div>
       <div className="flex-1 overflow-y-auto pb-20">
         {/* Request Flow: Specialized broad options */}
         {transactionType === TransactionType.REQUEST ? (
             <div className="divide-y border-b">
                 <button 
                    onClick={() => { setSelectedUser(null); setPrivacy(Privacy.PUBLIC_X); setStep(2); }}
                    className="w-full px-4 py-5 flex items-center gap-4 hover:bg-gray-50 transition text-left group"
                 >
                    <div className="w-14 h-14 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 group-hover:scale-105 transition-transform">
                        <Twitter className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-900 text-lg">Public on X</p>
                        <p className="text-sm text-slate-500">Post request to your X timeline</p>
                    </div>
                 </button>
                 <button 
                    onClick={() => { setSelectedUser(null); setPrivacy(Privacy.PUBLIC); setStep(2); }}
                    className="w-full px-4 py-5 flex items-center gap-4 hover:bg-gray-50 transition text-left group"
                 >
                    <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                        <Globe className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-900 text-lg">Public within the app</p>
                        <p className="text-sm text-slate-500">Post to the community feed</p>
                    </div>
                 </button>
                 <button 
                    onClick={() => { setSelectedUser(null); setPrivacy(Privacy.FRIENDS); setStep(2); }}
                    className="w-full px-4 py-5 flex items-center gap-4 hover:bg-gray-50 transition text-left group"
                 >
                    <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
                        <Users className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-900 text-lg">Friends ONLY</p>
                        <p className="text-sm text-slate-500">Only visible to your friends</p>
                    </div>
                 </button>
             </div>
         ) : (
            <>
                {/* 输入地址选项 */}
                {!showAddressInput ? (
                    <button 
                        onClick={() => setShowAddressInput(true)}
                        className="w-full px-4 py-4 flex items-center gap-3 hover:bg-gray-50 transition border-b"
                    >
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-xl">📝</span>
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-slate-900">输入钱包地址</p>
                            <p className="text-sm text-slate-500">直接输入以太坊地址进行支付</p>
                        </div>
                    </button>
                ) : (
                    <div className="w-full px-4 py-4 border-b bg-blue-50/30">
                        <div className="flex items-center gap-2 mb-3">
                            <button
                                onClick={() => {
                                    setShowAddressInput(false);
                                    setAddressInput('');
                                }}
                                className="p-1 hover:bg-gray-200 rounded-full transition"
                            >
                                <X className="w-4 h-4 text-gray-600" />
                            </button>
                            <p className="text-sm font-bold text-slate-900">输入以太坊地址</p>
                        </div>
                        <input
                            type="text"
                            value={addressInput}
                            onChange={(e) => setAddressInput(e.target.value)}
                            placeholder="0x..."
                            className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            autoFocus
                        />
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => {
                                    setShowAddressInput(false);
                                    setAddressInput('');
                                }}
                                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => {
                                    const trimmed = addressInput.trim();
                                    const isEthAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmed);
                                    if (isEthAddress) {
                                        setTargetAddress(trimmed);
                                        setSelectedUser(null);
                                        setShowAddressInput(false);
                                        setAddressInput('');
                                        setStep(2);
                                    } else {
                                        alert('请输入有效的以太坊地址（0x开头，42个字符）');
                                    }
                                }}
                                disabled={!addressInput.trim()}
                                className="flex-1 px-4 py-2 text-sm font-bold text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                确认
                            </button>
                        </div>
                    </div>
                )}
                <p className="px-4 py-2 text-xs font-bold text-gray-500 uppercase mt-2">联系人</p>
                {friends.length > 0 ? (
                    friends.map(f => (
                        <button 
                            key={f.id} 
                            onClick={() => { 
                                setSelectedUser(f); 
                                setTargetAddress(null);
                                setStep(2); 
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition"
                        >
                            <img src={f.avatar} alt={f.name} className="w-12 h-12 rounded-full object-cover" />
                            <div className="text-left">
                            <p className="font-bold text-slate-900">{f.name}</p>
                            <p className="text-sm text-slate-500">{f.handle}</p>
                            </div>
                        </button>
                    ))
                ) : (
                    <div className="px-4 py-8 text-center text-gray-400">
                        <p className="text-sm">No users found</p>
                    </div>
                )}
            </>
         )}
       </div>
    </div>
  );


  const renderAmountEntry = () => (
    <div className="h-full flex flex-col p-6 overflow-y-auto no-scrollbar pb-32">
      {/* Recipient Indicator */}
      <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setStep(1)} className="p-1 hover:bg-gray-100 rounded-full">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border">
             {selectedUser ? (
                <>
                  <img src={selectedUser.avatar} className="w-6 h-6 rounded-full" />
                  <span className="text-sm font-bold">{selectedUser.name}</span>
                </>
             ) : targetAddress ? (
                <>
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-xs">📝</span>
                  </div>
                  <span className="text-sm font-bold font-mono">
                    {targetAddress.substring(0, 6)}...{targetAddress.substring(38)}
                  </span>
                </>
             ) : (
                <>
                  {privacy === Privacy.PUBLIC_X ? (
                    <Twitter className="w-4 h-4 text-sky-500" />
                  ) : privacy === Privacy.PUBLIC ? (
                    <Globe className="w-4 h-4 text-blue-500" />
                  ) : (
                    <Users className="w-4 h-4 text-indigo-500" />
                  )}
                  <span className="text-sm font-bold">
                    {privacy === Privacy.PUBLIC_X ? 'Public on X' : privacy === Privacy.PUBLIC ? 'Public within app' : 'Friends'}
                  </span>
                </>
             )}
          </div>
      </div>

      {/* Dynamic Header / Amount Display */}
      {transactionType === TransactionType.PAYMENT ? (
          <div className="flex flex-col items-center mb-8">
             <div className="flex items-center justify-center gap-2">
                <span className="text-4xl font-bold">₮</span>
                <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="text-6xl font-bold w-40 text-center outline-none bg-transparent placeholder-gray-200"
                    autoFocus
                />
             </div>
             <p className="text-sm text-gray-400 mt-2">
               Balance: {Currency.USDT} {isLoadingBalance ? '...' : (usdtBalance !== null ? usdtBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00')}
             </p>
          </div>
      ) : (
          /* UNISWAP STYLE OTC INTERFACE */
          <div className="mb-6 relative">
              {/* Top Box (Source) */}
              <div className="bg-gray-100 rounded-2xl p-4 pb-8 transition-colors hover:bg-gray-200/70">
                  <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-gray-500">You Pay (Offer)</span>
                  </div>
                  <div className="flex justify-between items-center">
                      <input 
                          type="number" 
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0"
                          className="bg-transparent text-3xl font-bold outline-none w-1/2 placeholder-gray-400"
                          autoFocus
                      />
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm">
                          {isUSDTSource ? (
                               <span className="font-bold text-sm">₮ {Currency.USDT}</span>
                          ) : (
                               <select 
                                  value={otcTargetCurrency}
                                  onChange={(e) => setOtcTargetCurrency(e.target.value as Currency)}
                                  className="font-bold text-sm bg-transparent outline-none appearance-none pr-2"
                               >
                                  <option value={Currency.NGN}>NGN</option>
                                  <option value={Currency.VES}>VES</option>
                                  <option value={Currency.USD}>USD</option>
                               </select>
                          )}
                      </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-400 pl-1">
                      Balance: {isUSDTSource 
                        ? `${isLoadingBalance ? '...' : (usdtBalance !== null ? usdtBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00')} ₮`
                        : `${isLoadingBalance ? '...' : (ngnBalance !== null ? ngnBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00')} ${otcTargetCurrency}`}
                  </div>
              </div>

              {/* Arrow Toggle */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <button 
                    onClick={() => setIsUSDTSource(!isUSDTSource)}
                    className="bg-white p-2 rounded-xl border-4 border-white shadow-sm hover:bg-gray-50 transition active:scale-95"
                  >
                      <ArrowDown className="w-5 h-5 text-gray-600" />
                  </button>
              </div>

              {/* Bottom Box (Target) */}
              <div className="bg-gray-100 rounded-2xl p-4 pt-8 mt-1 transition-colors hover:bg-gray-200/70">
                  <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-gray-500">You Receive (Request)</span>
                  </div>
                  <div className="flex justify-between items-center">
                      <input 
                          type="text" 
                          value={convertedAmount}
                          readOnly
                          placeholder="0.00"
                          className="bg-transparent text-3xl font-bold outline-none w-1/2 text-gray-500 cursor-default"
                      />
                       <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm">
                          {!isUSDTSource ? (
                               <span className="font-bold text-sm">₮ {Currency.USDT}</span>
                          ) : (
                               <select 
                                  value={otcTargetCurrency}
                                  onChange={(e) => setOtcTargetCurrency(e.target.value as Currency)}
                                  className="font-bold text-sm bg-transparent outline-none appearance-none pr-2"
                               >
                                  <option value={Currency.NGN}>NGN</option>
                                  <option value={Currency.VES}>VES</option>
                                  <option value={Currency.USD}>USD</option>
                               </select>
                          )}
                      </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-400 pl-1">
                      Rate: 1 USDT ≈ {EXCHANGE_RATES[otcTargetCurrency]} {otcTargetCurrency}
                  </div>
              </div>
          </div>
      )}

      <div className="space-y-6 flex-1">
        <textarea 
            placeholder={transactionType === TransactionType.REQUEST ? "Describe payment method preference..." : "What's this for?"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-gray-100 rounded-2xl p-4 outline-none resize-none h-24 focus:ring-2 focus:ring-blue-100 transition text-sm"
        />

        {/* 推文内容输入框（仅在选择 PUBLIC_X 且是 REQUEST 时显示） */}
        {transactionType === TransactionType.REQUEST && privacy === Privacy.PUBLIC_X && (
          <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Twitter className="w-4 h-4 text-sky-600" />
              <p className="text-xs font-bold text-sky-900 uppercase">推文内容（将发布到 X）</p>
            </div>
            <textarea 
                placeholder="编写推文内容...（例如：Requesting 100 USDT for 165000 NGN on VenmoOTC! #DeFi #OTC）"
                value={tweetContent}
                onChange={handleTweetContentChange}
                className="w-full bg-white border border-sky-300 rounded-xl p-3 outline-none resize-none h-24 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition text-sm"
            />
            <div className="flex justify-between items-center text-xs">
              <span className="text-sky-600">后端将使用您的 Twitter accessToken 发布推文</span>
              <span className={`font-bold ${tweetContent.length > 260 ? 'text-red-500' : 'text-sky-600'}`}>
                {tweetContent.length}/280
              </span>
            </div>
            {!tweetContent.trim() && (
              <p className="text-xs text-amber-600 mt-1">⚠️ 如果留空，后端将自动生成推文内容</p>
            )}
          </div>
        )}

        <div>
            <p className="text-xs font-bold text-gray-400 uppercase mb-3 ml-1">Stickers</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {STICKERS.map(s => (
                    <button
                        key={s}
                        onClick={() => setSelectedSticker(selectedSticker === s ? null : s)}
                        className={`text-2xl p-3 rounded-xl border-2 transition-all flex-shrink-0
                            ${selectedSticker === s ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}
                    >
                        {s}
                    </button>
                ))}
            </div>
        </div>

        <div>
            <p className="text-xs font-bold text-gray-400 uppercase mb-3 ml-1">Privacy</p>
            <div className={`grid ${transactionType === TransactionType.REQUEST ? 'grid-cols-3' : 'grid-cols-3'} gap-2`}>
                {transactionType === TransactionType.REQUEST ? (
                    <>
                        <button 
                            onClick={() => setPrivacy(Privacy.PUBLIC_X)}
                            className={`flex flex-col items-center justify-center gap-1 p-2 h-16 rounded-2xl border-2 transition-all
                                ${privacy === Privacy.PUBLIC_X ? 'border-sky-500 bg-sky-50 text-sky-600' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}`}
                        >
                            <Twitter className="w-4 h-4" />
                            <span className="text-[9px] font-bold text-center leading-tight">Public on X</span>
                        </button>
                        <button 
                            onClick={() => setPrivacy(Privacy.PUBLIC)}
                            className={`flex flex-col items-center justify-center gap-1 p-2 h-16 rounded-2xl border-2 transition-all
                                ${privacy === Privacy.PUBLIC ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}`}
                        >
                            <Globe className="w-4 h-4" />
                            <span className="text-[9px] font-bold text-center leading-tight">Public in App</span>
                        </button>
                        <button 
                            onClick={() => setPrivacy(Privacy.FRIENDS)}
                            className={`flex flex-col items-center justify-center gap-1 p-2 h-16 rounded-2xl border-2 transition-all
                                ${privacy === Privacy.FRIENDS ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}`}
                        >
                            <Users className="w-4 h-4" />
                            <span className="text-[9px] font-bold text-center leading-tight">Friends</span>
                        </button>
                    </>
                ) : (
                    <>
                        <button 
                            onClick={() => setPrivacy(Privacy.PUBLIC)}
                            className={`flex flex-col items-center justify-center gap-1 p-2 h-16 rounded-2xl border-2 transition-all
                                ${privacy === Privacy.PUBLIC ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}`}
                        >
                            <Globe className="w-5 h-5" />
                            <span className="text-[10px] font-bold">Public</span>
                        </button>
                        <button 
                            onClick={() => setPrivacy(Privacy.FRIENDS)}
                            className={`flex flex-col items-center justify-center gap-1 p-2 h-16 rounded-2xl border-2 transition-all
                                ${privacy === Privacy.FRIENDS ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}`}
                        >
                            <Users className="w-5 h-5" />
                            <span className="text-[10px] font-bold">Friends</span>
                        </button>
                        <button 
                            onClick={() => setPrivacy(Privacy.PRIVATE)}
                            className={`flex flex-col items-center justify-center gap-1 p-2 h-16 rounded-2xl border-2 transition-all
                                ${privacy === Privacy.PRIVATE ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}`}
                        >
                            <Lock className="w-5 h-5" />
                            <span className="text-[10px] font-bold">Private</span>
                        </button>
                    </>
                )}
            </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t max-w-md mx-auto z-20">
        <div className="p-6">
          <button 
              disabled={!amount || isSubmitting}
              onClick={handleSend}
              className="w-full bg-blue-500 text-white py-4 rounded-2xl font-bold shadow-xl shadow-blue-500/30 disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all text-lg flex items-center justify-center gap-2"
          >
              {isSubmitting && <Loader className="w-5 h-5 animate-spin" />}
              {transactionType === TransactionType.PAYMENT ? 'Pay' : 'Request'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white w-full h-[90vh] sm:h-[600px] sm:w-[400px] sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden relative animate-in slide-in-from-bottom-10 duration-300">
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b">
           {step === 1 ? (
             <div className="flex gap-4 text-sm font-bold">
                <button 
                  onClick={() => setTransactionType(TransactionType.REQUEST)}
                  className={`pb-2 border-b-2 transition-colors ${transactionType === TransactionType.REQUEST ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
                >
                  Request
                </button>
                <button 
                  onClick={() => setTransactionType(TransactionType.PAYMENT)}
                  className={`pb-2 border-b-2 transition-colors ${transactionType === TransactionType.PAYMENT ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
                >
                  Pay
                </button>
             </div>
           ) : (
             <button onClick={() => setStep(1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
                <ChevronLeft className="w-6 h-6" />
             </button>
           )}
           
           <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
             <X className="w-6 h-6 text-gray-500" />
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
            {step === 1 ? renderRecipientSelect() : renderAmountEntry()}
        </div>
      </div>
    </div>
  );
};

// 主组件：根据是否配置了 Privy 来选择使用哪个版本
const OTCActionModal: React.FC<Props> = (props) => {
  // 根据是否配置了 Privy 来选择使用哪个版本
  if (hasPrivy) {
    return <OTCActionModalWithPrivy {...props} />;
  } else {
    return <OTCActionModalWithoutPrivy {...props} />;
  }
};

export default OTCActionModal;
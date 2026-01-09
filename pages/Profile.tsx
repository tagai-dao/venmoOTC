import React, { useState, useEffect, useMemo } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useApp } from '../context/AppContext';
import { Settings, LogOut, Wallet, User as UserIcon, QrCode, Twitter, Copy, ArrowUpRight, ArrowDownLeft, Globe, Loader } from 'lucide-react';
import { Currency, formatCurrency, Privacy, TransactionType, OTCState } from '../utils';
import QRCode from 'react-qr-code';
import FeedItem from '../components/FeedItem';
import { Services } from '../services';
import { getAllPrices, getBNBPriceInUSDT, getFiatRates } from '../services/priceService';

// 检查是否配置了 Privy
const hasPrivy = !!import.meta.env.VITE_PRIVY_APP_ID;

// 内部组件：只有在 PrivyProvider 存在时才调用 usePrivy
const ProfileWithPrivy: React.FC<{
  currentUser: any;
  walletBalance: any;
  isAuthenticated: boolean;
  login: any;
  logout: any;
  feed: any;
}> = ({ currentUser, walletBalance, isAuthenticated, login, logout, feed }) => {
  // 只有在 PrivyProvider 存在时才调用 usePrivy
  const { ready, authenticated, user: privyUser, login: privyLogin, logout: privyLogout } = usePrivy();
  
  // 获取钱包列表（用于检查钱包是否已创建）
  const { wallets } = useWallets();
  
  return (
    <ProfileContent
      currentUser={currentUser}
      walletBalance={walletBalance}
      isAuthenticated={isAuthenticated}
      login={login}
      logout={logout}
      feed={feed}
      ready={ready}
      authenticated={authenticated}
      privyUser={privyUser}
      privyLogin={privyLogin}
      privyLogout={privyLogout}
      wallets={wallets}
    />
  );
};

// 内部组件：没有 Privy 时的版本
const ProfileWithoutPrivy: React.FC<{
  currentUser: any;
  walletBalance: any;
  isAuthenticated: boolean;
  login: any;
  logout: any;
  feed: any;
}> = ({ currentUser, walletBalance, isAuthenticated, login, logout, feed }) => {
  return (
    <ProfileContent
      currentUser={currentUser}
      walletBalance={walletBalance}
      isAuthenticated={isAuthenticated}
      login={login}
      logout={logout}
      feed={feed}
      ready={false}
      authenticated={false}
      privyUser={null}
      privyLogin={async () => {}}
      privyLogout={async () => {}}
      wallets={[]}
    />
  );
};

// 主要的 Profile 内容组件
const ProfileContent: React.FC<{
  currentUser: any;
  walletBalance: any;
  isAuthenticated: boolean;
  login: any;
  logout: any;
  feed: any;
  ready: boolean;
  authenticated: boolean;
  privyUser: any;
  privyLogin: () => Promise<void>;
  privyLogout: () => Promise<void>;
  wallets?: any[];
}> = ({ currentUser, walletBalance, isAuthenticated, login, logout, feed, ready, authenticated, privyUser, privyLogin, privyLogout, wallets = [] }) => {
  const [showMyQR, setShowMyQR] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'requests'>('activity');
  const [isPrivySyncing, setIsPrivySyncing] = useState(false);
  const [bnbToUSDTRate, setBnbToUSDTRate] = useState<number>(300); // 默认值
  const [fiatRates, setFiatRates] = useState<Record<string, number>>({
    NGN: 1650.00,
    VES: 45.50,
    USD: 1.00,
  });
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  // 获取实时价格
  useEffect(() => {
    const fetchPrices = async () => {
      setIsLoadingPrices(true);
      try {
        const prices = await getAllPrices();
        setBnbToUSDTRate(prices.bnbToUSDT);
        setFiatRates(prices.fiatRates);
        console.log('✅ Prices updated:', prices);
      } catch (error) {
        console.error('Failed to fetch prices:', error);
      } finally {
        setIsLoadingPrices(false);
      }
    };

    // 立即获取一次
    fetchPrices();

    // 每 60 秒更新一次价格
    const interval = setInterval(fetchPrices, 60000);

    return () => clearInterval(interval);
  }, []);

  // 计算总价值（USDT + BNB 转换为 USDT）
  const totalValueInUSDT = useMemo(() => {
    const usdtBalance = walletBalance[Currency.USDT] || 0;
    const bnbBalance = walletBalance.bnb || 0;
    const bnbInUSDT = bnbBalance * bnbToUSDTRate;
    return usdtBalance + bnbInUSDT;
  }, [walletBalance, bnbToUSDTRate]);

  // 转换为法币显示
  const convertedBalances = useMemo(() => {
    return {
      [Currency.NGN]: totalValueInUSDT * (fiatRates.NGN || 1650),
      [Currency.VES]: totalValueInUSDT * (fiatRates.VES || 45.5),
    };
  }, [totalValueInUSDT, fiatRates]);

  // 当 Privy 用户登录后，确保钱包已创建并同步到后端
  // 这个 useEffect 会在以下情况触发：
  // 1. 用户首次登录（Privy authenticated 变为 true）
  // 2. 页面刷新后，Privy 自动恢复 authenticated 状态
  useEffect(() => {
    const syncPrivyUser = async () => {
      if (!ready || !authenticated || !privyUser) return;
      
      // 检查是否已经同步过（通过比较 Privy 用户 ID 和 localStorage 中的用户信息）
      const savedUser = Services.auth.getCurrentUser();
      const savedPrivyUserId = localStorage.getItem('privy_user_id');
      const savedTwitterUsername = localStorage.getItem('privy_twitter_username');
      
      // 检查 Twitter 账号是否匹配（如果之前是用 Twitter 登录的）
      const currentTwitterUsername = privyUser.twitter?.username;
      const twitterMatches = !savedTwitterUsername || !currentTwitterUsername || 
                             savedTwitterUsername === currentTwitterUsername;
      
      // 如果已经同步过且 Privy 用户 ID 匹配，且 Twitter 账号匹配（如果存在），则不需要重新同步
      if (savedUser && savedPrivyUserId === privyUser.id && twitterMatches && isAuthenticated && currentUser) {
        console.log('✅ Privy session already synced, skipping...');
        console.log('💾 Twitter 和 Privy 钱包登录状态已恢复');
        return;
      }
      
      // 如果 Privy 用户 ID 匹配但 Twitter 账号不匹配，说明用户切换了 Twitter 账号，需要重新同步
      if (savedPrivyUserId === privyUser.id && !twitterMatches) {
        console.log('⚠️ Twitter 账号已更改，需要重新同步...');
      }
      
      setIsPrivySyncing(true);
      try {
        console.log('🔄 Syncing Privy user to backend...');
        console.log('👤 Privy user:', privyUser);
        console.log('💼 Wallets:', wallets);
        
        // 等待钱包创建（Privy 配置了 createOnLogin: 'all-users'，应该会自动创建）
        let walletAddress: string | null = null;
        let attempts = 0;
        const maxAttempts = 10; // 最多等待 5 秒
        
        // 轮询检查钱包是否已创建
        while (!walletAddress && attempts < maxAttempts) {
          // 方法1: 从 privyUser.wallet 获取
          if (privyUser.wallet) {
            walletAddress = privyUser.wallet.address;
            console.log('💼 Found wallet in privyUser.wallet:', walletAddress);
            break;
          }
          
          // 方法2: 从 wallets 数组获取
          if (wallets.length > 0 && wallets[0].address) {
            walletAddress = wallets[0].address;
            console.log('💼 Found wallet in wallets array:', walletAddress);
            break;
          }
          
          // 等待钱包创建
          if (attempts < maxAttempts - 1) {
            console.log(`⏳ Waiting for wallet creation... (attempt ${attempts + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          attempts++;
        }
        
        if (!walletAddress) {
          console.error('❌ No wallet address found after login');
          // 不立即返回错误，尝试使用 privyUser.id 作为临时标识
          // Privy 应该会自动创建钱包，可能需要更多时间
          console.warn('⚠️ Wallet not yet created, will retry on next sync');
          setIsPrivySyncing(false);
          return;
        }
        
        console.log('💼 Using wallet address:', walletAddress);
        
        // 获取 Twitter 账号（如果有）
        const twitterAccount = privyUser.twitter;
        const handle = twitterAccount ? `@${twitterAccount.username}` : undefined;
        const name = twitterAccount?.name || privyUser.email?.address || 'User';
        const avatar = twitterAccount?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${walletAddress}`;
        
        console.log('📝 User info:', { handle, name, walletAddress });
        
        // 调用后端 API 同步用户
        const response = await Services.auth.loginWithPrivy({
          walletAddress,
          handle,
          name,
          avatar,
          privyUserId: privyUser.id,
        });
        
        console.log('✅ Privy user synced:', response.user.handle);
        
        // 保存 Privy 用户 ID 和 Twitter 信息到 localStorage，用于后续检查
        localStorage.setItem('privy_user_id', privyUser.id);
        if (twitterAccount) {
          localStorage.setItem('privy_twitter_username', twitterAccount.username);
          console.log('💾 Twitter 登录信息已保存:', twitterAccount.username);
        }
        
        // 更新应用状态
        await login();
        
        console.log('✅ Twitter 和 Privy 钱包登录状态已持久化');
        console.log('💾 刷新页面后会自动恢复登录状态');
      } catch (error: any) {
        console.error('❌ Failed to sync Privy user:', error);
        alert(`同步 Privy 用户失败: ${error?.message || '未知错误'}`);
      } finally {
        setIsPrivySyncing(false);
      }
    };
    
    syncPrivyUser();
  }, [ready, authenticated, privyUser, isAuthenticated, currentUser, login, wallets]);

  const handlePrivyLogin = async () => {
    if (!ready) {
      console.warn('⚠️ Privy is not ready yet');
      throw new Error('钱包服务正在初始化，请稍候几秒钟后重试');
    }
    
    try {
      console.log('🔗 Attempting to connect Privy wallet via Twitter...');
      console.log('📍 Current URL:', window.location.href);
      console.log('🔑 Privy App ID:', import.meta.env.VITE_PRIVY_APP_ID ? '已配置' : '未配置');
      
      // 直接使用 Twitter 登录方式
      await privyLogin({ loginMethod: 'twitter' });
    } catch (error: any) {
      console.error('❌ Privy Twitter login error:', error);
      console.error('错误详情:', {
        message: error?.message,
        code: error?.code,
        name: error?.name,
        stack: error?.stack
      });
      
      // 检查是否是回调 URL 配置错误
      if (error?.message?.includes('Something went wrong') || 
          error?.message?.includes('weren\'t able to give access')) {
        const errorMsg = `登录失败：回调 URL 配置错误\n\n请检查：\n1. Privy Dashboard > Settings > Redirect URIs\n2. 确保添加了：http://localhost:3000\n3. 保存后等待几秒再重试\n\n详细步骤请参考 PRIVY_SETUP.md`;
        alert(errorMsg);
        throw new Error('回调 URL 配置错误，请检查 Privy Dashboard 设置');
      }
      
      // 如果指定 Twitter 失败，尝试通用登录
      try {
        console.log('⚠️ Twitter login failed, trying general login...');
        await privyLogin();
      } catch (fallbackError: any) {
        console.error('❌ General login also failed:', fallbackError);
        const errorMsg = fallbackError?.message || '连接钱包失败，请重试';
        
        // 提供更友好的错误提示
        if (errorMsg.includes('Something went wrong') || 
            errorMsg.includes('weren\'t able to give access')) {
          alert(`登录失败：\n\n可能的原因：\n1. Privy Dashboard 中未配置回调 URL\n2. Twitter OAuth 配置错误\n3. 环境变量未正确加载\n\n请检查 PRIVY_SETUP.md 获取详细配置步骤`);
        }
        
        throw new Error(errorMsg);
      }
    }
  };

  const handlePrivyLogout = async () => {
    try {
      // 先调用应用的 logout，这会清除后端的 session 和 localStorage
      await logout();
      
      // 然后调用 Privy 的 logout，这会清除 Privy 的 session（包括持久化的 session）
      // 注意：Privy 的 logout 会清除所有 Privy 相关的 localStorage 数据
      await privyLogout();
      
      console.log('✅ Privy logout successful, session cleared');
    } catch (error: any) {
      console.error('Privy logout error:', error);
      // 即使 Privy logout 失败，也要确保应用状态已清除
      await logout();
    }
  };


  if (!isAuthenticated || !currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
         <div className="w-20 h-20 bg-blue-500 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/20">
             <span className="text-white font-bold text-3xl italic">V</span>
         </div>
         <h1 className="text-2xl font-bold mb-2">Welcome to VenmoOTC</h1>
         <p className="text-gray-500 text-center mb-8">The social way to pay and trade stablecoins.</p>
         
         <div className="w-full max-w-xs space-y-3">
            {/* Privy 登录按钮（支持 Twitter 登录） */}
            {ready ? (
              <button 
                onClick={handlePrivyLogin}
                disabled={isPrivySyncing || !ready}
                className="bg-blue-600 text-white w-full py-3 rounded-full font-bold flex items-center justify-center gap-3 hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPrivySyncing ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    同步中...
                  </>
                ) : (
                  <>
                    <Wallet className="w-5 h-5" />
                    使用 Privy 登录（支持 Twitter）
                  </>
                )}
              </button>
            ) : (
              <div className="bg-gray-100 text-gray-500 w-full py-3 rounded-full font-bold flex items-center justify-center gap-3">
                <Loader className="w-5 h-5 animate-spin" />
                钱包服务初始化中...
              </div>
            )}
         </div>
         <p className="mt-4 text-xs text-gray-400 text-center max-w-[280px]">
            使用 Privy 钱包登录，支持 Twitter 账号登录。首次登录将自动创建钱包。
         </p>
      </div>
    );
  }

  // Your Activity: 显示所有与当前用户相关的交易，但如果有对应的 Activity 支付记录，则只显示 Activity 记录，不显示原始 Request
  // Private 交易只对交易双方可见（这里已经通过 isRelated 过滤了，但为了明确性，我们保持这个逻辑）
  const personalFeed = feed.filter(t => {
    const isRelated = t.fromUser.id === currentUser.id || t.toUser?.id === currentUser.id;
    if (!isRelated) return false;
    
    // Private 交易只对交易双方可见（isRelated 已经保证了这一点）
    // 但为了安全，我们明确检查：如果交易是 Private，确保当前用户是交易双方之一
    if (t.privacy === Privacy.PRIVATE) {
      const isFromUser = t.fromUser.id === currentUser.id;
      const isToUser = t.toUser?.id === currentUser.id;
      if (!isFromUser && !isToUser) return false;
    }
    
    // 如果是 Request 类型的交易，检查是否存在对应的 Activity 支付记录
    if (t.type === TransactionType.REQUEST && t.isOTC) {
      const hasActivityRecord = feed.some(
        activity => activity.relatedTransactionId === t.id && 
                   activity.type === TransactionType.PAYMENT &&
                   (activity.fromUser.id === currentUser.id || activity.toUser?.id === currentUser.id)
      );
      // 如果存在 Activity 记录，则不显示原始 Request
      if (hasActivityRecord) return false;
    }
    
    return true;
  });

  // Updated filter: Capture all active OTC requests involving the user (excluding failed requests)
  const pendingRequests = feed.filter(t => {
      if (!t.isOTC || t.otcState === OTCState.NONE || t.otcState === OTCState.COMPLETED || t.otcState === OTCState.FAILED) return false;
      
      const isMyReq = t.fromUser.id === currentUser.id;
      const isMyFulfillment = t.toUser?.id === currentUser.id;

      // Both requester and payer should see active trades in their requests tab
      return isMyReq || isMyFulfillment;
  });

  return (
    <div className="pb-20">
       {/* Header */}
       <div className="bg-white px-6 pt-6 pb-4 border-b">
          <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                  <img src={currentUser.avatar} alt="Profile" className="w-16 h-16 rounded-full border-2 border-white shadow-lg" />
                  <div>
                      <h1 className="text-xl font-bold">{currentUser.name}</h1>
                      <p className="text-slate-500 text-sm">{currentUser.handle}</p>
                      {currentUser.isVerified && <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-bold rounded-full mt-1">Verified X Account</span>}
                  </div>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => setShowMyQR(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
                     <QrCode className="w-6 h-6" />
                 </button>
                 <button onClick={handlePrivyLogout} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
                     <Settings className="w-6 h-6" />
                 </button>
              </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 text-white shadow-xl relative">
             {/* Privy 钱包连接状态指示器 */}
             <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
                 {ready && authenticated ? (
                     <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/20 rounded-full border border-green-400/30">
                         <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                         <span className="text-[10px] font-bold text-green-300">已连接</span>
                     </div>
                 ) : (
                     <button
                         onClick={async (e) => {
                             e.preventDefault();
                             e.stopPropagation();
                             console.log('🔘 Connect wallet button clicked');
                             console.log('Privy ready:', ready);
                             console.log('Privy authenticated:', authenticated);
                             
                             if (!ready) {
                                 console.warn('⚠️ Privy is not ready yet');
                                 alert('钱包服务正在初始化，请稍候再试');
                                 return;
                             }
                             
                             try {
                                 await handlePrivyLogin();
                             } catch (error: any) {
                                 console.error('❌ Failed to connect wallet:', error);
                                 alert(`连接钱包失败: ${error?.message || '未知错误'}`);
                             }
                         }}
                         className={`flex items-center gap-1.5 px-2 py-1 rounded-full border transition-colors ${
                             ready 
                                 ? 'bg-yellow-500/20 border-yellow-400/30 hover:bg-yellow-500/30 active:bg-yellow-500/40 cursor-pointer' 
                                 : 'bg-gray-500/20 border-gray-400/30 opacity-50 cursor-not-allowed'
                         }`}
                         title={ready ? "点击连接钱包（支持 Twitter 登录）" : "钱包服务正在初始化..."}
                         type="button"
                         disabled={!ready}
                     >
                         <div className={`w-2 h-2 rounded-full ${ready ? 'bg-yellow-400' : 'bg-gray-400'}`}></div>
                         <span className={`text-[10px] font-bold ${ready ? 'text-yellow-300' : 'text-gray-300'}`}>未连接</span>
                     </button>
                 )}
             </div>
             <div className="flex justify-between items-center mb-2">
                 <span className="text-slate-400 text-sm font-medium flex items-center gap-2">
                     <Wallet className="w-4 h-4" /> Wallet Balance
                     {isLoadingPrices && <Loader className="w-3 h-3 animate-spin" />}
                 </span>
             </div>
             <div className="flex flex-col gap-1">
                 <div className="flex items-baseline gap-4">
                    <span className="text-3xl font-bold">{formatCurrency(walletBalance[Currency.USDT], Currency.USDT)}</span>
                    <span className="text-xl font-semibold opacity-90">BNB {walletBalance.bnb?.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) || '0.0000'}</span>
                 </div>
                 <div className="flex gap-4 mt-2 flex-wrap">
                    <span className="text-sm opacity-70">{formatCurrency(convertedBalances[Currency.NGN], Currency.NGN)}</span>
                    <span className="text-sm opacity-70">{formatCurrency(convertedBalances[Currency.VES], Currency.VES)}</span>
                 </div>
                 {/* 显示钱包地址 */}
                 <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <div className="flex items-center gap-2">
                       <span className="text-slate-400 text-xs font-medium">Wallet Address:</span>
                       <span className="text-xs font-mono text-slate-300 break-all">
                          {privyUser?.wallet?.address || currentUser.walletAddress}
                       </span>
                       <button
                          onClick={() => {
                            const address = privyUser?.wallet?.address || currentUser.walletAddress;
                            navigator.clipboard.writeText(address);
                            alert('钱包地址已复制到剪贴板');
                          }}
                          className="ml-auto p-1 hover:bg-slate-700/50 rounded transition"
                          title="复制钱包地址"
                       >
                          <Copy className="w-3 h-3 text-slate-400" />
                       </button>
                    </div>
                 </div>
             </div>
          </div>
       </div>

       {/* Fiat Account Section */}
       <div className="p-4 pb-0">
           <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
               <div className="flex justify-between items-center">
                   <h4 className="font-bold text-blue-900">Fiat Withdrawal Accounts</h4>
                   <button className="text-xs font-bold text-blue-600 bg-white px-3 py-1 rounded-full shadow-sm">Edit</button>
               </div>
               <div className="mt-3 text-sm text-blue-800">
                   <p>{currentUser.fiatDetails?.bankName} - •••• {currentUser.fiatDetails?.accountNumber.slice(-4)}</p>
               </div>
           </div>
       </div>

       {/* Tabs */}
       <div className="px-4 mt-6">
           <div className="flex items-center gap-8 border-b border-gray-100">
               <button
                 onClick={() => setActiveTab('activity')}
                 className={`pb-3 text-sm font-bold transition-colors ${activeTab === 'activity' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-gray-400 hover:text-gray-600'}`}
               >
                 Your Activity
               </button>
               <button
                 onClick={() => setActiveTab('requests')}
                 className={`pb-3 text-sm font-bold transition-colors relative ${activeTab === 'requests' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-gray-400 hover:text-gray-600'}`}
               >
                 Requests
                 {pendingRequests.length > 0 && (
                     <span className="absolute -top-1 -right-5 bg-red-500 text-white text-[10px] h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center border-2 border-white">
                         {pendingRequests.length}
                     </span>
                 )}
               </button>
           </div>
       </div>

       {/* Content Area */}
       <div className={activeTab === 'activity' ? 'p-4' : ''}>
           {activeTab === 'activity' && (
               personalFeed.length > 0 ? (
                    <div className="space-y-3">
                         {personalFeed.map(t => {
                            let isOutgoing = false;
                            let otherUser = null;

                            if (t.type === TransactionType.PAYMENT) {
                                isOutgoing = t.fromUser.id === currentUser.id;
                                otherUser = isOutgoing ? t.toUser : t.fromUser;
                            } else {
                                if (t.toUser?.id === currentUser.id) {
                                    isOutgoing = true; 
                                    otherUser = t.fromUser; 
                                } else {
                                    isOutgoing = false; 
                                    otherUser = t.toUser; 
                                }
                            }
                            
                            return (
                              <div key={t.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-gray-50 hover:border-gray-100 transition-colors">
                                   <div className="relative">
                                       {otherUser ? (
                                           <img src={otherUser.avatar} className="w-11 h-11 rounded-full object-cover border border-gray-100 shadow-sm" alt={otherUser.name} />
                                       ) : (
                                           <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 border border-blue-200">
                                               <Globe className="w-5 h-5" />
                                           </div>
                                       )}
                                       <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-white shadow-sm
                                           ${isOutgoing ? 'bg-black' : 'bg-green-500'}`}>
                                           {isOutgoing ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                                       </div>
                                   </div>

                                   <div className="flex-1 min-w-0">
                                       <div className="flex justify-between items-start">
                                           <span className="font-bold text-sm text-slate-900 truncate mt-0.5">
                                               {otherUser ? (
                                                   <>
                                                     <span className={`text-xs font-normal mr-1 ${isOutgoing ? 'text-gray-400' : 'text-green-600'}`}>{isOutgoing ? 'To' : 'From'}</span>
                                                     {otherUser.name}
                                                   </>
                                               ) : (
                                                   <span className="text-gray-500">{t.privacy === Privacy.PUBLIC ? 'Public Request' : t.privacy === Privacy.PUBLIC_X ? 'Public on X' : 'Friends Request'}</span>
                                               )}
                                           </span>
                                           
                                           <div className="flex flex-col items-end ml-2">
                                               <span className={`font-bold text-sm whitespace-nowrap ${isOutgoing ? 'text-slate-900' : 'text-green-600'}`}>
                                                   {isOutgoing ? '-' : '+'}{formatCurrency(t.amount, t.currency)}
                                               </span>
                                               {t.isOTC && t.otcOfferAmount && t.otcFiatCurrency && (
                                                   <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap">
                                                       {isOutgoing ? 'Get' : 'Give'} {formatCurrency(t.otcOfferAmount, t.otcFiatCurrency)}
                                                   </span>
                                               )}
                                           </div>
                                       </div>
                                       <div className="flex justify-between items-center">
                                           <span className="text-xs text-gray-400 truncate max-w-[140px] italic">
                                               {t.note || (isOutgoing ? 'Sent payment' : 'Received payment')}
                                           </span>
                                           <span className="text-[10px] text-gray-300 font-medium">
                                               {new Date(t.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                           </span>
                                       </div>
                                       
                                       {/* Highlight State in Activity */}
                                       {(() => {
                                         // 如果是 Activity 支付记录（有 relatedTransactionId），需要查找原始 Request 来获取状态
                                         let originalRequest = null;
                                         if (t.relatedTransactionId) {
                                           originalRequest = feed.find(r => r.id === t.relatedTransactionId);
                                         }
                                         const requestToCheck = originalRequest || t;
                                         
                                         if (requestToCheck.isOTC && requestToCheck.otcState !== OTCState.COMPLETED) {
                                           return (
                                             <div className="mt-1.5 flex items-center gap-2">
                                               {(requestToCheck.otcState === OTCState.AWAITING_FIAT_CONFIRMATION || requestToCheck.otcState === OTCState.AWAITING_FIAT_PAYMENT) && (
                                                 <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                   <Loader className="w-2.5 h-2.5 animate-spin" />
                                                   {requestToCheck.fromUser.id === currentUser.id ? "Need to release USDT" : `Waiting for ${requestToCheck.fromUser.name} to release`}
                                                 </span>
                                               )}
                                             </div>
                                           );
                                         }
                                         return null;
                                       })()}
                                   </div>
                              </div>
                            );
                         })}
                    </div>
               ) : (
                   <div className="text-center text-gray-400 py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                       <p className="text-sm font-medium">No recent transactions</p>
                   </div>
               )
           )}

           {activeTab === 'requests' && (
               <div className="border-t border-gray-100 -mx-4 sm:mx-0">
                   {pendingRequests.length > 0 ? (
                       pendingRequests.map(t => (
                           <FeedItem key={t.id} transaction={t} />
                       ))
                   ) : (
                       <div className="p-8 text-center text-gray-400">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🎉</div>
                            <p className="font-bold text-slate-700">All caught up!</p>
                            <p className="text-sm mt-1">No active trades.</p>
                       </div>
                   )}
               </div>
           )}
       </div>

       {/* QR Modal */}
       {showMyQR && (
           <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowMyQR(false)}>
               <div className="bg-white rounded-3xl p-8 w-full max-w-sm flex flex-col items-center" onClick={e => e.stopPropagation()}>
                   <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-white shadow-lg -mt-16 mb-4">
                       <img src={currentUser.avatar} alt="Me" className="w-full h-full object-cover" />
                   </div>
                   <h2 className="text-xl font-bold text-center mb-1">{currentUser.name}</h2>
                   <p className="text-gray-500 text-sm mb-6">{currentUser.handle}</p>
                   
                   <div className="p-4 bg-white border rounded-xl shadow-inner mb-6">
                        <QRCode value={currentUser.walletAddress} size={200} />
                   </div>
                   
                   <button className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-full hover:bg-gray-200 transition">
                       {currentUser.walletAddress.slice(0, 6)}...{currentUser.walletAddress.slice(-4)}
                       <Copy className="w-3 h-3" />
                   </button>
                   
                   <p className="mt-6 text-xs text-gray-400 text-center max-w-[200px]">Scan to pay USDT, USDC or other supported assets.</p>
               </div>
           </div>
       )}
    </div>
  );
};

// 主 Profile 组件：根据是否配置了 Privy 来选择使用哪个版本
const Profile: React.FC = () => {
  const { currentUser, walletBalance, isAuthenticated, login, logout, feed } = useApp();
  
  // 根据是否配置了 Privy 来选择使用哪个版本
  if (hasPrivy) {
    return (
      <ProfileWithPrivy
        currentUser={currentUser}
        walletBalance={walletBalance}
        isAuthenticated={isAuthenticated}
        login={login}
        logout={logout}
        feed={feed}
      />
    );
  } else {
    return (
      <ProfileWithoutPrivy
        currentUser={currentUser}
        walletBalance={walletBalance}
        isAuthenticated={isAuthenticated}
        login={login}
        logout={logout}
        feed={feed}
      />
    );
  }
};

export default Profile;
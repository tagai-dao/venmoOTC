import React, { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useApp } from '../context/AppContext';
import { Settings, LogOut, Wallet, User as UserIcon, QrCode, Twitter, Copy, ArrowUpRight, ArrowDownLeft, Globe, Loader } from 'lucide-react';
import { Currency, formatCurrency, Privacy, TransactionType, OTCState } from '../utils';
import QRCode from 'react-qr-code';
import FeedItem from '../components/FeedItem';
import { Services } from '../services';

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
}> = ({ currentUser, walletBalance, isAuthenticated, login, logout, feed, ready, authenticated, privyUser, privyLogin, privyLogout }) => {
  const [showMyQR, setShowMyQR] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'requests'>('activity');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [xHandle, setXHandle] = useState('');
  const [isPrivySyncing, setIsPrivySyncing] = useState(false);

  // 当 Privy 用户登录后，同步到后端
  useEffect(() => {
    const syncPrivyUser = async () => {
      if (!ready || !authenticated || !privyUser) return;
      if (isAuthenticated && currentUser) return; // 已经同步过了
      
      setIsPrivySyncing(true);
      try {
        console.log('🔄 Syncing Privy user to backend...');
        
        // 获取钱包地址
        const wallet = privyUser.wallet;
        if (!wallet) {
          console.error('No wallet found in Privy user');
          return;
        }
        
        const walletAddress = wallet.address;
        console.log('💼 Privy wallet address:', walletAddress);
        
        // 获取 Twitter 账号（如果有）
        const twitterAccount = privyUser.twitter;
        const handle = twitterAccount ? `@${twitterAccount.username}` : undefined;
        const name = twitterAccount?.name || privyUser.email?.address || 'User';
        const avatar = twitterAccount?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${walletAddress}`;
        
        // 调用后端 API 同步用户
        const response = await Services.auth.loginWithPrivy({
          walletAddress,
          handle,
          name,
          avatar,
          privyUserId: privyUser.id,
        });
        
        console.log('✅ Privy user synced:', response.user.handle);
        
        // 更新应用状态
        await login();
      } catch (error: any) {
        console.error('❌ Failed to sync Privy user:', error);
        alert(`同步 Privy 用户失败: ${error?.message || '未知错误'}`);
      } finally {
        setIsPrivySyncing(false);
      }
    };
    
    syncPrivyUser();
  }, [ready, authenticated, privyUser, isAuthenticated, currentUser, login]);

  const handlePrivyLogin = async () => {
    try {
      await privyLogin();
    } catch (error: any) {
      console.error('Privy login error:', error);
      alert(`Privy 登录失败: ${error?.message || '未知错误'}`);
    }
  };

  const handlePrivyLogout = async () => {
    try {
      await privyLogout();
      await logout();
    } catch (error: any) {
      console.error('Privy logout error:', error);
    }
  };

  const handleLogin = async () => {
      if (!xHandle.trim()) {
          alert('请输入 X 账号');
          return;
      }
      setIsLoggingIn(true);
      try {
          await login(xHandle.trim());
      } catch (error: any) {
          console.error('Login error:', error);
          const errorMessage = error?.message || '登录失败，请重试';
          alert(`登录失败: ${errorMessage}\n\n请确保：\n1. 服务器正在运行 (http://localhost:3001)\n2. 输入的账号格式正确 (例如: @crypto_native 或 crypto_native)`);
      } finally {
          setIsLoggingIn(false);
      }
  }

  const handleTwitterOAuth = () => {
      // 重定向到后端 Twitter OAuth 授权端点
      window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/twitter/authorize`;
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          handleLogin();
      }
  }

  if (!isAuthenticated || !currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
         <div className="w-20 h-20 bg-blue-500 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/20">
             <span className="text-white font-bold text-3xl italic">V</span>
         </div>
         <h1 className="text-2xl font-bold mb-2">Welcome to VenmoOTC</h1>
         <p className="text-gray-500 text-center mb-8">The social way to pay and trade stablecoins.</p>
         
         <div className="w-full max-w-xs space-y-3">
            {/* Privy 登录按钮 */}
            {ready && (
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
                    使用 Privy 登录（生成钱包）
                  </>
                )}
              </button>
            )}
            
            <div className="flex items-center gap-3 my-4">
               <div className="flex-1 h-px bg-gray-200"></div>
               <span className="text-xs text-gray-400">或</span>
               <div className="flex-1 h-px bg-gray-200"></div>
            </div>
            
            {/* Twitter OAuth 登录按钮 */}
            <button 
               onClick={handleTwitterOAuth}
               className="bg-black text-white w-full py-3 rounded-full font-bold flex items-center justify-center gap-3 hover:opacity-80 transition"
            >
               <Twitter className="w-5 h-5" />
               使用 Twitter 登录
            </button>
            
            <div className="flex items-center gap-3 my-4">
               <div className="flex-1 h-px bg-gray-200"></div>
               <span className="text-xs text-gray-400">或</span>
               <div className="flex-1 h-px bg-gray-200"></div>
            </div>
            
            {/* 通过 handle 登录（测试用） */}
            <div className="relative">
               <Twitter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
               <input
                  type="text"
                  value={xHandle}
                  onChange={(e) => setXHandle(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="输入 X 账号 (例如: @crypto_native)"
                  disabled={isLoggingIn}
                  className="w-full pl-12 pr-4 py-3 bg-gray-100 rounded-full outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition disabled:opacity-70 text-center"
               />
            </div>
            <button 
               onClick={handleLogin}
               disabled={isLoggingIn || !xHandle.trim()}
               className="bg-gray-200 text-gray-700 w-full py-3 rounded-full font-bold flex items-center justify-center gap-3 hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
               {isLoggingIn ? <Loader className="w-5 h-5 animate-spin" /> : <Twitter className="w-5 h-5" />}
               {isLoggingIn ? '登录中...' : '通过账号登录（测试）'}
            </button>
         </div>
         <p className="mt-4 text-xs text-gray-400 text-center max-w-[280px]">
            测试模式：输入 X 账号即可登录。可用账号：@crypto_native, @sarah_j, @mike_otc, @bella_ciao
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

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 text-white shadow-xl">
             <div className="flex justify-between items-center mb-2">
                 <span className="text-slate-400 text-sm font-medium flex items-center gap-2">
                     <Wallet className="w-4 h-4" /> Wallet Balance
                 </span>
             </div>
             <div className="flex flex-col gap-1">
                 <span className="text-3xl font-bold">{formatCurrency(walletBalance[Currency.USDT], Currency.USDT)}</span>
                 <div className="flex gap-4 mt-2">
                    <span className="text-sm opacity-70">{formatCurrency(walletBalance[Currency.NGN], Currency.NGN)}</span>
                    <span className="text-sm opacity-70">{formatCurrency(walletBalance[Currency.VES], Currency.VES)}</span>
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
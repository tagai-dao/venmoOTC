import React, { useState, useEffect, useMemo } from 'react';
import { usePrivy, useWallets, useOAuthTokens, useLoginWithOAuth } from '@privy-io/react-auth';
import { useApp } from '../context/AppContext';
import { Settings, LogOut, Wallet, User as UserIcon, QrCode, Twitter, Copy, ArrowUpRight, ArrowDownLeft, Globe, Loader, PenTool, Check, ExternalLink, Send } from 'lucide-react';
import { Currency, formatCurrency, Privacy, TransactionType, OTCState } from '../utils';
import QRCode from 'react-qr-code';
import FeedItem from '../components/FeedItem';
import SignatureTestModal from '../components/SignatureTestModal';
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
  
  // 用于启动 Twitter OAuth 授权流程
  const { initOAuth } = useLoginWithOAuth();
  
  // 用于存储 Twitter accessToken 状态
  const [twitterAccessTokenStatus, setTwitterAccessTokenStatus] = useState<'unknown' | 'checking' | 'granted' | 'not_granted'>('unknown');
  
  // 用于存储获取到的 accessToken（在 OAuth 授权完成后）
  const [pendingTwitterAccessToken, setPendingTwitterAccessToken] = useState<string | null>(null);
  
  // 用于存储获取到的 refreshToken（在 OAuth 授权完成后）
  const [pendingTwitterRefreshToken, setPendingTwitterRefreshToken] = useState<string | null>(null);
  
  // 用于存储并显示当前有效的 accessToken（用于调试）
  const [displayedAccessToken, setDisplayedAccessToken] = useState<string | null>(null);
  
  // 监听 Twitter 授权要求事件（当后端检测到需要重新授权时触发）
  useEffect(() => {
    const handleTwitterAuthRequired = (event: CustomEvent) => {
      console.log('🔔 Twitter 授权要求事件:', event.detail);
      const { reason, error } = event.detail;
      
      // 清除 Twitter 授权状态
      setTwitterAccessTokenStatus('not_granted');
      setPendingTwitterAccessToken(null);
      setDisplayedAccessToken(null);
      
      // 清除后端存储的无效 accessToken（通过调用 API）
      const clearInvalidToken = async () => {
        try {
          const savedUser = Services.auth.getCurrentUser();
          if (savedUser && savedUser.walletAddress) {
            // 通过更新用户信息来清除 accessToken（传递 null）
            await Services.auth.loginWithPrivy({
              walletAddress: savedUser.walletAddress,
              handle: savedUser.handle,
              name: savedUser.name,
              avatar: savedUser.avatar,
              privyUserId: localStorage.getItem('privy_user_id') || '',
              twitterAccessToken: '', // 传递空字符串来清除
            });
            console.log('✅ Cleared invalid Twitter accessToken');
          }
        } catch (error: any) {
          console.error('❌ Failed to clear invalid accessToken:', error.message);
        }
      };
      
      clearInvalidToken();
      
      // 显示提示信息
      const reasonText = reason === 'no_access_token' 
        ? '未授权 Twitter API 访问' 
        : 'Twitter accessToken 已过期或无效';
      
      alert(`⚠️ ${reasonText}\n\n${error || ''}\n\n请点击下方的"授权 Twitter API 访问"按钮重新授权。`);
    };
    
    window.addEventListener('twitter-auth-required', handleTwitterAuthRequired as EventListener);
    
    return () => {
      window.removeEventListener('twitter-auth-required', handleTwitterAuthRequired as EventListener);
    };
  }, []);
  
  // 获取 OAuth tokens（用于获取 Twitter accessToken）
  // 这个回调会在用户通过 Twitter OAuth 登录或授权时触发
  const {} = useOAuthTokens({
    onOAuthTokenGrant: async (params: any) => {
      const { oAuthTokens } = params;
      const { provider, accessToken, refreshToken } = oAuthTokens;
      
      console.log('🔔 OAuth token granted callback triggered:', { 
        provider, 
        hasAccessToken: !!accessToken, 
        hasRefreshToken: !!refreshToken,
        accessTokenLength: accessToken?.length || 0,
        accessTokenPreview: accessToken ? accessToken.substring(0, 30) + '...' : null,
      });
      
      if (provider === 'twitter') {
        if (accessToken) {
          console.log('✅ Twitter OAuth token granted via Privy');
          console.log('🔑 AccessToken (first 30 chars):', accessToken.substring(0, 30) + '...');
          console.log('🔑 AccessToken length:', accessToken.length);
          
          // 保存状态
          setDisplayedAccessToken(accessToken);
          setTwitterAccessTokenStatus('granted');
          setPendingTwitterAccessToken(accessToken);
          if (refreshToken) {
            setPendingTwitterRefreshToken(refreshToken);
            console.log('💾 RefreshToken 已保存:', refreshToken.substring(0, 30) + '...');
          }
          
          // 如果用户已经登录，立即将 accessToken 发送到后端
          const savedUser = Services.auth.getCurrentUser();
          const privyUserId = localStorage.getItem('privy_user_id');
          
          // 尝试立即发送 accessToken 到后端（如果用户已登录）
          try {
            const savedUser = Services.auth.getCurrentUser();
            const privyUserId = localStorage.getItem('privy_user_id');
            
            if (savedUser && savedUser.walletAddress && privyUserId) {
              console.log('📤 用户已登录，立即发送 accessToken 到后端...');
              try {
                const response = await Services.auth.loginWithPrivy({
                  walletAddress: savedUser.walletAddress,
                  handle: savedUser.handle,
                  name: savedUser.name,
                  avatar: savedUser.avatar,
                  privyUserId: privyUserId,
                  twitterAccessToken: accessToken,
                  twitterRefreshToken: refreshToken || undefined, // 传递 refreshToken（如果有）
                });
                console.log('✅ AccessToken 已发送到后端并存储:', response.user.handle);
                
                // 清除待处理的 accessToken（已经发送到后端）
                setPendingTwitterAccessToken(null);
                
                // 登录成功，无需显示弹窗，直接进入主页面
              } catch (error: any) {
                console.error('❌ 发送 accessToken 到后端失败:', error);
                console.log('ℹ️ AccessToken 已保存，将在下次同步时重试');
                alert(`⚠️ Twitter 登录成功，但存储 accessToken 到后端失败\n\n错误: ${error?.message || '未知错误'}\n\nAccess Token 已保存，将在下次同步时重试`);
              }
            } else {
              // 用户还未登录，accessToken 会在 syncPrivyUser 中发送
              console.log('ℹ️ 用户还未登录，Access Token 已获取，将在同步时发送到后端');
              // 登录成功，无需显示弹窗，直接进入主页面
            }
          } catch (error: any) {
            console.error('❌ 检查用户状态失败:', error);
            console.log('ℹ️ AccessToken 已保存，将在下次同步时发送');
            // 登录成功，无需显示弹窗，直接进入主页面
          }
        } else {
          console.error('❌ Twitter OAuth token granted but accessToken is missing!');
          alert('⚠️ Twitter 登录回调成功，但未获取到 Access Token\n\n请检查：\n1. Privy Dashboard 中的 Twitter OAuth 配置\n2. 是否启用了 "Return OAuth tokens"\n3. Scopes 是否包含必要的权限');
        }
      } else {
        console.log('ℹ️ OAuth token granted but not for Twitter:', { provider, hasAccessToken: !!accessToken });
      }
    },
  });
  
  // 监听登录状态，仅在调试时记录，不再弹出误导性的 alert
  useEffect(() => {
    if (authenticated && privyUser) {
      console.log('🔍 用户已登录，检查 Twitter 状态...');
      if (!displayedAccessToken && !pendingTwitterAccessToken && privyUser.twitter) {
        console.log('ℹ️ 当前前端会话未持有 accessToken，但后端可能已存储（发帖成功即可证明）。');
        // 不再 alert，因为这在刷新页面后是正常现象
      }
    }
  }, [authenticated, privyUser, displayedAccessToken, pendingTwitterAccessToken]);
  
  // 手动授权 Twitter API 访问
  const handleAuthorizeTwitter = async () => {
    try {
      console.log('🔐 Starting Twitter OAuth authorization...');
      setTwitterAccessTokenStatus('checking');
      await initOAuth({ provider: 'twitter' });
      // 注意：授权流程是异步的，onOAuthTokenGrant 回调会在授权完成后触发
    } catch (error: any) {
      console.error('❌ Failed to authorize Twitter:', error.message);
      setTwitterAccessTokenStatus('not_granted');
      alert(`Twitter 授权失败: ${error?.message || '未知错误'}`);
    }
  };
  
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
      onAuthorizeTwitter={handleAuthorizeTwitter}
      twitterAccessTokenStatus={twitterAccessTokenStatus}
      setTwitterAccessTokenStatus={setTwitterAccessTokenStatus}
      pendingTwitterAccessToken={pendingTwitterAccessToken}
      pendingTwitterRefreshToken={pendingTwitterRefreshToken}
      displayedAccessToken={displayedAccessToken}
      setDisplayedAccessToken={setDisplayedAccessToken}
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
      onAuthorizeTwitter={undefined}
      twitterAccessTokenStatus="unknown"
      setTwitterAccessTokenStatus={undefined}
      pendingTwitterAccessToken={null}
      pendingTwitterRefreshToken={null}
      displayedAccessToken={null}
      setDisplayedAccessToken={undefined}
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
  onAuthorizeTwitter?: () => Promise<void>;
  twitterAccessTokenStatus?: 'unknown' | 'checking' | 'granted' | 'not_granted';
  setTwitterAccessTokenStatus?: (status: 'unknown' | 'checking' | 'granted' | 'not_granted') => void;
  pendingTwitterAccessToken?: string | null;
  pendingTwitterRefreshToken?: string | null;
  displayedAccessToken?: string | null;
  setDisplayedAccessToken?: (token: string | null) => void;
}> = ({ currentUser, walletBalance, isAuthenticated, login, logout, feed, ready, authenticated, privyUser, privyLogin, privyLogout, wallets = [], onAuthorizeTwitter, twitterAccessTokenStatus = 'unknown', setTwitterAccessTokenStatus, pendingTwitterAccessToken = null, pendingTwitterRefreshToken = null, displayedAccessToken = null, setDisplayedAccessToken }) => {
  const { markAllNotificationsAsRead, refreshNotifications, unreadCount, setCurrentUser } = useApp();
  const [showMyQR, setShowMyQR] = useState(false);
  const [showSignatureTest, setShowSignatureTest] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'requests'>('activity');
  const [isPrivySyncing, setIsPrivySyncing] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false); // 登录按钮加载状态
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showFiatEditModal, setShowFiatEditModal] = useState(false);
  const [isSavingFiatDetails, setIsSavingFiatDetails] = useState(false);
  const [fiatFormData, setFiatFormData] = useState({
    accountName: currentUser?.fiatDetails?.accountName || '',
    accountNumber: currentUser?.fiatDetails?.accountNumber || '',
    bankName: currentUser?.fiatDetails?.bankName || '',
    country: currentUser?.fiatDetails?.country || '',
  });
  
  // 管理 Request 的已读状态（使用 localStorage）
  const getReadRequests = (): Set<string> => {
    if (!currentUser) return new Set();
    const key = `read_requests_${currentUser.id}`;
    const stored = localStorage.getItem(key);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  };
  
  const [readRequests, setReadRequests] = useState<Set<string>>(getReadRequests());
  
  // 当用户切换时，重新加载已读状态
  useEffect(() => {
    if (currentUser) {
      setReadRequests(getReadRequests());
    }
  }, [currentUser?.id]);
  
  const markRequestAsRead = (requestId: string) => {
    if (!currentUser) return;
    const newReadRequests = new Set(readRequests);
    newReadRequests.add(requestId);
    setReadRequests(newReadRequests);
    const key = `read_requests_${currentUser.id}`;
    localStorage.setItem(key, JSON.stringify(Array.from(newReadRequests)));
  };
  
  const markAllRequestsAsRead = () => {
    if (!currentUser) return;
    const allRequestIds = new Set(pendingRequests.map(r => r.id));
    setReadRequests(allRequestIds);
    const key = `read_requests_${currentUser.id}`;
    localStorage.setItem(key, JSON.stringify(Array.from(allRequestIds)));
  };
  
  const isRequestRead = (requestId: string): boolean => {
    return readRequests.has(requestId);
  };
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
        
        // 如果有待处理的 Twitter accessToken（从 OAuth 授权获取的），一并发送
        // 如果没有，尝试从 Privy 获取（如果用户是通过 Twitter 登录的）
        let twitterAccessToken: string | undefined = undefined;
        
        if (pendingTwitterAccessToken) {
          // 使用 OAuth 授权流程中获取的 accessToken
          console.log('📝 Using pending Twitter accessToken from OAuth grant');
          twitterAccessToken = pendingTwitterAccessToken;
        } else if (twitterAccount) {
          // 注意：Privy 的 user 对象可能不包含 accessToken，只有在 OAuth 授权时才能获取
          // 这里尝试从 localStorage 或其他地方获取，但主要依赖 useOAuthTokens 回调
          console.log('ℹ️ Twitter account found, but accessToken not available yet');
          console.log('💡 If user logged in via Twitter, accessToken should be obtained via useOAuthTokens callback');
        }
        
        // 获取 refreshToken（如果有）
        let twitterRefreshToken: string | undefined = undefined;
        if (pendingTwitterRefreshToken) {
          twitterRefreshToken = pendingTwitterRefreshToken;
          console.log('📝 Using pending Twitter refreshToken from OAuth grant');
        }

        // 调用后端 API 同步用户（如果提供了 accessToken，会一并存储）
        const response = await Services.auth.loginWithPrivy({
          walletAddress,
          handle,
          name,
          avatar,
          privyUserId: privyUser.id,
          ...(twitterAccessToken && { twitterAccessToken }),
          ...(twitterRefreshToken && { twitterRefreshToken }),
        });
        
        console.log('✅ Privy user synced:', response.user.handle);
        
        if (twitterAccessToken) {
          console.log('✅ Twitter accessToken 已发送到后端并存储');
          console.log('✅ AccessToken 长度:', twitterAccessToken.length);
        }
        
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
    // 注意：pendingTwitterAccessToken 不在依赖项中，因为：
    // 1. 如果用户已登录，accessToken 会在 onOAuthTokenGrant 回调中立即发送到后端
    // 2. 如果用户未登录，syncPrivyUser 会在用户登录后触发，此时 pendingTwitterAccessToken 已设置
    // 3. 添加 pendingTwitterAccessToken 到依赖项可能会导致循环更新
  }, [ready, authenticated, privyUser, isAuthenticated, currentUser, login, wallets, pendingTwitterAccessToken]);

  const handlePrivyLogin = async () => {
    // 防止重复点击
    if (isLoggingIn) {
      console.log('⚠️ Login already in progress, ignoring click');
      return;
    }

    if (!ready) {
      console.warn('⚠️ Privy is not ready yet');
      alert('钱包服务正在初始化，请稍候几秒钟后重试');
      return;
    }
    
    setIsLoggingIn(true);
    
    // 检测浏览器信息
    const browserInfo = {
      userAgent: navigator.userAgent,
      browser: (() => {
        if (navigator.userAgent.includes('Firefox')) return 'Firefox';
        if (navigator.userAgent.includes('Chrome')) return 'Chrome';
        if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) return 'Safari';
        return 'Unknown';
      })(),
      cookiesEnabled: navigator.cookieEnabled,
      localStorageAvailable: (() => {
        try {
          localStorage.setItem('test', 'test');
          localStorage.removeItem('test');
          return true;
        } catch {
          return false;
        }
      })(),
    };
    
    try {
      console.log('🔗 [LOGIN] 按钮被点击，开始登录流程...');
      console.log('📍 Current URL:', window.location.href);
      console.log('🔑 Privy App ID:', import.meta.env.VITE_PRIVY_APP_ID ? '已配置' : '未配置');
      console.log('🌐 Browser Info:', browserInfo);
      console.log('📝 登录流程：\n1. 调用 privyLogin() 发起 Twitter 登录\n2. 跳转到 Twitter 登录页面\n3. 用户完成登录后，Twitter 回调到 Privy\n4. Privy 通过 useOAuthTokens 回调将 accessToken 传到前端\n5. 前端显示 accessToken');
      
      // 检查 Privy 函数是否存在
      if (typeof privyLogin !== 'function') {
        throw new Error('privyLogin 函数不可用，请检查 Privy 配置');
      }
      
      console.log('🚀 调用 privyLogin({ loginMethod: "twitter" })...');
      
      // 直接使用 Twitter 登录方式
      await privyLogin({ loginMethod: 'twitter' });
      
      console.log('✅ privyLogin() 调用完成，等待 Twitter 回调...');
    } catch (error: any) {
      console.error('❌ Privy Twitter login error:', error);
      console.error('错误详情:', {
        message: error?.message,
        code: error?.code,
        name: error?.name,
        stack: error?.stack
      });
      
      // 获取当前 origin
      const currentOrigin = window.location.origin;
      const currentUrl = window.location.href;
      
      console.error('📍 当前访问地址:', currentOrigin);
      console.error('📍 完整 URL:', currentUrl);
      
      // 检查是否是 Origin not allowed 错误（这是最常见的错误）
      if (error?.message?.includes('Origin not allowed') || 
          error?.message?.includes('403') ||
          error?.code === 'n16' ||
          (error?.message && error.message.includes('not allowed'))) {
        const errorMsg = `❌ 登录失败：Origin 不被允许\n\n当前访问地址：${currentOrigin}\n\n🔧 解决方法：\n1. 访问 Privy Dashboard: https://dashboard.privy.io/\n2. 选择您的应用\n3. 进入 Settings > Redirect URIs\n4. 添加以下 URL（必须全部添加）：\n   • ${currentOrigin}\n   • ${currentOrigin}/\n   • http://localhost:3000\n   • http://localhost:3000/\n   • http://127.0.0.1:3000\n   • http://127.0.0.1:3000/\n5. 点击 Save 保存\n6. 等待几秒钟让配置生效\n7. 刷新页面后重试\n\n⚠️ 注意：localhost 和 127.0.0.1 被视为不同的域名，必须分别配置！`;
        alert(errorMsg);
        setIsLoggingIn(false);
        return;
      }
      
      // 检查是否是回调 URL 配置错误
      if (error?.message?.includes('Something went wrong') || 
          error?.message?.includes('weren\'t able to give access')) {
        const errorMsg = `登录失败：回调 URL 配置错误\n\n当前访问地址：${currentOrigin}\n\n请检查：\n1. Privy Dashboard > Settings > Redirect URIs\n2. 确保添加了：${currentOrigin} 和 ${currentOrigin}/\n3. 保存后等待几秒再重试\n\n详细步骤请参考 PRIVY_SETUP.md`;
        alert(errorMsg);
        setIsLoggingIn(false);
        return;
      }
      
      // 如果指定 Twitter 失败，尝试通用登录
      try {
        console.log('⚠️ Twitter login failed, trying general login...');
        await privyLogin();
        console.log('✅ General login initiated');
      } catch (fallbackError: any) {
        console.error('❌ General login also failed:', fallbackError);
        const errorMsg = fallbackError?.message || '连接钱包失败，请重试';
        
        // 提供更友好的错误提示
        const browserSpecificTip = browserInfo.browser === 'Chrome' || browserInfo.browser === 'Safari'
          ? '\n\n⚠️ 浏览器兼容性提示：\nChrome/Safari 可能阻止了第三方 Cookie 或弹窗。\n请尝试：\n1. 检查浏览器 Cookie 设置，允许第三方 Cookie（至少对于 localhost）\n2. 检查是否阻止了弹窗\n3. 清除浏览器缓存后重试\n4. 或使用 Firefox 浏览器'
          : '';
        
        alert(`登录失败：${errorMsg}${browserSpecificTip}\n\n请检查浏览器控制台获取更多信息。`);
        setIsLoggingIn(false);
      }
    } finally {
      // 注意：如果登录成功，Privy 会打开新窗口，这个状态会在窗口关闭后重置
      // 但如果登录失败，我们需要重置状态
      // 由于 Privy 的登录是异步的，我们设置一个超时来重置状态
      setTimeout(() => {
        setIsLoggingIn(false);
      }, 5000); // 5秒后重置，给 Privy 足够的时间打开登录窗口
    }
  };

  const handlePrivyLogout = async () => {
    try {
      console.log('🚪 开始退出应用...');
      
      // 同时执行 Privy 和应用退出，确保两个登录都退出
      // 使用 Promise.allSettled 确保即使某个退出失败，另一个也能执行
      const results = await Promise.allSettled([
        // 退出 Privy 登录（包括 Twitter 登录）
        privyLogout(),
        // 退出应用登录（清除后端 session 和 localStorage，并更新 isAuthenticated 状态）
        logout()
      ]);
      
      // 检查退出结果
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const serviceName = index === 0 ? 'Privy' : 'App';
          console.warn(`⚠️ ${serviceName} logout 失败:`, result.reason);
        } else {
          const serviceName = index === 0 ? 'Privy' : 'App';
          console.log(`✅ ${serviceName} logout 成功`);
        }
      });
      
      // 清除所有相关的 localStorage 数据（确保完全清除）
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
      localStorage.removeItem('privy_user_id');
      localStorage.removeItem('privy_twitter_username');
      
      console.log('✅ 退出成功：Privy 和应用登录都已退出');
      console.log('📄 页面将返回到欢迎页面（Welcome to TagPay）');
      
      // 注意：由于 logout() 已经设置了 setIsAuthenticated(false)，
      // App.tsx 会自动检测到 !isAuthenticated 并显示 Profile 页面的欢迎界面
    } catch (error: any) {
      console.error('❌ 退出过程中发生错误:', error);
      // 即使出错，也尝试清除本地状态和应用状态
      try {
        // 确保应用状态被清除（这会设置 isAuthenticated = false）
        await logout();
        // 清除所有 localStorage
        localStorage.removeItem('auth_token');
        localStorage.removeItem('current_user');
        localStorage.removeItem('privy_user_id');
        localStorage.removeItem('privy_twitter_username');
        console.log('✅ 已强制清除所有状态，页面将返回到欢迎页面');
      } catch (cleanupError) {
        console.error('❌ 清理状态时出错:', cleanupError);
      }
    }
  };

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // 处理保存法币账户信息
  const handleSaveFiatDetails = async () => {
    if (!fiatFormData.accountName || !fiatFormData.accountNumber || !fiatFormData.bankName) {
      alert('请填写所有必填字段（姓名、银行账号、银行名称）');
      return;
    }

    setIsSavingFiatDetails(true);
    try {
      const updatedUser = await Services.users.updateCurrentUser({
        accountName: fiatFormData.accountName,
        accountNumber: fiatFormData.accountNumber,
        bankName: fiatFormData.bankName,
        country: fiatFormData.country || undefined,
      });

      // 更新当前用户信息
      setCurrentUser(updatedUser);
      
      // 更新 localStorage
      localStorage.setItem('current_user', JSON.stringify(updatedUser));

      setShowFiatEditModal(false);
      alert('✅ 法币账户信息已保存');
    } catch (error: any) {
      console.error('Failed to save fiat details:', error);
      alert(`保存失败: ${error?.message || '未知错误'}`);
    } finally {
      setIsSavingFiatDetails(false);
    }
  };

  // 打开编辑模态框时初始化表单数据
  const handleOpenFiatEdit = () => {
    setFiatFormData({
      accountName: currentUser?.fiatDetails?.accountName || '',
      accountNumber: currentUser?.fiatDetails?.accountNumber || '',
      bankName: currentUser?.fiatDetails?.bankName || '',
      country: currentUser?.fiatDetails?.country || '',
    });
    setShowFiatEditModal(true);
  };

  // 国别列表
  const countries = [
    { code: '', name: '请选择国别' },
    { code: 'CN', name: '中国' },
    { code: 'US', name: '美国' },
    { code: 'GB', name: '英国' },
    { code: 'NG', name: '尼日利亚' },
    { code: 'VE', name: '委内瑞拉' },
    { code: 'IN', name: '印度' },
    { code: 'BR', name: '巴西' },
    { code: 'JP', name: '日本' },
    { code: 'KR', name: '韩国' },
    { code: 'SG', name: '新加坡' },
    { code: 'HK', name: '香港' },
    { code: 'TW', name: '台湾' },
    { code: 'AU', name: '澳大利亚' },
    { code: 'CA', name: '加拿大' },
    { code: 'DE', name: '德国' },
    { code: 'FR', name: '法国' },
    { code: 'IT', name: '意大利' },
    { code: 'ES', name: '西班牙' },
    { code: 'NL', name: '荷兰' },
    { code: 'BE', name: '比利时' },
    { code: 'CH', name: '瑞士' },
    { code: 'AT', name: '奥地利' },
    { code: 'SE', name: '瑞典' },
    { code: 'NO', name: '挪威' },
    { code: 'DK', name: '丹麦' },
    { code: 'FI', name: '芬兰' },
    { code: 'PL', name: '波兰' },
    { code: 'RU', name: '俄罗斯' },
    { code: 'ZA', name: '南非' },
    { code: 'EG', name: '埃及' },
    { code: 'KE', name: '肯尼亚' },
    { code: 'MX', name: '墨西哥' },
    { code: 'AR', name: '阿根廷' },
    { code: 'CL', name: '智利' },
    { code: 'CO', name: '哥伦比亚' },
    { code: 'PE', name: '秘鲁' },
    { code: 'PH', name: '菲律宾' },
    { code: 'TH', name: '泰国' },
    { code: 'VN', name: '越南' },
    { code: 'ID', name: '印度尼西亚' },
    { code: 'MY', name: '马来西亚' },
    { code: 'AE', name: '阿联酋' },
    { code: 'SA', name: '沙特阿拉伯' },
    { code: 'IL', name: '以色列' },
    { code: 'TR', name: '土耳其' },
    { code: 'OTHER', name: '其他' },
  ];


  if (!isAuthenticated || !currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
         <div className="w-20 h-20 bg-blue-500 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/20">
             <span className="text-white font-bold text-3xl italic">T</span>
         </div>
         <h1 className="text-2xl font-bold mb-2">Welcome to TagPay</h1>
         <p className="text-gray-500 text-center mb-8">The social way to pay and trade stablecoins.</p>
         
         <div className="w-full max-w-xs space-y-3">
            {/* Privy 登录按钮（支持 Twitter 登录） */}
            {ready ? (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🔘 [BUTTON] 登录按钮被点击');
                  handlePrivyLogin().catch((err) => {
                    console.error('❌ [BUTTON] 登录按钮错误处理:', err);
                    setIsLoggingIn(false);
                  });
                }}
                disabled={isPrivySyncing || !ready || isLoggingIn}
                className="bg-blue-600 text-white w-full py-3 rounded-full font-bold flex items-center justify-center gap-3 hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPrivySyncing || isLoggingIn ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    {isPrivySyncing ? '同步中...' : '正在登录...'}
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

  // 显示所有与用户相关的 OTC Request（包括失败和成功的）
  const pendingRequests = feed.filter(t => {
      // 只过滤掉非 OTC 交易或 NONE 状态的交易
      if (!t.isOTC || t.otcState === OTCState.NONE) return false;
      
      const isMyReq = t.fromUser.id === currentUser.id;
      const isMyFulfillment = t.toUser?.id === currentUser.id;

      // 显示所有与用户相关的 Request（包括发起者和交易者）
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
              <div className="flex gap-2 relative">
                 <button onClick={() => setShowMyQR(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full" title="显示二维码">
                     <QrCode className="w-6 h-6" />
                 </button>
                 {/* 测试钱包签名按钮 - 已隐藏 */}
                 {/* {ready && authenticated && (
                   <button 
                     onClick={() => setShowSignatureTest(true)} 
                     className="p-2 text-gray-600 hover:bg-gray-100 rounded-full" 
                     title="测试钱包签名"
                   >
                     <PenTool className="w-6 h-6" />
                 </button>
                 )} */}
                 <div className="relative z-50" onClick={(e) => e.stopPropagation()}>
                   <button
                     onClick={(e) => {
                       e.preventDefault();
                       e.stopPropagation();
                       setShowSettingsMenu(!showSettingsMenu);
                     }}
                     className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
                     title="设置"
                     type="button"
                     data-settings-button="true"
                   >
                       <Settings className="w-6 h-6" />
                   </button>

                   {/* 下拉设置菜单 */}
                   {showSettingsMenu && (
                     <>
                       {/* 点击空白处关闭 - 使用 div 而不是 button，避免意外触发其他事件 */}
                       <div
                         className="fixed inset-0 z-[45] cursor-default bg-transparent"
                         onClick={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           console.log('🔧 Closing settings menu (overlay clicked)');
                           setShowSettingsMenu(false);
                         }}
                         aria-label="close settings menu overlay"
                       />
                       <div 
                         className="absolute right-0 top-12 z-[50] w-52 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden mt-1"
                         onClick={(e) => {
                           // 防止菜单内部的点击事件冒泡到外层关闭按钮
                           e.preventDefault();
                           e.stopPropagation();
                         }}
                         onMouseDown={(e) => {
                           // 在 mousedown 阶段也阻止事件
                           e.preventDefault();
                           e.stopPropagation();
                         }}
                       >
                       <button
                         type="button"
                         onClick={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           setShowSettingsMenu(false);
                           handleOpenLink('https://x.com/TagAIDAO');
                         }}
                         className="w-full px-4 py-3 text-sm font-bold text-slate-800 hover:bg-gray-50 flex items-center justify-between transition-colors"
                       >
                         <span className="flex items-center gap-2">
                           <Twitter className="w-4 h-4 text-sky-500" />
                           Twitter
                         </span>
                         <ExternalLink className="w-4 h-4 text-gray-400" />
                       </button>

                       <button
                         type="button"
                         onClick={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           setShowSettingsMenu(false);
                           handleOpenLink('https://t.me/tagaidotfun');
                         }}
                         className="w-full px-4 py-3 text-sm font-bold text-slate-800 hover:bg-gray-50 flex items-center justify-between border-t border-gray-100 transition-colors"
                       >
                         <span className="flex items-center gap-2">
                           <Send className="w-4 h-4 text-blue-500" />
                           Telegram
                         </span>
                         <ExternalLink className="w-4 h-4 text-gray-400" />
                       </button>

                       <button
                         type="button"
                         onMouseDown={async (e) => {
                           // 在 mousedown 阶段就处理退出，确保在菜单容器的 mousedown 之前执行
                           e.preventDefault();
                           e.stopPropagation();
                           // 立即关闭菜单
                           setShowSettingsMenu(false);
                           // 执行退出逻辑
                           await handlePrivyLogout();
                         }}
                         className="w-full px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-100 transition-colors"
                       >
                         <LogOut className="w-4 h-4" />
                         退出应用
                       </button>
                       </div>
                     </>
                   )}
                 </div>
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
                   <button 
                     onClick={handleOpenFiatEdit}
                     className="text-xs font-bold text-blue-600 bg-white px-3 py-1 rounded-full shadow-sm hover:bg-blue-50 transition-colors"
                   >
                     Edit
                   </button>
               </div>
               <div className="mt-3 text-sm text-blue-800">
                   {currentUser.fiatDetails ? (
                     <p>{currentUser.fiatDetails.bankName} - •••• {currentUser.fiatDetails.accountNumber.slice(-4)}</p>
                   ) : (
                     <p className="text-gray-500">未设置法币账户信息</p>
                   )}
               </div>
           </div>
       </div>

       {/* Twitter API Authorization Section - 已隐藏 */}
       {/* {ready && authenticated && (
         <div className="p-4 pb-0">
           ... Twitter API 授权状态模块 ...
         </div>
       )} */}

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
                 {unreadCount > 0 && (
                     <span className="absolute -top-1 -right-5 bg-red-500 text-white text-[10px] h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center border-2 border-white">
                         {unreadCount}
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
                       <>
                           <div className="px-4 pt-4 pb-2 flex justify-end">
                               <button
                                   onClick={async () => {
                                       setIsMarkingAllRead(true);
                                       try {
                                           // 只标记所有 Request 为已读，不影响通知
                                           markAllRequestsAsRead();
                                           // 同时标记通知为已读（这样小红标会清零）
                                           await markAllNotificationsAsRead();
                                           await refreshNotifications();
                                           alert('✅ 已标记全部 Request 和通知为已读');
                                       } catch (error: any) {
                                           console.error('Failed to mark all as read:', error);
                                           alert(`标记失败: ${error?.message || '未知错误'}`);
                                       } finally {
                                           setIsMarkingAllRead(false);
                                       }
                                   }}
                                   disabled={isMarkingAllRead}
                                   className="text-xs font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                               >
                                   {isMarkingAllRead ? (
                                       <>
                                           <Loader className="w-3 h-3 animate-spin" />
                                           处理中...
                                       </>
                                   ) : (
                                       '全部已读'
                                   )}
                               </button>
                           </div>
                           {pendingRequests.map(t => (
                               <div key={t.id} className="relative">
                                   <FeedItem transaction={t} />
                                   {/* 已读标记 - 显示在右上角 */}
                                   <button
                                       onClick={(e) => {
                                           e.stopPropagation();
                                           if (!isRequestRead(t.id)) {
                                               markRequestAsRead(t.id);
                                           }
                                       }}
                                       className={`absolute top-4 right-4 z-10 p-1.5 rounded-full transition-all ${
                                           isRequestRead(t.id) 
                                               ? 'bg-green-50 hover:bg-green-100' 
                                               : 'bg-white/80 hover:bg-white shadow-sm'
                                       }`}
                                       title={isRequestRead(t.id) ? '已读' : '点击标记为已读'}
                                   >
                                       {isRequestRead(t.id) ? (
                                           <Check className="w-4 h-4 text-green-600" />
                                       ) : (
                                           <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
                                       )}
                                   </button>
                                   {/* 未读指示点 */}
                                   {!isRequestRead(t.id) && (
                                       <div className="absolute top-2 right-2 z-10 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white" />
                                   )}
                               </div>
                           ))}
                       </>
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

       {/* Signature Test Modal */}
       {showSignatureTest && (
         <SignatureTestModal onClose={() => setShowSignatureTest(false)} />
       )}

       {/* Fiat Account Edit Modal */}
       {showFiatEditModal && (
         <div 
           className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" 
           onClick={() => setShowFiatEditModal(false)}
         >
           <div 
             className="bg-white rounded-3xl p-6 w-full max-w-md flex flex-col max-h-[90vh] overflow-y-auto" 
             onClick={e => e.stopPropagation()}
           >
             <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-bold text-slate-900">编辑法币账户信息</h2>
               <button
                 onClick={() => setShowFiatEditModal(false)}
                 className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                 disabled={isSavingFiatDetails}
               >
                 <span className="text-2xl text-gray-400">×</span>
               </button>
             </div>

             <div className="space-y-4">
               {/* 姓名 */}
               <div>
                 <label className="block text-sm font-bold text-slate-700 mb-2">
                   姓名 <span className="text-red-500">*</span>
                 </label>
                 <input
                   type="text"
                   value={fiatFormData.accountName}
                   onChange={(e) => setFiatFormData({ ...fiatFormData, accountName: e.target.value })}
                   className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   placeholder="请输入账户持有人姓名"
                   disabled={isSavingFiatDetails}
                 />
               </div>

               {/* 银行账号 */}
               <div>
                 <label className="block text-sm font-bold text-slate-700 mb-2">
                   银行账号 <span className="text-red-500">*</span>
                 </label>
                 <input
                   type="text"
                   value={fiatFormData.accountNumber}
                   onChange={(e) => setFiatFormData({ ...fiatFormData, accountNumber: e.target.value })}
                   className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   placeholder="请输入银行账号"
                   disabled={isSavingFiatDetails}
                 />
               </div>

               {/* 银行名称 */}
               <div>
                 <label className="block text-sm font-bold text-slate-700 mb-2">
                   银行名称 <span className="text-red-500">*</span>
                 </label>
                 <input
                   type="text"
                   value={fiatFormData.bankName}
                   onChange={(e) => setFiatFormData({ ...fiatFormData, bankName: e.target.value })}
                   className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   placeholder="请输入银行名称"
                   disabled={isSavingFiatDetails}
                 />
               </div>

               {/* 国别 */}
               <div>
                 <label className="block text-sm font-bold text-slate-700 mb-2">
                   国别
                 </label>
                 <select
                   value={fiatFormData.country}
                   onChange={(e) => setFiatFormData({ ...fiatFormData, country: e.target.value })}
                   className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                   disabled={isSavingFiatDetails}
                 >
                   {countries.map((country) => (
                     <option key={country.code} value={country.code}>
                       {country.name}
                     </option>
                   ))}
                 </select>
               </div>
             </div>

             {/* 按钮组 */}
             <div className="flex gap-3 mt-6">
               <button
                 onClick={() => setShowFiatEditModal(false)}
                 className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-bold text-slate-700 hover:bg-gray-50 transition-colors"
                 disabled={isSavingFiatDetails}
               >
                 取消
               </button>
               <button
                 onClick={handleSaveFiatDetails}
                 disabled={isSavingFiatDetails || !fiatFormData.accountName || !fiatFormData.accountNumber || !fiatFormData.bankName}
                 className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
               >
                 {isSavingFiatDetails ? (
                   <>
                     <Loader className="w-4 h-4 animate-spin" />
                     保存中...
                   </>
                 ) : (
                   '保存'
                 )}
               </button>
             </div>
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
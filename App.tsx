import React, { useState, useEffect } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { AppProvider, useApp } from './context/AppContext';
import Home from './pages/Home';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import { Home as HomeIcon, User as UserIcon } from 'lucide-react';
import OTCActionModal from './components/OTCActionModal';
import { User, TransactionType } from './utils';
import { Services } from './services';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'profile'>('home');
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payInitialUser, setPayInitialUser] = useState<User | null>(null);
  const [payInitialAddress, setPayInitialAddress] = useState<string | null>(null);
  const [payInitialType, setPayInitialType] = useState<TransactionType>(TransactionType.REQUEST);
  const { isAuthenticated, currentUser, friends, login } = useApp();

  // 处理 Twitter OAuth 回调
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userStr = urlParams.get('user');
    const error = urlParams.get('error');

    console.log('🔍 Checking OAuth callback:', { hasToken: !!token, hasUser: !!userStr, hasError: !!error });

    if (error) {
      console.error('OAuth error:', error);
      const errorMessage = decodeURIComponent(error);
      alert(`Twitter 登录失败: ${errorMessage}`);
      // 清理 URL 参数
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (token && userStr) {
      try {
        console.log('📥 Received OAuth callback with token and user');
        // userStr 可能已经被 URL 编码，需要解码
        let decodedUserStr = userStr;
        try {
          decodedUserStr = decodeURIComponent(userStr);
        } catch (e) {
          // 如果解码失败，说明可能没有被编码，直接使用
          console.log('User string not encoded, using as is');
        }
        const user = JSON.parse(decodedUserStr);
        console.log('👤 User from OAuth:', user.handle);
        
        // 存储 token 和用户信息
        localStorage.setItem('auth_token', token);
        localStorage.setItem('current_user', JSON.stringify(user));
        
        console.log('💾 Saved user to localStorage');
        
        // 调用 login 函数更新状态（不传参数，从 localStorage 读取）
        login().then(() => {
          console.log('✅ Login successful after OAuth');
          // 清理 URL 参数
          window.history.replaceState({}, document.title, window.location.pathname);
        }).catch((err) => {
          console.error('❌ Login after OAuth failed:', err);
          alert('登录后初始化失败，请刷新页面');
        });
      } catch (e) {
        console.error('❌ Failed to parse user data from OAuth callback:', e);
        console.error('User string:', userStr);
        alert('解析用户数据失败');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [login]);

  // If not authenticated, force Profile view (which has the login screen)
  if (!isAuthenticated) {
    return <Profile />;
  }

  const handleViewUser = (user: User) => {
      // If clicking own avatar, go to main profile tab
      if (currentUser && user.id === currentUser.id) {
          setActiveTab('profile');
          setViewingUser(null);
      } else {
          setViewingUser(user);
      }
  };

  const handleBackFromUser = () => {
      setViewingUser(null);
  };

  const handleScanAddress = (address: string) => {
    if (!address) return;

    const trimmed = address.trim();
    const isEthAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmed);
    if (!isEthAddress) {
      alert(`扫描结果不是有效的以太坊地址：\n${trimmed}`);
      return;
    }

    // 在好友列表和当前用户中查找匹配的钱包地址（如果有的话就用现有用户信息）
    const allUsers: User[] = [
      ...friends,
      ...(currentUser ? [currentUser] : []),
    ];

    const matchedUser = allUsers.find(
      (u) => u.walletAddress.toLowerCase() === trimmed.toLowerCase()
    );

    setPayInitialType(TransactionType.PAYMENT);

    if (matchedUser) {
      // 扫描到的是联系人，直接预填收款人
      setPayInitialUser(matchedUser);
      setPayInitialAddress(null);
    } else {
      // 扫描到的是外部地址：直接跳转到支付页面，设置支付地址
      setPayInitialUser(null);
      setPayInitialAddress(trimmed);
    }

    setShowPayModal(true);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white shadow-2xl relative overflow-hidden flex flex-col">
      {/* Page Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {viewingUser ? (
            <UserProfile user={viewingUser} onBack={handleBackFromUser} />
        ) : (
            <>
                {activeTab === 'home' && (
                  <Home 
                    onViewUser={handleViewUser} 
                    onScanAddress={handleScanAddress}
                  />
                )}
                {activeTab === 'profile' && <Profile />}
            </>
        )}
      </div>

      {/* Bottom Navigation - Hide if viewing another user to maximize screen space/focus, or keep it. Keeping it allows quick exit. */}
      {!viewingUser && (
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 max-w-md mx-auto">
            <div className="flex justify-between items-center px-8 h-20 pb-2">
              {/* Home Tab */}
              <button 
                onClick={() => setActiveTab('home')}
                className={`flex flex-col items-center justify-center w-16 ${activeTab === 'home' ? 'text-blue-500' : 'text-gray-400'}`}
              >
                <HomeIcon className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-medium">Home</span>
              </button>
              
              {/* Central Pay/Request Button */}
              <button 
                onClick={() => {
                  setPayInitialUser(null);
                  setPayInitialType(TransactionType.REQUEST);
                  setShowPayModal(true);
                }}
                className="flex flex-col items-center justify-center -mt-8 group"
              >
                <div className="w-16 h-16 bg-blue-500 rounded-full shadow-lg shadow-blue-500/40 flex items-center justify-center text-white mb-1 transition-transform group-active:scale-95 border-4 border-white">
                    <span className="text-3xl font-bold">₮</span>
                </div>
                <span className="text-[10px] font-medium text-slate-500">Request / Pay</span>
              </button>

              {/* Profile Tab */}
              <button 
                onClick={() => setActiveTab('profile')}
                className={`flex flex-col items-center justify-center w-16 ${activeTab === 'profile' ? 'text-blue-500' : 'text-gray-400'}`}
              >
                <UserIcon className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-medium">Me</span>
              </button>
            </div>
          </nav>
      )}

      {showPayModal && (
        <OTCActionModal 
          onClose={() => {
            setShowPayModal(false);
            setPayInitialAddress(null);
          }} 
          initialType={payInitialType}
          initialUser={payInitialUser}
          initialAddress={payInitialAddress}
        />
      )}
    </div>
  );
};

// 包装组件：只有在配置了有效的 Privy App ID 时才渲染 PrivyProvider
const PrivyWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const privyAppId = import.meta.env.VITE_PRIVY_APP_ID || '';
  
  // 如果没有配置 Privy App ID，直接渲染子组件，不渲染 PrivyProvider
  if (!privyAppId) {
    console.warn('⚠️ VITE_PRIVY_APP_ID is not set. Privy login will not work.');
    return <>{children}</>;
  }
  
  // 只有在有有效 appId 时才渲染 PrivyProvider
  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        // 登录方式配置
        loginMethods: ['twitter', 'wallet', 'email', 'sms'],
        // 外观配置
        appearance: {
          theme: 'light',
          accentColor: '#3b82f6', // blue-500
          logo: undefined,
        },
        // 嵌入钱包配置
        embeddedWallets: {
          createOnLogin: 'users-without-wallets', // 为没有钱包的用户自动创建
          requireUserPasswordOnCreate: false, // 不需要密码
        },
        // 支持的链配置（BSC）
        supportedChains: [
          {
            id: 56, // BSC Mainnet
            name: 'BNB Smart Chain',
            network: 'bsc',
            nativeCurrency: {
              decimals: 18,
              name: 'BNB',
              symbol: 'BNB',
            },
            rpcUrls: {
              default: {
                http: ['https://bsc-dataseed.binance.org/'],
              },
            },
            blockExplorers: {
              default: {
                name: 'BscScan',
                url: 'https://bscscan.com',
              },
            },
          },
        ],
      }}
    >
      {children}
    </PrivyProvider>
  );
};

const App: React.FC = () => {
  // 从环境变量获取 Privy App ID
  const privyAppId = import.meta.env.VITE_PRIVY_APP_ID || '';
  
  console.log('🔍 Privy App ID:', privyAppId ? '已配置' : '未配置');
  
  return (
    <PrivyWrapper>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </PrivyWrapper>
  );
};

export default App;
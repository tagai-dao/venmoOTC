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
import { useTranslation } from 'react-i18next';

const AppContent: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'home' | 'profile'>('home');
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payInitialUser, setPayInitialUser] = useState<User | null>(null);
  const [payInitialAddress, setPayInitialAddress] = useState<string | null>(null);
  const [payInitialType, setPayInitialType] = useState<TransactionType>(TransactionType.REQUEST);
  const { isAuthenticated, currentUser, friends, login } = useApp();


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
      alert(`${t('error.networkError')}: ${t('error.badRequest')}\n${trimmed}`);
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
    <div className="max-w-md mx-auto min-h-screen bg-white shadow-2xl relative overflow-hidden flex flex-col safe-left safe-right">
      {/* Page Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar mobile-scroll">
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
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 max-w-md mx-auto safe-bottom">
            <div className="flex justify-between items-center px-4 sm:px-8 h-16 sm:h-20 pb-2 safe-left safe-right">
              {/* Home Tab */}
              <button 
                onClick={() => setActiveTab('home')}
                className={`flex flex-col items-center justify-center w-14 sm:w-16 touch-feedback ${activeTab === 'home' ? 'text-blue-500' : 'text-gray-400'}`}
              >
                <HomeIcon className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1" />
                <span className="text-[9px] sm:text-[10px] font-medium">{t('common.home')}</span>
              </button>
              
              {/* Central Pay/Request Button */}
              <button 
                onClick={() => {
                  setPayInitialUser(null);
                  setPayInitialType(TransactionType.REQUEST);
                  setShowPayModal(true);
                }}
                className="flex flex-col items-center justify-center -mt-6 sm:-mt-8 group touch-feedback"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-500 rounded-full shadow-lg shadow-blue-500/40 flex items-center justify-center text-white mb-0.5 sm:mb-1 transition-transform group-active:scale-95 border-3 sm:border-4 border-white">
                    <span className="text-2xl sm:text-3xl font-bold">₮</span>
                </div>
                <span className="text-[9px] sm:text-[10px] font-medium text-slate-500">{t('common.request')} / {t('common.payment')}</span>
              </button>

              {/* Profile Tab */}
              <button 
                onClick={() => setActiveTab('profile')}
                className={`flex flex-col items-center justify-center w-14 sm:w-16 touch-feedback ${activeTab === 'profile' ? 'text-blue-500' : 'text-gray-400'}`}
              >
                <UserIcon className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1" />
                <span className="text-[9px] sm:text-[10px] font-medium">{t('common.profile')}</span>
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
  
  // 如果没有配置 Privy App ID 或为空字符串，直接渲染子组件，不渲染 PrivyProvider
  if (!privyAppId || privyAppId.trim() === '') {
    console.warn('⚠️ VITE_PRIVY_APP_ID is not set or empty. Privy login will not work.');
    console.warn('   请确保在项目根目录创建 .env 文件，并设置 VITE_PRIVY_APP_ID=你的_app_id');
    return <>{children}</>;
  }
  
  console.log('✅ Privy App ID configured:', privyAppId.substring(0, 10) + '...');
  
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
          createOnLogin: 'all-users', // 为所有用户自动创建钱包（包括 Twitter 登录）
          requireUserPasswordOnCreate: false, // 不需要密码
          noPromptOnSignature: false, // 需要用户确认签名
        },
        // Session 配置：确保登录状态持久化
        // Privy 默认使用 HTTP-only cookies 持久化 session，刷新页面后会自动恢复
        // Twitter 登录状态也会自动持久化，无需额外配置
        // 浏览器兼容性配置
        mfa: {
          noPromptOnMfaRequired: false,
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
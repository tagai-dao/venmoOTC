import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Home from './pages/Home';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import { Home as HomeIcon, User as UserIcon } from 'lucide-react';
import OTCActionModal from './components/OTCActionModal';
import { User, TransactionType } from './utils';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'profile'>('home');
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payInitialUser, setPayInitialUser] = useState<User | null>(null);
  const [payInitialAddress, setPayInitialAddress] = useState<string | null>(null);
  const [payInitialType, setPayInitialType] = useState<TransactionType>(TransactionType.REQUEST);
  const { isAuthenticated, currentUser, friends } = useApp();

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

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
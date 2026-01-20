import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import FeedItem from '../components/FeedItem';
import { ScanLine, Search, Bell } from 'lucide-react';
import QRCodeScanner from '../components/QRCodeScanner';
import NotificationList from '../components/NotificationList';
import { User, Privacy } from '../utils';
import { useTranslation } from 'react-i18next';

interface HomeProps {
    onViewUser: (user: User) => void;
    onScanAddress: (address: string) => void;
}

const Home: React.FC<HomeProps> = ({ onViewUser, onScanAddress }) => {
  const { feed, currentUser, unreadCount } = useApp();
  const { t } = useTranslation();
  const [showScanner, setShowScanner] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // 仅在首页展示「主帖」（不展示为 Request 生成的子支付 Activity）
  // 同时过滤 Private 交易：只有交易双方能看到
  const mainFeed = feed.filter(t => {
    // 过滤掉子支付 Activity
    if (t.relatedTransactionId) return false;
    
    // 如果是 Private 交易，只有交易双方能看到
    if (t.privacy === Privacy.PRIVATE) {
      if (!currentUser) return false;
      const isFromUser = t.fromUser.id === currentUser.id;
      const isToUser = t.toUser?.id === currentUser.id;
      return isFromUser || isToUser;
    }
    
    // 其他类型的交易正常显示
    return true;
  });

  return (
    <div className="pb-20">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
         {/* 扫描图标 - 移到左侧 */}
         <button 
            onClick={() => setShowScanner(true)}
            className="text-slate-900 p-2 hover:bg-gray-100 rounded-full transition flex-shrink-0"
            title={t('common.scan')}
        >
             <ScanLine className="w-6 h-6" />
         </button>
         
         {/* 搜索栏 */}
         <div className="relative flex-1 max-w-none">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
             <input 
                type="text" 
                placeholder={t('common.searchPlaceholder')} 
                className="w-full bg-gray-100 text-sm rounded-full py-2 pl-9 pr-4 outline-none focus:ring-2 focus:ring-blue-100 transition"
            />
         </div>
         
         {/* 通知图标 */}
         <button 
            onClick={() => setShowNotifications(true)}
            className="text-slate-900 p-2 hover:bg-gray-100 rounded-full transition flex-shrink-0 relative"
            title={t('common.notifications')}
        >
             <Bell className="w-6 h-6" />
             {unreadCount > 0 && (
               <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                 {unreadCount > 9 ? '9+' : unreadCount}
               </span>
             )}
         </button>
      </header>

      {/* Feed */}
      <main>
        {mainFeed.length === 0 ? (
            <div className="p-8 text-center text-gray-500 mt-10">
                <p>{t('empty.noActivity')}</p>
                <p className="text-sm">{t('empty.getStarted')}</p>
            </div>
        ) : (
            mainFeed.map((transaction) => (
                <FeedItem 
                    key={transaction.id} 
                    transaction={transaction} 
                    onUserClick={onViewUser}
                />
            ))
        )}
      </main>

      {showScanner && (
        <QRCodeScanner 
          onClose={() => setShowScanner(false)} 
          onScan={(data) => {
            console.log('Scanned QR code:', data);
            const address = data.trim();
            if (!address) {
              alert(t('empty.emptyScan'));
              return;
            }
            onScanAddress(address);
            setShowScanner(false);
          }} 
        />
      )}
      {showNotifications && <NotificationList onClose={() => setShowNotifications(false)} />}
    </div>
  );
};

export default Home;
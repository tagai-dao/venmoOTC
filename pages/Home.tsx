import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import FeedItem from '../components/FeedItem';
import { ScanLine, Search } from 'lucide-react';
import QRCodeScanner from '../components/QRCodeScanner';
import { User } from '../utils';

interface HomeProps {
    onViewUser: (user: User) => void;
}

const Home: React.FC<HomeProps> = ({ onViewUser }) => {
  const { feed } = useApp();
  const [showScanner, setShowScanner] = useState(false);

  // 仅在首页展示「主帖」（不展示为 Request 生成的子支付 Activity）
  const mainFeed = feed.filter(t => !t.relatedTransactionId);

  return (
    <div className="pb-20">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
         <div className="relative flex-1 max-w-none">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
             <input 
                type="text" 
                placeholder="People, groups..." 
                className="w-full bg-gray-100 text-sm rounded-full py-2 pl-9 pr-4 outline-none focus:ring-2 focus:ring-blue-100 transition"
            />
         </div>
         <button 
            onClick={() => setShowScanner(true)}
            className="text-slate-900 p-2 hover:bg-gray-100 rounded-full transition flex-shrink-0"
        >
             <ScanLine className="w-6 h-6" />
         </button>
      </header>

      {/* Feed */}
      <main>
        {mainFeed.length === 0 ? (
            <div className="p-8 text-center text-gray-500 mt-10">
                <p>No activity yet.</p>
                <p className="text-sm">Make a payment to get started!</p>
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

      {showScanner && <QRCodeScanner onClose={() => setShowScanner(false)} onScan={(data) => { alert(`Scanned: ${data}`); setShowScanner(false); }} />}
    </div>
  );
};

export default Home;
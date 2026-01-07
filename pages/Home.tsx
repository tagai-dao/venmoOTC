import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import FeedItem from '../components/FeedItem';
import { ScanLine, Search, Bell } from 'lucide-react';
import QRCodeScanner from '../components/QRCodeScanner';
import { User } from '../utils';

interface HomeProps {
    onViewUser: (user: User) => void;
}

const Home: React.FC<HomeProps> = ({ onViewUser }) => {
  const { feed } = useApp();
  const [showScanner, setShowScanner] = useState(false);

  return (
    <div className="pb-20">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between">
         <div className="flex items-center gap-2 flex-1">
             <button 
                onClick={() => setShowScanner(true)}
                className="text-slate-900 p-2 hover:bg-gray-100 rounded-full transition"
            >
                 <ScanLine className="w-6 h-6" />
             </button>
             <div className="relative flex-1 max-w-xs">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input 
                    type="text" 
                    placeholder="People, groups..." 
                    className="w-full bg-gray-100 text-sm rounded-full py-2 pl-9 pr-4 outline-none focus:ring-2 focus:ring-blue-100 transition"
                />
             </div>
         </div>
         <button className="text-slate-900 p-2 hover:bg-gray-100 rounded-full">
             <Bell className="w-5 h-5" />
         </button>
      </header>

      {/* Feed */}
      <main>
        {feed.length === 0 ? (
            <div className="p-8 text-center text-gray-500 mt-10">
                <p>No activity yet.</p>
                <p className="text-sm">Make a payment to get started!</p>
            </div>
        ) : (
            feed.map((transaction) => (
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
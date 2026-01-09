import React, { useState, useEffect } from 'react';
import { Transaction, Bid, User, OTCState } from '../utils';
import { useApp } from '../context/AppContext';
import { Services } from '../services';
import { X, Check, UserCheck } from 'lucide-react';
import { timeAgo } from '../utils';

interface BidListModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSelectTrader: (traderId: string) => Promise<void>;
}

const BidListModal: React.FC<BidListModalProps> = ({ transaction, onClose, onSelectTrader }) => {
  const { currentUser, refreshFeed } = useApp();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    const fetchBids = async () => {
      try {
        const response = await Services.bids.getBids(transaction.id);
        setBids(response.bids || []);
      } catch (error) {
        console.error('Failed to fetch bids:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBids();
  }, [transaction.id]);

  const handleSelectTrader = async (traderId: string) => {
    setSelecting(traderId);
    try {
      await onSelectTrader(traderId);
      await refreshFeed();
      onClose();
    } catch (error: any) {
      console.error('Failed to select trader:', error);
      alert(error?.message || '选择交易者失败，请重试');
    } finally {
      setSelecting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-slate-900" />
            <h2 className="text-lg font-bold text-slate-900">抢单列表</h2>
            <span className="text-sm text-gray-500">({bids.length})</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5 text-slate-900" />
          </button>
        </div>

        {/* Bids List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : bids.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserCheck className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium mb-1">还没有人抢单</p>
              <p className="text-sm text-gray-400">等待交易者抢单...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bids.map((bid) => (
                <div
                  key={bid.id}
                  className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 transition-colors"
                >
                  <img
                    src={bid.user.avatar}
                    className="w-12 h-12 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
                    alt={bid.user.name}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="font-bold text-slate-900">{bid.user.name}</p>
                        <p className="text-xs text-gray-500">{bid.user.handle}</p>
                      </div>
                      <span className="text-xs text-gray-400">{timeAgo(bid.timestamp)}</span>
                    </div>
                    {bid.message && (
                      <p className="text-sm text-gray-700 mb-2">{bid.message}</p>
                    )}
                    {currentUser?.id === transaction.fromUser.id && 
                     transaction.otcState === OTCState.BIDDING && (
                      <button
                        onClick={() => handleSelectTrader(bid.userId)}
                        disabled={selecting === bid.userId}
                        className="w-full mt-2 bg-blue-500 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {selecting === bid.userId ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            选择此交易者
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BidListModal;

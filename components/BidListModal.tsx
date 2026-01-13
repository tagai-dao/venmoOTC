import React, { useState, useEffect } from 'react';
import { Transaction, Bid, User, OTCState, Currency } from '../utils';
import { useApp } from '../context/AppContext';
import { Services } from '../services';
import { X, Check, UserCheck, Loader } from 'lucide-react';
import { timeAgo } from '../utils';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { MultisigContractService } from '../services/multisigContractService';

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
  const [status, setStatus] = useState<string>('');

  const { wallets } = useWallets();

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

  // 判断是否是 Request U（Request USDT）
  const isRequestU = transaction.currency === Currency.USDT;

  // 处理发起者选择交易者（Request 法币场景）
  const handleSelectTrader = async (bid: Bid) => {
    if (!currentUser || !wallets[0]) {
      alert('请先连接钱包');
      return;
    }

    setSelecting(bid.userId);
    try {
      // 1. 获取合约和代币地址 (主网)
      const MULTISIG_ADDR = "0x7989D4b7ABCA813cBA8c87688C3330eb345E3cf6";
      const USDT_ADDR = "0x55d398326f99059fF775485246999027B3197955";

      // 计算需要存入的 USDT 数量
      // 如果是 Offer USDT, Request Fiat: amount 是 Offer 数量
      // 如果是 Offer Fiat, Request USDT: amount 是 Request 数量
      const usdtAmount = transaction.currency === Currency.USDT 
        ? transaction.amount.toString()
        : (transaction as any).otcOfferAmount?.toString();

      if (!usdtAmount) throw new Error("无法确定 USDT 数量");

      setStatus('正在调用合约创建多签订单...');
      
      // 2. 调用合约（发起者存入 USDT）
      const provider = await wallets[0].getEthereumProvider();
      const { orderId, txHash } = await MultisigContractService.createOrder(
        provider,
        MULTISIG_ADDR,
        USDT_ADDR,
        bid.user.walletAddress,
        usdtAmount
      );

      setStatus('订单创建成功，正在同步到服务器...');

      // 3. 同步到后端：先更新交易状态（设置 selectedTraderId）
      await onSelectTrader(bid.userId); // 这一步会将状态改为 SELECTED_TRADER
      
      // 4. 记录链上订单（这会更新状态为 USDT_IN_ESCROW）
      await Services.multisig.recordOrder({
        transactionId: transaction.id,
        traderAddress: bid.user.walletAddress,
        usdtAmount: usdtAmount,
        onchainOrderId: orderId
      });

      setStatus('同步成功！');
      alert(`🎉 成功创建多签订单！\n链上 ID: ${orderId}\n状态已更新为：USDT 已托管`);
      
      // 5. 刷新 feed 以显示最新状态（包括 selectedTraderId 和 USDT_IN_ESCROW 状态）
      await refreshFeed();
      onClose();
    } catch (error: any) {
      console.error('Failed to select trader:', error);
      alert(`操作失败: ${error?.message || '未知错误'}`);
    } finally {
      setSelecting(null);
      setStatus('');
    }
  };

  // 处理交易者确认支付 USDT（Request U 场景）
  const handleTraderPayUSDT = async (bid: Bid) => {
    if (!currentUser || !wallets[0]) {
      alert('请先连接钱包');
      return;
    }

    // 验证是否是交易者本人
    if (currentUser.id !== bid.userId) {
      alert('只能确认自己的支付');
      return;
    }

    setSelecting(bid.userId);
    try {
      // 1. 获取合约和代币地址 (主网)
      const MULTISIG_ADDR = "0x7989D4b7ABCA813cBA8c87688C3330eb345E3cf6";
      const USDT_ADDR = "0x55d398326f99059fF775485246999027B3197955";

      // Request U: currency 是 USDT，amount 就是需要存入的 USDT 数量
      const usdtAmount = transaction.amount.toString();

      setStatus('正在调用合约创建多签订单...');
      
      // 2. 调用合约（交易者存入 USDT，对手是发起者）
      const provider = await wallets[0].getEthereumProvider();
      const { orderId, txHash } = await MultisigContractService.createOrder(
        provider,
        MULTISIG_ADDR,
        USDT_ADDR,
        transaction.fromUser.walletAddress, // 对手是发起者
        usdtAmount
      );

      setStatus('订单创建成功，正在同步到服务器...');

      // 3. 同步到后端：更新交易状态（设置 selectedTraderId）
      await Services.transactions.selectTrader(transaction.id, bid.userId);
      
      // 4. 记录链上订单（这会更新状态为 USDT_IN_ESCROW）
      await Services.multisig.recordOrder({
        transactionId: transaction.id,
        traderAddress: currentUser.walletAddress, // 交易者地址
        usdtAmount: usdtAmount,
        onchainOrderId: orderId
      });

      setStatus('同步成功！');
      alert(`🎉 成功创建多签订单！\n链上 ID: ${orderId}\n状态已更新为：USDT 已托管`);
      
      // 5. 刷新 feed 以显示最新状态
      await refreshFeed();
      onClose();
    } catch (error: any) {
      console.error('Failed to pay USDT:', error);
      alert(`操作失败: ${error?.message || '未知错误'}`);
    } finally {
      setSelecting(null);
      setStatus('');
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
          {status && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-sm flex items-center gap-2">
              <Loader className="w-4 h-4 animate-spin" />
              {status}
            </div>
          )}

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
                    {/* Request 法币：发起者选择交易者 */}
                    {!isRequestU && currentUser?.id === transaction.fromUser.id && 
                     (transaction.otcState === OTCState.BIDDING || transaction.otcState === OTCState.OPEN_REQUEST) && (
                      <button
                        onClick={() => handleSelectTrader(bid)}
                        disabled={selecting !== null}
                        className="w-full mt-2 bg-blue-500 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {selecting === bid.userId ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            选择此交易者并锁定 USDT
                          </>
                        )}
                      </button>
                    )}
                    {/* Request U：交易者确认支付 USDT */}
                    {isRequestU && currentUser?.id === bid.userId && 
                     (transaction.otcState === OTCState.BIDDING || transaction.otcState === OTCState.OPEN_REQUEST) && (
                      <button
                        onClick={() => handleTraderPayUSDT(bid)}
                        disabled={selecting !== null}
                        className="w-full mt-2 bg-green-500 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {selecting === bid.userId ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            确认支付 USDT
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

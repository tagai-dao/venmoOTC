import React, { useState, useEffect, useRef } from 'react';
import { Transaction, TransactionType, OTCState, Currency, formatCurrency, timeAgo, Privacy, User, generateId } from '../utils';
import { useApp } from '../context/AppContext';
import { Services } from '../services';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { MultisigContractService } from '../services/multisigContractService';
import { ethers } from 'ethers';
import { Heart, MessageCircle, Check, DollarSign, Upload, Shield, Globe, Lock, Users, Banknote, Loader, Twitter, Copy, Send, ExternalLink, X, UserCheck, Hand, AlertTriangle, RefreshCcw } from 'lucide-react';
import ReplyDetailModal from './ReplyDetailModal';
import BidListModal from './BidListModal';

interface FeedItemProps {
  transaction: Transaction;
  onUserClick?: (user: User) => void;
}

const MULTISIG_ADDR = "0x7989D4b7ABCA813cBA8c87688C3330eb345E3cf6";

const FeedItem: React.FC<FeedItemProps> = ({ transaction, onUserClick }) => {
  const { currentUser, updateTransaction, refreshFeed, setWalletBalance } = useApp();
  const { wallets } = useWallets();
  
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [hasLiked, setHasLiked] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showReplyDetail, setShowReplyDetail] = useState(false);
  const [showBidList, setShowBidList] = useState(false);
  const [multisigInfo, setMultisigInfo] = useState<any>(null);

  const isMe = currentUser ? transaction.fromUser.id === currentUser.id : false;
  const isToMe = currentUser ? transaction.selectedTraderId === currentUser.id : false;
  
  // 调试日志：检查交易者身份判断
  useEffect(() => {
    if (transaction.isOTC && currentUser) {
      console.log('🔍 FeedItem 交易者身份检查:', {
        transactionId: transaction.id,
        currentUserId: currentUser.id,
        selectedTraderId: transaction.selectedTraderId,
        isMe,
        isToMe,
        otcState: transaction.otcState,
        hasMultisigInfo: !!multisigInfo
      });
    }
  }, [transaction.id, transaction.selectedTraderId, transaction.otcState, currentUser, isMe, isToMe, multisigInfo]);

  // 获取多签合约在后端的记录
  useEffect(() => {
    if (transaction.isOTC && (transaction.multisigContractAddress || transaction.otcState === OTCState.USDT_IN_ESCROW || transaction.otcState === OTCState.AWAITING_FIAT_PAYMENT)) {
      Services.multisig.getMultisigInfo(transaction.id)
        .then(res => setMultisigInfo(res.multisig))
        .catch(err => {
          // 如果多签记录不存在，可能是状态还未完全同步，不报错
          if (err.message?.includes('Not found') || err.message?.includes('404')) {
            console.log('Multisig info not yet available, will retry after refresh');
          } else {
            console.error("Failed to load multisig info", err);
          }
        });
    }
  }, [transaction.id, transaction.multisigContractAddress, transaction.otcState]);

  // 检查用户是否已点赞
  useEffect(() => {
    const checkLiked = async () => {
      if (currentUser) {
        try {
          const liked = await Services.socialInteractions.checkUserLiked(transaction.id);
          setHasLiked(liked);
        } catch (error) {
          console.error('Failed to check like status:', error);
        }
      }
    };
    checkLiked();
  }, [transaction.id, currentUser]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // 处理抢单
  const handleBid = async () => {
    if (!currentUser) {
      alert('请先登录才能抢单');
      return;
    }
    setIsProcessing(true);
    try {
      await Services.bids.createBid(transaction.id);
      await refreshFeed();
      alert('抢单成功！请等待发起者选择交易方。');
    } catch (error: any) {
      console.error('抢单失败:', error);
      alert(error?.message || '抢单失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  // 处理法币转账、上传凭证并对合约签名 (交易者操作)
  const handleTraderPayAndSign = async (choice: number) => {
    if (!currentUser || !wallets[0]) {
      alert('请先连接钱包');
      return;
    }
    
    // 如果 multisigInfo 还没有加载，尝试重新加载
    if (!multisigInfo?.onchainOrderId) {
      try {
        setStatusText('正在加载多签信息...');
        const res = await Services.multisig.getMultisigInfo(transaction.id);
        setMultisigInfo(res.multisig);
        if (!res.multisig?.onchainOrderId) {
          alert('多签订单信息未找到，请刷新页面后重试');
          return;
        }
      } catch (error: any) {
        alert(`加载多签信息失败: ${error?.message || '未知错误'}`);
        return;
      }
    }

    setIsProcessing(true);
    setStatusText('正在处理...');

    try {
      let proofUrl: string | undefined;
      if (file) {
        setStatusText('正在上传凭证...');
        proofUrl = await fileToBase64(file);
      }

      // 1. 调用合约签名
      setStatusText('正在调用合约进行多签签名...');
      const provider = await wallets[0].getEthereumProvider();
      await MultisigContractService.signOrder(
        provider,
        MULTISIG_ADDR,
        multisigInfo.onchainOrderId.toString(),
        choice
      );

      // 2. 发布一条回复动态作为法币支付凭证（如果 Request 是 PUBLIC_X，会自动发布到 X）
      setStatusText('正在发布支付凭证动态...');
      await Services.socialInteractions.addComment(
        transaction.id,
        replyText || (choice === 2 ? "我已完成法币转账，请核对并释放 USDT。" : "我发起资产退回请求。"),
        proofUrl
      );

      // 3. 同步签名状态到后端（这会更新状态为 AWAITING_FIAT_CONFIRMATION）
      setStatusText('正在同步签名状态...');
      await Services.multisig.recordSignature({
        transactionId: transaction.id,
        choice: choice,
        paymentProofUrl: proofUrl
      });

      setStatusText('完成！');
      alert(choice === 2 ? '✅ 已上传凭证并签名成功！等待发起者放行。' : '✅ 已发起退回请求。');
      
      await refreshFeed();
      setShowBankDetails(false);
    } catch (error: any) {
      console.error('Trader action failed:', error);
      alert(`操作失败: ${error?.message || '未知错误'}`);
    } finally {
      setIsProcessing(false);
      setStatusText('');
    }
  };

  // 处理确认收到法币并放行资产 (发起者操作)
  const handleInitiatorSign = async (choice: number) => {
    if (!currentUser || !wallets[0] || !multisigInfo?.onchainOrderId) {
      alert('信息不足，无法签名');
      return;
    }

    setIsProcessing(true);
    setStatusText('正在调用合约签名...');

    try {
      const provider = await wallets[0].getEthereumProvider();
      
      // 1. 合约签名
      await MultisigContractService.signOrder(
        provider,
        MULTISIG_ADDR,
        multisigInfo.onchainOrderId.toString(),
        choice
      );

      // 2. 同步后端
      setStatusText('正在同步到服务器...');
      const res = await Services.multisig.recordSignature({
        transactionId: transaction.id,
        choice: choice
      });

      if (res.isAgreed) {
        alert('🎉 交易达成一致！USDT 已自动释放。');
      } else {
        alert('✅ 已签名。等待交易方签名达成一致。');
      }

      await refreshFeed();
    } catch (error: any) {
      console.error('Initiator action failed:', error);
      alert(`操作失败: ${error?.message || '未知错误'}`);
    } finally {
      setIsProcessing(false);
      setStatusText('');
    }
  };

  // 处理“未收到法币转账”，让对方重新确认或直接退款
  const handleDidNotReceiveFiat = async () => {
    if (!currentUser) {
      alert('请先登录');
      return;
    }

    setIsProcessing(true);
    setStatusText('正在处理...');
    
    try {
      const currentCount = transaction.fiatRejectionCount || 0;
      const newCount = currentCount + 1;
      
      // 如果这是第二次点击"未收到法币"（newCount >= 2），直接发起退回资产流程
      if (newCount >= 2) {
        if (!wallets[0]) {
          alert('请先连接钱包');
          return;
        }
        
        // 如果多签信息还没加载，先加载
        let orderId = multisigInfo?.onchainOrderId;
        if (!orderId) {
          setStatusText('正在加载多签信息...');
          try {
            const res = await Services.multisig.getMultisigInfo(transaction.id);
            setMultisigInfo(res.multisig);
            orderId = res.multisig?.onchainOrderId;
            if (!orderId) {
              alert('多签订单信息未找到，请刷新页面后重试');
              return;
            }
          } catch (error: any) {
            alert(`加载多签信息失败: ${error?.message || '未知错误'}`);
            return;
          }
        }
        
        setStatusText('正在发起资产退回请求...');
        
        // 1. 调用合约签名（choice = 1，退回给发起者）
        const provider = await wallets[0].getEthereumProvider();
        await MultisigContractService.signOrder(
          provider,
          MULTISIG_ADDR,
          orderId.toString(),
          1 // Choice 1: INITIATOR (退回自己)
        );
        
        // 2. 同步签名状态到后端
        setStatusText('正在同步签名状态...');
        await Services.multisig.recordSignature({
          transactionId: transaction.id,
          choice: 1 // Choice 1: INITIATOR (退回自己)
        });
        
        // 3. 更新交易状态和拒绝次数
        await Services.transactions.updateTransaction(transaction.id, {
          otcState: OTCState.AWAITING_FIAT_PAYMENT,
          fiatRejectionCount: newCount
        });
        
        setStatusText('完成！');
        alert('✅ 已发起资产退回请求。等待交易者签名后，USDT 将返回到您的账户。');
      } else {
        // 第一次点击"未收到法币"，只更新状态和计数
        await Services.transactions.updateTransaction(transaction.id, {
          otcState: OTCState.AWAITING_FIAT_PAYMENT,
          fiatRejectionCount: newCount
        });
        alert('已通知对方未收到付款，对方可以重新上传凭证。');
      }
      
      await refreshFeed();
    } catch (error: any) {
      console.error('Failed to handle fiat rejection:', error);
      alert(`操作失败: ${error?.message || '未知错误'}`);
    } finally {
      setIsProcessing(false);
      setStatusText('');
    }
  };

  // 图片处理辅助函数
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const PrivacyIcon = () => {
    if (transaction.privacy === Privacy.PUBLIC_X) return <Twitter className="w-3 h-3 text-sky-500" />;
    if (transaction.privacy === Privacy.PUBLIC) return <Globe className="w-3 h-3 text-gray-400" />;
    if (transaction.privacy === Privacy.FRIENDS) return <Users className="w-3 h-3 text-gray-400" />;
    return <Lock className="w-3 h-3 text-gray-400" />;
  };

  const renderOTCAction = () => {
    if (!transaction.isOTC) return null;

    // 检查是否是退款流程（两次未收到法币）
    const rejectionCount = transaction.fiatRejectionCount || 0;
    const isRefundFlow = rejectionCount >= 2 && multisigInfo?.initiatorChoice === 1;
    const isRefundSuccess = isRefundFlow && multisigInfo?.status === 'EXECUTED';
    const isRefundInProgress = isRefundFlow && !isRefundSuccess && multisigInfo?.initiatorSigned;

    // === 0. 退款成功状态（无论当前 otcState 是什么） ===
    if (isRefundSuccess) {
      return (
        <div className="mt-3 bg-red-600 text-white p-3 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-2 shadow-lg">
          <AlertTriangle className="w-4 h-4" /> 交易失败 & USDT 回退成功
        </div>
      );
    }

    // === 0.5. 退款进行中状态（无论当前 otcState 是什么） ===
    if (isRefundInProgress) {
      if (isToMe) {
        // 交易者：显示"交易失败，待签名 & 回退 USDT 给 Request 发起者"
        return (
          <div className="mt-3 bg-orange-600 text-white p-3 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-2 shadow-lg">
            <AlertTriangle className="w-4 h-4" /> 交易失败，待签名 & 回退 USDT 给 Request 发起者
          </div>
        );
      } else {
        // 其他人（包括发起者）：显示"交易失败 & USDT 回退中"
        return (
          <div className="mt-3 bg-orange-600 text-white p-3 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-2 shadow-lg">
            <Loader className="w-4 h-4 animate-spin" /> 交易失败 & USDT 回退中
          </div>
        );
      }
    }

    // === 1. 等待抢单或正在抢单 ===
    if (transaction.otcState === OTCState.OPEN_REQUEST || transaction.otcState === OTCState.BIDDING) {
      if (isMe) {
        return (
          <button
            onClick={() => setShowBidList(true)}
            className="mt-3 w-full bg-blue-500 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-blue-600 transition flex items-center justify-center gap-2 shadow-lg"
          >
            <UserCheck className="w-4 h-4" />
            查看抢单列表 ({transaction.bids?.length || 0})
          </button>
        );
      } else {
        const hasBid = transaction.bids?.some(bid => bid.userId === currentUser?.id);
        return (
          <button
            disabled={isProcessing || hasBid}
            onClick={handleBid}
            className={`mt-3 w-full py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg
              ${hasBid ? 'bg-gray-100 text-gray-500 cursor-default' : 'bg-green-600 text-white hover:bg-green-700'}`}
          >
            {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : (hasBid ? <Check className="w-4 h-4" /> : <Hand className="w-4 h-4" />)}
            {hasBid ? '已抢单' : '我要抢单'}
          </button>
        );
      }
    }

    // === 2. USDT 已托管 (等待法币支付) ===
    if (transaction.otcState === OTCState.USDT_IN_ESCROW || transaction.otcState === OTCState.AWAITING_FIAT_PAYMENT) {
      if (isToMe) {
        // 检查是否被拒绝过（发起者点击了"未收到法币"）
        const rejectionCount = transaction.fiatRejectionCount || 0;
        const hasRejection = rejectionCount > 0;
        const shouldRefund = rejectionCount >= 2; // 第二次拒绝，直接进入退款流程
        
        // 如果发起者已经发起退回请求（通过多签 choice = 1），显示退款提示
        if (multisigInfo?.initiatorChoice === 1 && multisigInfo?.initiatorSigned) {
          return (
            <div className="mt-3 bg-red-50 p-4 rounded-xl border border-red-200 text-sm text-red-800">
              <div className="flex items-center gap-2 font-bold mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>发起者已申请退回资产（两次未收到法币）。请同意签名以完成退款。</span>
              </div>
              <button 
                onClick={() => handleTraderPayAndSign(1)} // Choice 1: 同意退回
                className="w-full mt-2 bg-red-600 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-700"
              >
                {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                同意退回并签名
              </button>
            </div>
          );
        }
        
        // 如果应该退款但发起者还没签名，显示等待提示
        if (shouldRefund) {
          return (
            <div className="mt-3 bg-yellow-50 text-yellow-800 p-3 rounded-xl border border-yellow-200 text-xs font-bold flex items-center gap-2">
              <Loader className="w-4 h-4 animate-spin text-yellow-600" />
              <span>发起者已两次声称未收到法币，正在发起资产退回流程，请等待...</span>
            </div>
          );
        }
        
        // 交易者视角：显示提示消息和操作按钮
        if (!showBankDetails) {
          return (
            <div className="mt-3 space-y-3">
              {/* 提示消息：根据是否被拒绝显示不同内容 */}
              {hasRejection ? (
                <div className="bg-yellow-50 text-yellow-800 p-3 rounded-xl border border-yellow-200 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span>Request 发起者声称未收到法币，请 check 并再次提交支付记录</span>
                </div>
              ) : (
                <div className="bg-green-50 text-green-800 p-3 rounded-xl border border-green-200 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>USDT 已多签支付，请进行法币支付并签名</span>
                </div>
              )}
              {/* 操作按钮 */}
              <button
                onClick={() => setShowBankDetails(true)}
                className={`w-full py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition flex items-center justify-center gap-2 shadow-lg ${
                  hasRejection 
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <Banknote className="w-4 h-4" />
                {hasRejection ? '重新提交支付记录 & 签名' : '立即支付法币 & 签名'}
              </button>
            </div>
          );
        } else {
          return (
            <div className="mt-3 space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-200 animate-in fade-in">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase">收款人 (Request 发起者) 账户</p>
                <div className="bg-white p-3 rounded-xl border space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">银行:</span>
                    <span className="font-bold">{transaction.fromUser.fiatDetails?.bankName || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">账号:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono">{transaction.fromUser.fiatDetails?.accountNumber || 'N/A'}</span>
                      <button onClick={() => handleCopy(transaction.fromUser.fiatDetails?.accountNumber || '', 'acc')} className="p-1 hover:bg-gray-100 rounded text-gray-400">
                        {copiedField === 'acc' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">户名:</span>
                    <span className="font-bold">{transaction.fromUser.fiatDetails?.accountName || transaction.fromUser.name}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <p className="text-[10px] font-bold text-gray-400 uppercase">上传凭证并签名 (多签)</p>
                <textarea 
                  placeholder="输入转账备注..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full bg-white border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-green-100 h-20"
                />
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 border-2 border-dashed rounded-xl py-3 bg-white cursor-pointer hover:bg-gray-50 border-gray-200">
                    <Upload className="w-3.5 h-3.5" />
                    <span className="truncate">{file ? file.name : "凭证截图"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </label>
                  <button 
                    disabled={isProcessing || !file}
                    onClick={() => handleTraderPayAndSign(2)} // Choice 2: COUNTERPARTY (给对手，即交易者自己)
                    className="flex-[1.5] bg-green-600 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50"
                  >
                    {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    确认已付并签名
                  </button>
                </div>
                <button onClick={() => setShowBankDetails(false)} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600">取消</button>
              </div>
            </div>
          );
        }
      } else if (isMe) {
        return (
          <div className="mt-3 bg-blue-50 text-blue-700 p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-blue-100">
            <Loader className="w-3 h-3 animate-spin" />
            USDT 已托管，等待交易方支付法币并签名...
          </div>
        );
      }
    }

    // === 3. 等待法币确认 (交易者已付) ===
    if (transaction.otcState === OTCState.AWAITING_FIAT_CONFIRMATION) {
      if (isMe) {
        const rejectionCount = transaction.fiatRejectionCount || 0;
        // 如果已经拒绝过一次，第二次点击"未收到法币"会直接发起退款，所以这里只显示一次
        return (
          <div className="mt-3 space-y-3 bg-yellow-50 p-4 rounded-2xl border border-yellow-200">
            <p className="text-xs font-bold text-yellow-800">交易方已标记支付并上传凭证，请核实收款后释放 USDT。</p>
            <div className="flex gap-2">
              <button
                disabled={isProcessing}
                onClick={() => handleInitiatorSign(2)} // Choice 2: COUNTERPARTY (释放给对方)
                className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:bg-green-700"
              >
                {isProcessing && statusText.includes('合约') ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                已收到，释放资产
              </button>
              <button
                disabled={isProcessing}
                onClick={handleDidNotReceiveFiat}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:bg-red-600"
              >
                未收到法币{rejectionCount > 0 ? ` (${rejectionCount}次)` : ''}
              </button>
            </div>
            
            {/* 紧急退款入口 */}
            <div className="pt-2 border-t border-yellow-200 flex justify-center">
              <button 
                onClick={() => handleInitiatorSign(1)} // Choice 1: INITIATOR (退回自己)
                className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-1"
              >
                <AlertTriangle className="w-3 h-3" />
                对方支付有误？申请退回资产 (需对方配合签名)
              </button>
            </div>
          </div>
        );
      } else if (isToMe) {
        // 如果发起者已经发起退回请求（通过多签 choice = 1），优先显示退款提示
        if (multisigInfo?.initiatorChoice === 1 && multisigInfo?.initiatorSigned) {
          return (
            <div className="mt-3 bg-red-50 p-4 rounded-xl border border-red-200 text-sm text-red-800">
              <div className="flex items-center gap-2 font-bold mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>发起者已申请退回资产（两次未收到法币）。请同意签名以完成退款，USDT 将返回到发起者账户。</span>
              </div>
              <button 
                onClick={() => handleTraderPayAndSign(1)} // Choice 1: 同意退回
                className="w-full mt-2 bg-red-600 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-700"
              >
                {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                同意退回并签名
              </button>
            </div>
          );
        }
        
        // 正常情况：凭证已上传，等待发起者确认
        return (
          <div className="mt-3 bg-green-50 p-4 rounded-xl border border-green-100 text-sm text-green-800">
            <div className="flex items-center gap-2 font-bold">
              <Check className="w-4 h-4 bg-green-500 text-white rounded-full p-0.5" />
              凭证已上传，等待发起者确认收货并放行 USDT。
            </div>
          </div>
        );
      }
    }

    // === 4. 完成状态 ===
    if (transaction.otcState === OTCState.COMPLETED) {
      // 正常完成：显示"TRADE SECURED & COMPLETED"
      // 注意：退款流程的状态已经在上面处理了，这里只处理正常完成的情况
      return (
        <div className="mt-3 bg-slate-900 text-white p-3 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-2 shadow-lg">
          <Shield className="w-4 h-4 text-blue-400" /> TRADE SECURED & COMPLETED
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-white p-4 border-b border-gray-100 first:border-t-0 hover:bg-gray-50/50 transition-colors">
      <div className="flex gap-3">
        <div className="flex-shrink-0 cursor-pointer" onClick={() => onUserClick && onUserClick(transaction.fromUser)}>
          <img src={transaction.fromUser.avatar} className="w-10 h-10 rounded-full border border-gray-200 object-cover shadow-sm" alt={transaction.fromUser.name} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <div className="text-sm">
              <span className="font-bold text-slate-900 cursor-pointer hover:underline" onClick={() => onUserClick && onUserClick(transaction.fromUser)}>{transaction.fromUser.name}</span>
              <span className="text-slate-500 px-1">{transaction.type === TransactionType.PAYMENT ? 'paid' : 'requested'}</span>
              <span className="font-bold text-slate-900">
                {transaction.selectedTraderId ? (isToMe ? 'You' : 'Trader') : (transaction.toUser ? transaction.toUser.name : 'Everyone')}
              </span>
            </div>
            <div className="text-xs text-gray-400 whitespace-nowrap ml-2">{timeAgo(transaction.timestamp)}</div>
          </div>

          <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 mb-1.5">
            <PrivacyIcon />
            {transaction.isOTC && (
              <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">OTC Trade</span>
            )}
          </div>

          <div
            onClick={() => setShowReplyDetail(true)}
            className="cursor-pointer hover:bg-gray-50/50 -mx-2 px-2 py-1 rounded-lg transition-colors"
          >
            <p className="text-sm text-slate-800 mb-2.5 break-words leading-relaxed whitespace-pre-line">
              {transaction.note} {transaction.sticker && <span className="inline-block ml-1 scale-125">{transaction.sticker}</span>}
            </p>
          </div>

          <div className={`inline-flex flex-col items-start px-3 py-1.5 rounded-xl text-sm font-bold mb-3
            ${transaction.type === TransactionType.PAYMENT ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
            <div className="flex items-center">
              {transaction.type === TransactionType.PAYMENT ? '+' : ''} {formatCurrency(transaction.amount, transaction.currency)}
            </div>
            {transaction.isOTC && transaction.otcOfferAmount && transaction.otcFiatCurrency && (
              <div className="text-xs opacity-80 mt-1 pt-1 border-t border-blue-200/50 w-full flex items-center gap-2">
                <span className="font-normal text-[10px] text-slate-400 uppercase">For</span>
                <span>{formatCurrency(transaction.otcOfferAmount, transaction.otcFiatCurrency)}</span>
              </div>
            )}
          </div>

          {statusText && (
            <div className="mt-2 p-2 bg-blue-50 text-blue-600 text-[10px] font-bold rounded flex items-center gap-2">
              <Loader className="w-3 h-3 animate-spin" />
              {statusText}
            </div>
          )}

          {renderOTCAction()}

          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-50">
            <button 
              onClick={async (e) => { e.stopPropagation(); await handleLike(); }}
              className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${hasLiked ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}
            >
              <Heart className={`w-4 h-4 ${hasLiked ? 'fill-red-500 text-red-500' : ''}`} />
              {transaction.likes > 0 ? transaction.likes : 'Like'}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowCommentInput(!showCommentInput); }}
              className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${showCommentInput ? 'text-blue-500' : 'text-slate-400 hover:text-blue-500'}`}
            >
              <MessageCircle className="w-4 h-4" />
              {transaction.comments > 0 ? transaction.comments : 'Comment'}
            </button>
          </div>

          {/* 评论输入框 */}
          {showCommentInput && currentUser && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex gap-2">
                <img src={currentUser.avatar} className="w-6 h-6 rounded-full flex-shrink-0" alt={currentUser.name} />
                <div className="flex-1">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="添加评论..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 resize-none min-h-[60px]"
                    rows={2}
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => setShowCommentInput(false)} className="px-3 py-1.5 text-xs font-medium text-gray-600">取消</button>
                    <button onClick={async () => { await handleAddComment(); }} disabled={!commentText.trim() || isProcessing} className="px-4 py-1.5 text-xs font-bold bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">发布</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showReplyDetail && (
        <ReplyDetailModal
          transaction={transaction}
          onClose={() => setShowReplyDetail(false)}
          onUserClick={onUserClick}
        />
      )}

      {showBidList && (
        <BidListModal
          transaction={transaction}
          onClose={() => setShowBidList(false)}
          onSelectTrader={async (traderId) => {
            // 更新交易状态：设置 selectedTraderId 和 otcState
            try {
              await Services.transactions.selectTrader(transaction.id, traderId);
              // 刷新 feed 以显示最新状态
              await refreshFeed();
            } catch (error: any) {
              console.error('Failed to select trader:', error);
              throw error; // 重新抛出错误，让 BidListModal 处理
            }
          }}
        />
      )}
    </div>
  );
};

export default FeedItem;

import React, { useState, useEffect, useRef } from 'react';
import { Transaction, TransactionType, OTCState, Currency, formatCurrency, timeAgo, Privacy, User, generateId } from '../utils';
import { useApp } from '../context/AppContext';
import { Services } from '../services';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useTranslation } from 'react-i18next';
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

// 国家代码到国家名称的映射
const getCountryName = (code: string | undefined): string => {
  if (!code) return '';
  
  const countryMap: Record<string, string> = {
    'CN': '中国',
    'US': '美国',
    'GB': '英国',
    'NG': '尼日利亚',
    'VE': '委内瑞拉',
    'IN': '印度',
    'BR': '巴西',
    'JP': '日本',
    'KR': '韩国',
    'SG': '新加坡',
    'HK': '香港',
    'TW': '台湾',
    'AU': '澳大利亚',
    'CA': '加拿大',
    'DE': '德国',
    'FR': '法国',
    'IT': '意大利',
    'ES': '西班牙',
    'NL': '荷兰',
    'BE': '比利时',
    'CH': '瑞士',
    'AT': '奥地利',
    'SE': '瑞典',
    'NO': '挪威',
    'DK': '丹麦',
    'FI': '芬兰',
    'PL': '波兰',
    'RU': '俄罗斯',
    'ZA': '南非',
    'EG': '埃及',
    'KE': '肯尼亚',
    'MX': '墨西哥',
    'AR': '阿根廷',
    'CL': '智利',
    'CO': '哥伦比亚',
    'PE': '秘鲁',
    'PH': '菲律宾',
    'TH': '泰国',
    'VN': '越南',
    'ID': '印度尼西亚',
    'MY': '马来西亚',
    'AE': '阿联酋',
    'SA': '沙特阿拉伯',
    'IL': '以色列',
    'TR': '土耳其',
    'OTHER': '其他',
  };
  
  return countryMap[code] || code;
};

const FeedItem: React.FC<FeedItemProps> = ({ transaction, onUserClick }) => {
  const { currentUser, updateTransaction, refreshFeed, setWalletBalance } = useApp();
  const { wallets } = useWallets();
  const { t } = useTranslation();
  
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
  const [traderUser, setTraderUser] = useState<User | null>(null);

  const isMe = currentUser ? transaction.fromUser.id === currentUser.id : false;
  const isToMe = currentUser ? transaction.selectedTraderId === currentUser.id : false;
  
  // 获取交易者信息（Request U 场景需要）
  useEffect(() => {
    const fetchTraderUser = async () => {
      if (transaction.isOTC && transaction.selectedTraderId && !transaction.toUser) {
        try {
          const trader = await Services.users.getUser(transaction.selectedTraderId);
          setTraderUser(trader);
        } catch (error) {
          console.error('Failed to fetch trader user:', error);
        }
      } else if (transaction.toUser) {
        setTraderUser(null); // 如果 toUser 已存在，不需要额外获取
      }
    };
    fetchTraderUser();
  }, [transaction.id, transaction.selectedTraderId, transaction.toUser]);
  
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
      alert(t('bid.pleaseLoginToBid'));
      return;
    }
    setIsProcessing(true);
    try {
      const response = await Services.bids.createBid(transaction.id);
      console.log('✅ 抢单成功:', response);
      
      // 刷新 feed 以获取最新的交易数据（包括 bids 和更新后的 otcState）
      await refreshFeed();
      
      alert(t('bid.bidSuccess'));
    } catch (error: any) {
      console.error('抢单失败:', error);
      alert(error?.message || t('bid.bidFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  // 处理法币转账、上传凭证并对合约签名 (交易者操作)
  const handleTraderPayAndSign = async (choice: number) => {
    if (!currentUser || !wallets[0]) {
      alert(t('auth.pleaseConnectWallet'));
      return;
    }
    
    // 如果 multisigInfo 还没有加载，尝试重新加载
    if (!multisigInfo?.onchainOrderId) {
      try {
        setStatusText(t('common.loading'));
        const res = await Services.multisig.getMultisigInfo(transaction.id);
        setMultisigInfo(res.multisig);
        if (!res.multisig?.onchainOrderId) {
          alert(t('transaction.multisigInfoNotFound'));
          return;
        }
      } catch (error: any) {
        alert(`${t('transaction.loadMultisigFailed')}: ${error?.message || t('transaction.unknownError')}`);
        return;
      }
    }

    setIsProcessing(true);
    setStatusText(t('common.processing'));

    try {
      let proofUrl: string | undefined;
      if (file) {
        setStatusText(t('common.processing'));
        proofUrl = await fileToBase64(file);
      }

      // 1. 调用合约签名
      setStatusText(t('common.processing'));
      const provider = await wallets[0].getEthereumProvider();
      await MultisigContractService.signOrder(
        provider,
        MULTISIG_ADDR,
        multisigInfo.onchainOrderId.toString(),
        choice
      );

      // 2. 发布一条回复动态作为法币支付凭证（如果 Request 是 PUBLIC_X，会自动发布到 X）
      setStatusText(t('common.processing'));
      await Services.socialInteractions.addComment(
        transaction.id,
        replyText || (choice === 2 ? t('otc.proofUploadedWaitingConfirm') : t('otc.refundRequestedWaitingSignature')),
        proofUrl
      );

      // 3. 同步签名状态到后端（这会更新状态为 AWAITING_FIAT_CONFIRMATION）
      setStatusText(t('common.processing'));
      await Services.multisig.recordSignature({
        transactionId: transaction.id,
        choice: choice,
        paymentProofUrl: proofUrl
      });

      setStatusText(t('common.success'));
      alert(choice === 2 ? `✅ ${t('transaction.signatureSuccessful')}` : `✅ ${t('otc.refundRequestedWaitingSignature')}`);
      
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
      alert(t('transaction.insufficientInfo'));
      return;
    }

    setIsProcessing(true);
    setStatusText(t('common.processing'));

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
      setStatusText(t('common.processing'));
      const res = await Services.multisig.recordSignature({
        transactionId: transaction.id,
        choice: choice
      });

      if (res.isAgreed) {
        alert(`🎉 ${t('transaction.bothSigned')}`);
      } else {
        alert(`✅ ${t('transaction.signatureSuccessful')}`);
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
      alert(t('auth.pleaseLogin'));
      return;
    }

    setIsProcessing(true);
    setStatusText(t('common.processing'));
    
    try {
      // 判断是否是 Request U
      const isRequestU = transaction.currency === Currency.USDT;
      
      const currentCount = transaction.fiatRejectionCount || 0;
      const newCount = currentCount + 1;
      
      // 如果这是第二次点击"未收到法币"（newCount >= 2），直接发起退回资产流程
      if (newCount >= 2) {
        if (!wallets[0]) {
          alert(t('auth.pleaseConnectWallet'));
          return;
        }
        
        // 如果多签信息还没加载，先加载
        let orderId = multisigInfo?.onchainOrderId;
        if (!orderId) {
          setStatusText(t('common.loading'));
          try {
            const res = await Services.multisig.getMultisigInfo(transaction.id);
            setMultisigInfo(res.multisig);
            orderId = res.multisig?.onchainOrderId;
            if (!orderId) {
              alert(t('transaction.multisigInfoNotFound'));
              return;
            }
          } catch (error: any) {
            alert(`${t('transaction.loadMultisigFailed')}: ${error?.message || t('transaction.unknownError')}`);
            return;
          }
        }
        
        setStatusText(t('common.processing'));
        
        // 确定退回方向
        // Request 法币：发起者存入 USDT，退回给发起者（choice = 1）
        // Request U：交易者存入 USDT，退回给交易者（choice = 1，但需要交易者签名）
        const refundChoice = 1; // Choice 1: 退回给存入 USDT 的一方
        
        // 1. 调用合约签名
        const provider = await wallets[0].getEthereumProvider();
        await MultisigContractService.signOrder(
          provider,
          MULTISIG_ADDR,
          orderId.toString(),
          refundChoice
        );
        
        // 2. 同步签名状态到后端
        setStatusText(t('common.processing'));
        await Services.multisig.recordSignature({
          transactionId: transaction.id,
          choice: refundChoice
        });
        
        // 3. 更新交易状态和拒绝次数
        await Services.transactions.updateTransaction(transaction.id, {
          otcState: OTCState.AWAITING_FIAT_PAYMENT,
          fiatRejectionCount: newCount
        });
        
        setStatusText(t('common.success'));
        if (isRequestU) {
          // Request U: 交易者点击"未收到法币"，发起退回给交易者
          alert(`✅ ${t('otc.refundRequestedWaitingSignatureInitiator')}`);
        } else {
          // Request 法币: 发起者点击"未收到法币"，发起退回给发起者
          alert(`✅ ${t('otc.refundRequestedWaitingSignature')}`);
        }
      } else {
        // 第一次点击"未收到法币"，只更新状态和计数
        await Services.transactions.updateTransaction(transaction.id, {
          otcState: OTCState.AWAITING_FIAT_PAYMENT,
          fiatRejectionCount: newCount
        });
        alert(t('transaction.paymentNotReceived'));
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

    // 判断是否是 Request U（Request USDT）
    const isRequestU = transaction.currency === Currency.USDT;

    // 检查是否是退款流程（两次未收到法币）
    const rejectionCount = transaction.fiatRejectionCount || 0;
    // 退款流程：任何一方选择 choice = 1（退回）且已签名
    const hasRefundChoice = (multisigInfo?.initiatorChoice === 1 || multisigInfo?.counterpartyChoice === 1);
    const isRefundFlow = rejectionCount >= 2 && hasRefundChoice;
    const isRefundSuccess = isRefundFlow && multisigInfo?.status === 'EXECUTED';
    const isRefundInProgress = isRefundFlow && !isRefundSuccess && 
                               ((multisigInfo?.initiatorChoice === 1 && multisigInfo?.initiatorSigned) ||
                                (multisigInfo?.counterpartyChoice === 1 && multisigInfo?.counterpartySigned));

    // === 0. 退款成功状态（无论当前 otcState 是什么） ===
    if (isRefundSuccess) {
      return (
        <div className="mt-3 bg-red-600 text-white p-3 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-2 shadow-lg">
          <AlertTriangle className="w-4 h-4" /> {t('otc.transactionFailedRefunding')}
        </div>
      );
    }

    // === 0.5. 退款进行中状态（无论当前 otcState 是什么） ===
    if (isRefundInProgress) {
      // 判断是谁发起的退回请求
      const isInitiatorRefund = multisigInfo?.initiatorChoice === 1 && multisigInfo?.initiatorSigned;
      const isCounterpartyRefund = multisigInfo?.counterpartyChoice === 1 && multisigInfo?.counterpartySigned;
      
      // Request 法币：如果发起者发起退回，交易者需要签名
      // Request U：如果交易者发起退回，发起者需要签名
      const needsMySignature = (isRequestU && isCounterpartyRefund && isMe) || 
                              (!isRequestU && isInitiatorRefund && isToMe);
      
      if (needsMySignature) {
        // 需要我签名：显示"签名并回退 USDT"按钮
        return (
          <button
            disabled={isProcessing || !wallets[0]}
            onClick={async () => {
              if (!wallets[0]) {
                alert(t('auth.pleaseConnectWallet'));
                return;
              }
              // Request U：如果交易者发起退回（counterpartyRefund），发起者签名（choice = 1）
              // Request 法币：如果发起者发起退回（initiatorRefund），交易者签名（choice = 1）
              if (isRequestU && isCounterpartyRefund) {
                // Request U，交易者发起退回，发起者签名
                await handleInitiatorSign(1);
              } else if (!isRequestU && isInitiatorRefund) {
                // Request 法币，发起者发起退回，交易者签名
                await handleTraderPayAndSign(1);
              }
            }}
            className="mt-3 w-full bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {t('otc.signAndRefundUSDT')}
          </button>
        );
      } else {
        // 其他人：显示"交易失败 & USDT 回退中"
        return (
          <div className="mt-3 bg-orange-600 text-white p-3 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-2 shadow-lg">
            <Loader className="w-4 h-4 animate-spin" /> {t('otc.transactionFailedRefunding')}
          </div>
        );
      }
    }

    // === 1. 等待抢单或正在抢单 ===
    if (transaction.otcState === OTCState.OPEN_REQUEST || transaction.otcState === OTCState.BIDDING) {
      // Request U：没有抢单环节，交易者直接支付 USDT
      if (isRequestU) {
        if (isMe) {
          // 发起者：显示等待交易者支付 USDT
          return (
            <div className="mt-3 bg-blue-50 text-blue-700 p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-blue-100">
              <Loader className="w-3 h-3 animate-spin" />
              {t('otc.waitingForTraderPayUSDT')}
            </div>
          );
        } else {
          // 交易者：直接显示"确认支付 USDT"按钮
          if (!wallets[0]) {
            return (
              <div className="mt-3 bg-yellow-50 text-yellow-800 p-3 rounded-xl border border-yellow-200 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span>{t('otc.pleaseConnectWalletToPay')}</span>
              </div>
            );
          }
          
          return (
            <button
              disabled={isProcessing}
              onClick={async () => {
                if (!currentUser || !wallets[0]) {
                  alert(t('auth.pleaseConnectWallet'));
                  return;
                }
                
                setIsProcessing(true);
                setStatusText(t('common.processing'));
                
                try {
                  // 1. 获取合约和代币地址 (主网)
                  const MULTISIG_ADDR = "0x7989D4b7ABCA813cBA8c87688C3330eb345E3cf6";
                  const USDT_ADDR = "0x55d398326f99059fF775485246999027B3197955";
                  
                  // Request U: currency 是 USDT，amount 就是需要存入的 USDT 数量
                  const usdtAmount = transaction.amount.toString();
                  
                  // 2. 调用合约（交易者存入 USDT，对手是发起者）
                  const provider = await wallets[0].getEthereumProvider();
                  const { orderId, txHash } = await MultisigContractService.createOrder(
                    provider,
                    MULTISIG_ADDR,
                    USDT_ADDR,
                    transaction.fromUser.walletAddress, // 对手是发起者
                    usdtAmount
                  );
                  
                  setStatusText(t('common.processing'));
                  
                  // 3. 同步到后端：更新交易状态（设置 selectedTraderId）
                  await Services.transactions.selectTrader(transaction.id, currentUser.id);
                  
                  // 4. 记录链上订单（这会更新状态为 USDT_IN_ESCROW）
                  await Services.multisig.recordOrder({
                    transactionId: transaction.id,
                    traderAddress: currentUser.walletAddress, // 交易者地址
                    usdtAmount: usdtAmount,
                    onchainOrderId: orderId
                  });
                  
                  setStatusText(t('common.success'));
                  alert(`🎉 ${t('transaction.transactionSuccess')}\n${t('transaction.multisigInfoNotFound')}: ${orderId}`);
                  
                  // 5. 刷新 feed 以显示最新状态
                  await refreshFeed();
                } catch (error: any) {
                  console.error('Failed to pay USDT:', error);
                  alert(`${t('transaction.operationFailed')}: ${error?.message || t('transaction.unknownError')}`);
                } finally {
                  setIsProcessing(false);
                  setStatusText('');
                }
              }}
              className="mt-3 w-full bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              {t('otc.confirmPayUSDT')}
            </button>
          );
        }
      } else {
        // Request 法币：需要抢单流程
        if (isMe) {
          return (
            <button
              onClick={() => setShowBidList(true)}
              className="mt-3 w-full bg-blue-500 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-blue-600 transition flex items-center justify-center gap-2 shadow-lg"
            >
              <UserCheck className="w-4 h-4" />
              {t('bid.viewBids')} ({transaction.bids?.length || 0})
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
              {hasBid ? t('bid.bidPlaced') : t('bid.placeBid')}
            </button>
          );
        }
      }
    }

    // === 2. USDT 已托管 (等待法币支付) ===
    if (transaction.otcState === OTCState.USDT_IN_ESCROW || transaction.otcState === OTCState.AWAITING_FIAT_PAYMENT) {
      // Request 法币：交易者支付法币并签名
      // Request U：发起者支付法币并签名
      if ((!isRequestU && isToMe) || (isRequestU && isMe)) {
        // 检查是否被拒绝过（发起者点击了"未收到法币"）
        const rejectionCount = transaction.fiatRejectionCount || 0;
        const hasRejection = rejectionCount > 0;
        const shouldRefund = rejectionCount >= 2; // 第二次拒绝，直接进入退款流程
        
        // 检查是否有一方已经发起退回请求（通过多签 choice = 1）
        // Request 法币：发起者发起退回（initiatorChoice = 1）
        // Request U：交易者发起退回（counterpartyChoice = 1，但需要检查是谁签名的）
        const hasRefundRequest = (multisigInfo?.initiatorChoice === 1 && multisigInfo?.initiatorSigned) ||
                                 (multisigInfo?.counterpartyChoice === 1 && multisigInfo?.counterpartySigned);
        
        if (hasRefundRequest) {
          // 判断是谁发起的退回请求
          const isInitiatorRefund = multisigInfo?.initiatorChoice === 1 && multisigInfo?.initiatorSigned;
          const isCounterpartyRefund = multisigInfo?.counterpartyChoice === 1 && multisigInfo?.counterpartySigned;
          
          return (
            <div className="mt-3 bg-red-50 p-4 rounded-xl border border-red-200 text-sm text-red-800">
              <div className="flex items-center gap-2 font-bold mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>
                  {isRequestU 
                    ? (isCounterpartyRefund ? t('otc.traderRequestedRefundInitiator') : t('otc.initiatorRequestedRefundTrader'))
                    : (isInitiatorRefund ? t('otc.initiatorRequestedRefund') : t('otc.traderRequestedRefund'))}
                </span>
              </div>
              <button 
                onClick={() => {
                  // Request U: 如果是交易者发起的退回，发起者同意（choice = 1）
                  // Request 法币: 如果是发起者发起的退回，交易者同意（choice = 1）
                  handleTraderPayAndSign(1);
                }}
                className="w-full mt-2 bg-red-600 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-700"
              >
                {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                同意退回并签名
              </button>
            </div>
          );
        }
        
        // 如果应该退款但还没签名，显示等待提示
        if (shouldRefund) {
          return (
            <div className="mt-3 bg-yellow-50 text-yellow-800 p-3 rounded-xl border border-yellow-200 text-xs font-bold flex items-center gap-2">
              <Loader className="w-4 h-4 animate-spin text-yellow-600" />
              <span>
                {isRequestU 
                  ? t('otc.twiceClaimedNotReceivedInitiator')
                  : t('otc.twiceClaimedNotReceived')}
              </span>
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
                  <span>{t('otc.checkAndResubmit')}</span>
                </div>
              ) : (
                <div className="bg-green-50 text-green-800 p-3 rounded-xl border border-green-200 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>{t('otc.usdtDepositedPayFiat')}</span>
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
                {hasRejection ? t('otc.reSubmitPaymentRecord') : t('otc.payFiatAndSign')}
              </button>
            </div>
          );
        } else {
          return (
            <div className="mt-3 space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-200 animate-in fade-in">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase">
                  {isRequestU ? t('otc.traderAccount') : t('otc.initiatorAccount')}
                </p>
                <div className="bg-white p-3 rounded-xl border space-y-2 text-sm">
                  {(() => {
                    // Request U: 发起者支付法币，需要显示交易者的账户信息
                    // Request 法币: 交易者支付法币，需要显示发起者的账户信息
                    let targetUser: User;
                    if (isRequestU) {
                      // Request U: 显示交易者的账户信息
                      // 优先使用 transaction.toUser，如果没有则使用 traderUser，最后降级为 fromUser
                      targetUser = transaction.toUser || traderUser || transaction.fromUser;
                    } else {
                      // Request 法币: 显示发起者的账户信息
                      targetUser = transaction.fromUser;
                    }
                    
                    // 如果 Request U 且还没有交易者信息，显示加载状态
                    if (isRequestU && !transaction.toUser && !traderUser && transaction.selectedTraderId) {
                      return (
                        <div className="text-center py-4">
                          <Loader className="w-4 h-4 animate-spin mx-auto text-gray-400" />
                          <p className="text-xs text-gray-500 mt-2">{t('otc.loadingTraderInfo')}</p>
                        </div>
                      );
                    }
                    
                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-500">{t('otc.bank')}:</span>
                          <span className="font-bold">{targetUser.fiatDetails?.bankName || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">{t('otc.account')}:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono">{targetUser.fiatDetails?.accountNumber || 'N/A'}</span>
                            <button onClick={() => handleCopy(targetUser.fiatDetails?.accountNumber || '', 'acc')} className="p-1 hover:bg-gray-100 rounded text-gray-400">
                              {copiedField === 'acc' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">{t('otc.accountName')}:</span>
                          <span className="font-bold">{targetUser.fiatDetails?.accountName || targetUser.name}</span>
                        </div>
                        {targetUser.fiatDetails?.country && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">{t('otc.country')}:</span>
                            <span className="font-bold">{getCountryName(targetUser.fiatDetails.country)}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <p className="text-[10px] font-bold text-gray-400 uppercase">{t('otc.uploadProofAndSign')}</p>
                <textarea 
                  placeholder={t('otc.enterTransferNote')}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full bg-white border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-green-100 h-20"
                />
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 border-2 border-dashed rounded-xl py-3 bg-white cursor-pointer hover:bg-gray-50 border-gray-200">
                    <Upload className="w-3.5 h-3.5" />
                    <span className="truncate">{file ? file.name : t('otc.proofScreenshot')}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </label>
                  <button 
                    disabled={isProcessing || !file}
                    onClick={() => {
                      // Request U: 发起者支付法币，choice = 2 (给交易者)
                      // Request 法币: 交易者支付法币，choice = 2 (给交易者自己，即释放 USDT 给交易者)
                      handleTraderPayAndSign(2);
                    }}
                    className="flex-[1.5] bg-green-600 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50"
                  >
                    {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {t('otc.confirmPaidAndSign')}
                  </button>
                </div>
                <button onClick={() => setShowBankDetails(false)} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600">{t('common.cancel')}</button>
              </div>
            </div>
          );
        }
      } else if ((!isRequestU && isMe) || (isRequestU && isToMe)) {
        // Request 法币: 发起者等待交易者支付法币
        // Request U: 交易者等待发起者支付法币
        return (
          <div className="mt-3 bg-blue-50 text-blue-700 p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-blue-100">
            <Loader className="w-3 h-3 animate-spin" />
            {isRequestU ? t('otc.waitingForInitiatorPayFiat') : t('otc.waitingForFiatPayment')}
          </div>
        );
      }
    }

    // === 3. 等待法币确认 (一方已支付法币) ===
    if (transaction.otcState === OTCState.AWAITING_FIAT_CONFIRMATION) {
      // Request 法币: 发起者确认收到法币并签名
      // Request U: 交易者确认收到法币并签名
      if ((!isRequestU && isMe) || (isRequestU && isToMe)) {
        const rejectionCount = transaction.fiatRejectionCount || 0;
        // 如果已经拒绝过一次，第二次点击"未收到法币"会直接发起退款，所以这里只显示一次
        return (
          <div className="mt-3 space-y-3 bg-yellow-50 p-4 rounded-2xl border border-yellow-200">
            <p className="text-xs font-bold text-yellow-800">
              {isRequestU ? t('otc.markedPaidPleaseVerifyInitiator') : t('otc.markedPaidPleaseVerify')}
            </p>
            <div className="flex gap-2">
              <button
                disabled={isProcessing}
                onClick={() => {
                  // Request U: 交易者确认收到法币，choice = 2 (释放 USDT 给发起者)
                  // Request 法币: 发起者确认收到法币，choice = 2 (释放 USDT 给交易者)
                  if (isRequestU) {
                    handleTraderPayAndSign(2);
                  } else {
                    handleInitiatorSign(2);
                  }
                }}
                className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:bg-green-700"
              >
                {isProcessing && statusText.includes('合约') ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {t('otc.receivedReleaseAssets')}
              </button>
              <button
                disabled={isProcessing}
                onClick={handleDidNotReceiveFiat}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:bg-red-600"
              >
                {t('otc.didNotReceiveFiat')}{rejectionCount > 0 ? ` (${rejectionCount}${t('otc.times')})` : ''}
              </button>
            </div>
            
            {/* 紧急退款入口 */}
            <div className="pt-2 border-t border-yellow-200 flex justify-center">
              <button 
                onClick={() => {
                  // Request U: 如果交易者点击，退回给交易者（choice = 1）
                  // Request 法币: 如果发起者点击，退回给发起者（choice = 1）
                  if (isRequestU && isToMe) {
                    handleTraderPayAndSign(1);
                  } else if (!isRequestU && isMe) {
                    handleInitiatorSign(1);
                  }
                }}
                className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-1"
              >
                <AlertTriangle className="w-3 h-3" />
                {t('otc.paymentErrorApplyRefund')}
              </button>
            </div>
          </div>
        );
      } else if ((!isRequestU && isToMe) || (isRequestU && isMe)) {
        // Request 法币: 交易者等待发起者确认
        // Request U: 发起者等待交易者确认
        // 如果一方已经发起退回请求（通过多签 choice = 1），优先显示退款提示
        const hasRefundRequest = (multisigInfo?.initiatorChoice === 1 && multisigInfo?.initiatorSigned) ||
                                 (multisigInfo?.counterpartyChoice === 1 && multisigInfo?.counterpartySigned);
        
        if (hasRefundRequest) {
          // 判断是谁发起的退回请求
          const isInitiatorRefund = multisigInfo?.initiatorChoice === 1 && multisigInfo?.initiatorSigned;
          const isCounterpartyRefund = multisigInfo?.counterpartyChoice === 1 && multisigInfo?.counterpartySigned;
          
          return (
            <div className="mt-3 bg-red-50 p-4 rounded-xl border border-red-200 text-sm text-red-800">
              <div className="flex items-center gap-2 font-bold mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>
                  {isRequestU 
                    ? (isCounterpartyRefund ? t('otc.traderRequestedRefundInitiator') : t('otc.initiatorRequestedRefundTrader'))
                    : (isInitiatorRefund ? t('otc.initiatorRequestedRefund') : t('otc.traderRequestedRefund'))}
                </span>
              </div>
              <button 
                onClick={() => {
                  // Request U: 如果是交易者发起的退回，发起者同意（choice = 1）
                  // Request 法币: 如果是发起者发起的退回，交易者同意（choice = 1）
                  if (isRequestU && isCounterpartyRefund) {
                    handleInitiatorSign(1);
                  } else if (!isRequestU && isInitiatorRefund) {
                    handleTraderPayAndSign(1);
                  }
                }}
                className="w-full mt-2 bg-red-600 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-700"
              >
                {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                同意退回并签名
              </button>
            </div>
          );
        }
        
        // 正常情况：凭证已上传，等待对方确认
        return (
          <div className="mt-3 bg-green-50 p-4 rounded-xl border border-green-100 text-sm text-green-800">
            <div className="flex items-center gap-2 font-bold">
              <Check className="w-4 h-4 bg-green-500 text-white rounded-full p-0.5" />
              {isRequestU 
                ? t('otc.proofUploadedWaitingInitiator')
                : t('otc.proofUploadedWaitingConfirm')}
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
          <Shield className="w-4 h-4 text-blue-400" /> {t('otc.tradeSecuredCompleted')}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-white p-3 sm:p-4 border-b border-gray-100 first:border-t-0 hover:bg-gray-50/50 active:bg-gray-50 transition-colors">
      <div className="flex gap-2.5 sm:gap-3">
        <div className="flex-shrink-0 cursor-pointer touch-feedback" onClick={() => onUserClick && onUserClick(transaction.fromUser)}>
          <img src={transaction.fromUser.avatar} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-gray-200 object-cover shadow-sm" alt={transaction.fromUser.name} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <div className="text-xs sm:text-sm flex flex-wrap items-baseline gap-0.5 sm:gap-1">
              <span className="font-bold text-slate-900 cursor-pointer hover:underline touch-feedback" onClick={() => onUserClick && onUserClick(transaction.fromUser)}>{transaction.fromUser.name}</span>
              <span className="text-slate-500">{transaction.type === TransactionType.PAYMENT ? t('feed.paid') : t('feed.requested')}</span>
              <span className="font-bold text-slate-900">
                {transaction.selectedTraderId ? (isToMe ? t('feed.you') : t('feed.trader')) : (transaction.toUser ? transaction.toUser.name : t('feed.everyone'))}
              </span>
            </div>
            <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap ml-1 sm:ml-2">{timeAgo(transaction.timestamp)}</div>
          </div>

          <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 mb-1.5">
            <PrivacyIcon />
            {transaction.isOTC && (
              <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">{t('feed.otcTrade')}</span>
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
                <span className="font-normal text-[10px] text-slate-400 uppercase">{t('feed.for')}</span>
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

          <div className="flex items-center gap-4 sm:gap-6 mt-3 pt-3 border-t border-gray-50">
            <button 
              onClick={async (e) => { e.stopPropagation(); await handleLike(); }}
              className={`flex items-center gap-1.5 text-xs font-bold transition-colors touch-feedback py-1 px-1 -mx-1 rounded ${hasLiked ? 'text-red-500' : 'text-slate-400 active:text-red-500'}`}
            >
              <Heart className={`w-4 h-4 ${hasLiked ? 'fill-red-500 text-red-500' : ''}`} />
              {transaction.likes > 0 ? transaction.likes : t('feed.like')}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowCommentInput(!showCommentInput); }}
              className={`flex items-center gap-1.5 text-xs font-bold transition-colors touch-feedback py-1 px-1 -mx-1 rounded ${showCommentInput ? 'text-blue-500' : 'text-slate-400 active:text-blue-500'}`}
            >
              <MessageCircle className="w-4 h-4" />
              {transaction.comments > 0 ? transaction.comments : t('feed.comment')}
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
                    placeholder={t('feed.addComment')}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 resize-none min-h-[60px]"
                    rows={2}
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => setShowCommentInput(false)} className="px-3 py-1.5 text-xs font-medium text-gray-600">{t('common.cancel')}</button>
                    <button onClick={async () => { await handleAddComment(); }} disabled={!commentText.trim() || isProcessing} className="px-4 py-1.5 text-xs font-bold bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">{t('feed.post')}</button>
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

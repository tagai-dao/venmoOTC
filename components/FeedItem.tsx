import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, OTCState, Currency, formatCurrency, timeAgo, Privacy, User, generateId } from '../utils';
import { useApp } from '../context/AppContext';
import { Services } from '../services';
import { Heart, MessageCircle, Check, DollarSign, Upload, Shield, Globe, Lock, Users, Banknote, Loader, Twitter, Copy, Send, ExternalLink, X, UserCheck, Hand } from 'lucide-react';
import ReplyDetailModal from './ReplyDetailModal';
import BidListModal from './BidListModal';

interface FeedItemProps {
  transaction: Transaction;
  onUserClick?: (user: User) => void;
}

const FeedItem: React.FC<FeedItemProps> = ({ transaction, onUserClick }) => {
  const { currentUser, updateTransaction, refreshFeed, walletBalance, setWalletBalance } = useApp();
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [hasConfirmedReceivedUSDT, setHasConfirmedReceivedUSDT] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showReplyDetail, setShowReplyDetail] = useState(false);
  const [showBidList, setShowBidList] = useState(false);
  const [showMultisigInfo, setShowMultisigInfo] = useState(false);

  const isMe = currentUser ? transaction.fromUser.id === currentUser.id : false;
  const isToMe = currentUser ? transaction.toUser?.id === currentUser.id : false;

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
      alert('抢单成功！');
    } catch (error: any) {
      console.error('抢单失败:', error);
      alert(error?.message || '抢单失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  // 处理选择交易者
  const handleSelectTrader = async (traderId: string) => {
    if (!currentUser) return;
    setIsProcessing(true);
    try {
      // 1. 选择交易者
      await Services.transactions.selectTrader(transaction.id, traderId);
      
      // 2. 获取交易者的完整信息（包括钱包地址）
      const trader = await Services.users.getUser(traderId);
      
      // 3. 获取 USDT 金额（从交易的 otcOfferAmount 获取）
      const usdtAmount = transaction.otcOfferAmount || 0;
      
      if (usdtAmount <= 0) {
        throw new Error('USDT 金额无效');
      }
      
      // 4. 创建多签合约（2/2 多签，由发布者和选中的交易者控制）
      const { multisig } = await Services.multisig.createContract(
        transaction.id,
        trader.walletAddress,
        usdtAmount
      );
      
      // 5. 发送 USDT 到多签合约
      await Services.multisig.sendUSDTToMultisig(transaction.id);
      
      // 6. 更新钱包余额（从发布者的钱包中扣除 USDT）
      if (currentUser && currentUser.id === transaction.fromUser.id) {
        setWalletBalance(prev => ({
          ...prev,
          [Currency.USDT]: Math.max(0, prev[Currency.USDT] - usdtAmount)
        }));
      }
      
      // 7. 刷新 feed 以更新状态
      await refreshFeed();
      
      alert('✅ 已选择交易者，USDT 已发送到多签合约！');
    } catch (error: any) {
      console.error('选择交易者失败:', error);
      alert(error?.message || '选择交易者失败，请重试');
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // 处理创建多签合约并发送 USDT
  const handleCreateMultisigAndSendUSDT = async () => {
    if (!currentUser || !transaction.toUser) return;
    setIsProcessing(true);
    try {
      // 1. 创建多签合约
      const usdtAmount = transaction.otcOfferAmount || 0;
      const { multisig } = await Services.multisig.createContract(
        transaction.id,
        transaction.toUser.walletAddress,
        usdtAmount
      );

      // 2. 发送 USDT 到多签合约
      await Services.multisig.sendUSDTToMultisig(transaction.id);

      // 3. 刷新余额（通过刷新 feed 来更新）

      await refreshFeed();
    } catch (error: any) {
      console.error('创建多签合约并发送 USDT 失败:', error);
      alert(error?.message || '操作失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  // 处理激活多签合约（确认收到法币并释放 USDT）
  const handleActivateMultisig = async () => {
    if (!currentUser) return;
    setIsProcessing(true);
    try {
      // 请求者签名多签合约（2/2 多签）
      // 如果交易者已经签名，这将自动激活多签合约并释放 USDT
      const result = await Services.multisig.signByRequester(transaction.id);
      
      // 如果返回了 txHash，说明两个签名都已完成，USDT 已释放
      if (result.txHash) {
        await updateTransaction(transaction.id, {
          otcState: OTCState.COMPLETED,
        });
        alert('✅ 已确认收到法币，USDT 已释放给交易者！');
      } else {
        // 只完成了请求者签名，等待交易者签名
        alert('✅ 已签名多签合约，等待交易者签名后释放 USDT');
      }
      
      await refreshFeed();
    } catch (error: any) {
      console.error('签名多签合约失败:', error);
      alert(error?.message || '操作失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  // 处理点赞
  const handleLike = async () => {
    if (!currentUser) {
      alert('请先登录');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await Services.socialInteractions.likeTransaction(transaction.id);
      setHasLiked(result.hasLiked);
      // 刷新 feed 以更新点赞数
      await refreshFeed();
    } catch (error: any) {
      console.error('Like failed:', error);
      alert(error?.message || '点赞失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  // 处理添加评论
  const handleAddComment = async () => {
    if (!currentUser) {
      alert('请先登录');
      return;
    }

    if (!commentText.trim()) {
      alert('请输入评论内容');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await Services.socialInteractions.addComment(transaction.id, commentText.trim());
      setCommentText('');
      setShowCommentInput(false);
      // 刷新 feed 以更新评论
      await refreshFeed();
    } catch (error: any) {
      console.error('Add comment failed:', error);
      alert(error?.message || '评论失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const PrivacyIcon = () => {
    if (transaction.privacy === Privacy.PUBLIC_X) return <Twitter className="w-3 h-3 text-sky-500" />;
    if (transaction.privacy === Privacy.PUBLIC) return <Globe className="w-3 h-3 text-gray-400" />;
    if (transaction.privacy === Privacy.FRIENDS) return <Users className="w-3 h-3 text-gray-400" />;
    return <Lock className="w-3 h-3 text-gray-400" />;
  };

  const handlePayUSDTRequest = async () => {
    if (!currentUser) return;
    setIsProcessing(true);
    try {
      // 1. 获取 USDT 金额
      const usdtAmount = transaction.amount;
      
      if (usdtAmount <= 0) {
        throw new Error('USDT 金额无效');
      }
      
      // 2. 创建多签合约（2/2 多签，由支付者和 Request 发布者控制）
      const { multisig } = await Services.multisig.createContract(
        transaction.id,
        currentUser.walletAddress, // 支付者的钱包地址
        usdtAmount
      );
      
      // 3. 发送 USDT 到多签合约（这会自动更新状态为 AWAITING_FIAT_PAYMENT）
      await Services.multisig.sendUSDTToMultisig(transaction.id);
      
      // 4. 更新钱包余额（从支付者的钱包中扣除 USDT）
      setWalletBalance(prev => ({
        ...prev,
        [Currency.USDT]: Math.max(0, prev[Currency.USDT] - usdtAmount)
      }));
      
      // 5. 更新交易，设置 toUser（支付 USDT 的人）
      // 注意：selectedTraderId 和状态已经在 createMultisigContract 和 sendUSDTToMultisig 中更新了
      await updateTransaction(transaction.id, {
        toUser: currentUser, // 设置支付 USDT 的人
      });
      
      // 6. 刷新 feed
      await refreshFeed();
      
      alert('✅ USDT 已发送到多签合约！等待发布者支付法币。');
    } catch (error: any) {
      console.error('支付 USDT 失败:', error);
      alert(error?.message || '支付失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectFiatPayment = async () => {
    if (!currentUser) return;
    
    const currentRejectionCount = transaction.fiatRejectionCount || 0;
    const newRejectionCount = currentRejectionCount + 1;
    const isFiatRequest = transaction.currency !== Currency.USDT;
    
    setIsProcessing(true);
    try {
      if (newRejectionCount >= 2) {
        // 第二次点击：标记为失败
        await updateTransaction(transaction.id, {
          otcState: OTCState.FAILED,
          fiatRejectionCount: newRejectionCount
        });
        alert('交易已标记为失败。法币转账未收到，Request 已取消。');
      } else {
        // 第一次点击：重置状态，让交易者重新支付
        if (isFiatRequest) {
          // 新流程：重置为 AWAITING_FIAT_PAYMENT，让交易者重新支付
          // 重置 toUser 为 null，允许交易者重新支付并发布
          await updateTransaction(transaction.id, {
            otcState: OTCState.AWAITING_FIAT_PAYMENT,
            fiatRejectionCount: newRejectionCount,
            toUser: null // 重置 toUser，允许交易者重新支付
          });
          alert('已通知交易者检查法币支付并再次支付');
        } else {
          // 第一次点击：重置状态为 AWAITING_FIAT_PAYMENT，允许发起需求的用户重新支付法币
          // 注意：对于 USDT Request，toUser 保持不变（仍然是支付 USDT 的人）
          await updateTransaction(transaction.id, {
            otcState: OTCState.AWAITING_FIAT_PAYMENT,
            fiatRejectionCount: newRejectionCount
          });
          alert('已标记为未收到法币转账。发起需求的用户将收到通知，可以重新支付法币并发布支付动态。');
        }
      }
    } catch (error: any) {
      console.error('拒绝法币转账失败:', error);
      alert(error?.message || '操作失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectFiatForFiatRequest = async () => {
    if (!currentUser) return;
    
    const currentRejectionCount = transaction.fiatRejectionCount || 0;
    const newRejectionCount = currentRejectionCount + 1;
    
    setIsProcessing(true);
    try {
      if (newRejectionCount >= 2) {
        // 第二次点击：标记为失败
        await updateTransaction(transaction.id, {
          otcState: OTCState.FAILED,
          fiatRejectionCount: newRejectionCount
        });
        alert('交易已标记为失败。法币转账未收到，Request 已取消。');
      } else {
        // 第一次点击：重置状态，允许法币支付方重新 paid & post
        await updateTransaction(transaction.id, {
          otcState: OTCState.AWAITING_FIAT_PAYMENT,
          fiatRejectionCount: newRejectionCount,
          toUser: null // 重置 toUser，允许法币支付方重新支付
        });
        alert('已标记为未收到法币转账。法币支付方可以重新支付并发布截图。');
      }
    } catch (error: any) {
      console.error('拒绝法币转账失败:', error);
      alert(error?.message || '操作失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayUSDTForFiatRequest = async () => {
      if (!currentUser) return;
      setIsProcessing(true);
      try {
          // 法币 Request 支付 USDT 后，状态变为 COMPLETED
          await updateTransaction(transaction.id, {
              otcState: OTCState.COMPLETED,
              toUser: transaction.toUser || currentUser
          });
      } catch (error: any) {
          console.error('支付 USDT 失败:', error);
          alert(error?.message || '支付失败，请重试');
      } finally {
    setIsProcessing(false);
      }
  };

  // 压缩图片
  const compressImage = (file: File, maxWidth: number = 1200, maxHeight: number = 1200, quality: number = 0.7): Promise<File> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              const img = new Image();
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;

                  // 计算新尺寸
                  if (width > height) {
                      if (width > maxWidth) {
                          height = (height * maxWidth) / width;
                          width = maxWidth;
                      }
                  } else {
                      if (height > maxHeight) {
                          width = (width * maxHeight) / height;
                          height = maxHeight;
                      }
                  }

                  canvas.width = width;
                  canvas.height = height;

                  const ctx = canvas.getContext('2d');
                  if (!ctx) {
                      reject(new Error('无法创建画布上下文'));
                      return;
                  }

                  ctx.drawImage(img, 0, 0, width, height);

                  canvas.toBlob(
                      (blob) => {
                          if (!blob) {
                              reject(new Error('图片压缩失败'));
                              return;
                          }
                          const compressedFile = new File([blob], file.name, {
                              type: file.type,
                              lastModified: Date.now(),
                          });
                          resolve(compressedFile);
                      },
                      file.type,
                      quality
                  );
              };
              img.onerror = reject;
              img.src = e.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
      });
  };

  // 将文件转换为 base64（压缩后）
  const fileToBase64 = async (file: File): Promise<string> => {
      try {
          // 如果文件大小超过 1MB，先压缩
          let fileToConvert = file;
          if (file.size > 1024 * 1024) {
              fileToConvert = await compressImage(file, 1200, 1200, 0.7);
          }

          return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                  const result = reader.result as string;
                  // 如果 base64 字符串仍然太大（超过 500KB），进一步压缩
                  if (result.length > 500 * 1024) {
                      compressImage(fileToConvert, 800, 800, 0.6)
                          .then((compressed) => {
                              const reader2 = new FileReader();
                              reader2.onload = () => resolve(reader2.result as string);
                              reader2.onerror = reject;
                              reader2.readAsDataURL(compressed);
                          })
                          .catch(reject);
                  } else {
                      resolve(result);
                  }
              };
              reader.onerror = reject;
              reader.readAsDataURL(fileToConvert);
          });
      } catch (error) {
          console.error('图片处理失败:', error);
          throw new Error('图片处理失败，请尝试使用更小的图片');
      }
  };

  const handlePaidAndPost = async () => {
      if (!currentUser) return;
      
      // 验证必须要有回复内容或截图
      if (!replyText.trim() && !file) {
          alert('请添加回复内容或上传支付截图');
          return;
      }
      
      setIsProcessing(true);
      
      try {
          // 将图片转换为 base64，以便持久保存
          let proofUrl: string | undefined;
          if (file) {
              proofUrl = await fileToBase64(file);
          }
          
          // 判断是法币 Request 还是 USDT Request
          const isFiatRequest = transaction.currency !== Currency.USDT;
          
          if (isFiatRequest) {
              // 法币 Request：支付法币后，发布回复，状态变为 AWAITING_FIAT_CONFIRMATION（需要请求者确认收到法币并释放 USDT）
              await updateTransaction(transaction.id, {
                  otcState: OTCState.AWAITING_FIAT_CONFIRMATION,
                  toUser: currentUser, // 设置支付法币的人
                  newReply: {
                      id: generateId(),
                      user: currentUser,
                      text: replyText || "已支付法币，请查看截图并确认收到后释放 USDT。",
                      proof: proofUrl,
                      timestamp: Date.now()
                  }
              });
              
              // 交易者签名多签合约（2/2 多签）
              try {
                  await Services.multisig.signByTrader(transaction.id);
                  console.log('✅ 交易者已签名多签合约');
              } catch (error: any) {
                  console.error('签名多签合约失败:', error);
                  // 不阻止流程继续，因为状态已经更新
              }
          } else {
              // USDT Request：支付 USDT 后，发布回复，状态变为 AWAITING_FIAT_CONFIRMATION
      await updateTransaction(transaction.id, {
          otcState: OTCState.AWAITING_FIAT_CONFIRMATION,
          toUser: currentUser,
          newReply: {
              id: generateId(),
              user: currentUser,
              text: replyText || "I've paid! Please check and release USDT.",
              proof: proofUrl,
              timestamp: Date.now()
          }
      });
          }
      
      // 刷新 feed 以更新状态
      await refreshFeed();
      
      setShowBankDetails(false);
      setReplyText('');
      setFile(null);
      } catch (error: any) {
          console.error('发布回复失败:', error);
          alert(error?.message || '发布回复失败，请重试');
      } finally {
          setIsProcessing(false);
      }
  };

  const handleConfirmReceivedUSDT = async () => {
      if (!currentUser || !transaction.toUser) return;
      setHasConfirmedReceivedUSDT(true);
      setShowBankDetails(true);
  };

  const handlePostReplyAndConfirm = async () => {
      if (!currentUser) {
          console.error('handlePostReplyAndConfirm: currentUser is null');
          alert('请先登录');
          return;
      }
      
      if (!transaction.toUser) {
          console.error('handlePostReplyAndConfirm: transaction.toUser is null', transaction);
          alert('交易信息不完整，无法继续');
          return;
      }
      
      if (!replyText.trim() && !file) {
          alert('请添加回复内容或上传转账截图');
          return;
      }
      
      setIsProcessing(true);
      
      try {
          console.log('handlePostReplyAndConfirm: 开始处理', {
              transactionId: transaction.id,
              hasFile: !!file,
              hasReplyText: !!replyText.trim()
          });
          
          // 将图片转换为 base64，以便持久保存
          let proofUrl: string | undefined;
          if (file) {
              proofUrl = await fileToBase64(file);
          }
          
          // 发布回复并更新状态
          await updateTransaction(transaction.id, {
              otcState: OTCState.AWAITING_FIAT_CONFIRMATION,
              newReply: {
                  id: generateId(),
                  user: currentUser,
                  text: replyText || "已向法币账户转账，请查看截图并确认。",
                  proof: proofUrl,
                  timestamp: Date.now()
              }
          });
          
          console.log('handlePostReplyAndConfirm: 成功');
          setShowBankDetails(false);
          setReplyText('');
          setFile(null);
      } catch (error: any) {
          console.error('发布回复失败:', error);
          alert(error?.message || '发布回复失败，请重试');
      } finally {
          setIsProcessing(false);
      }
  };

  const renderReplies = () => {
      // 在 Feed 中只显示交易相关的回复（有 proof 的回复），最多显示 2 条
      if (!transaction.replies || transaction.replies.length === 0) return null;

      // 筛选出有 proof 的回复（交易相关）
      const transactionReplies = transaction.replies.filter(reply => reply.proof);
      const displayReplies = transactionReplies.slice(0, 2); // 最多显示 2 条

      if (displayReplies.length === 0) return null;

      const totalReplies = transaction.replies.length;
      const hasMoreReplies = totalReplies > displayReplies.length;

      return (
          <div className="mt-4 pl-4 border-l-2 border-gray-100 space-y-4">
              {displayReplies.map((reply) => (
                  <div key={reply.id} className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                      <img src={reply.user.avatar} className="w-6 h-6 rounded-full flex-shrink-0" alt={reply.user.name} />
                      <div className="bg-gray-50 p-2.5 rounded-2xl rounded-tl-none flex-1">
                          <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-700">{reply.user.name}</span>
                                  {reply.privacy === Privacy.PUBLIC_X && reply.xCommentId && (
                                      <Twitter className="w-3 h-3 text-sky-500" title="已同步到 X" />
                                  )}
                              </div>
                              <span className="text-[9px] text-gray-400">{timeAgo(reply.timestamp)}</span>
                          </div>
                          <p className="text-xs text-slate-600 mb-2">{reply.text}</p>
                          {reply.proof && (
                              <div className="relative group overflow-hidden rounded-lg">
                                  <img 
                                      src={reply.proof} 
                                      className="w-full h-24 object-cover border border-gray-200" 
                                      alt="Payment Proof"
                                      onError={(e) => {
                                          console.error('图片加载失败:', reply.proof);
                                          (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                      <ExternalLink className="w-4 h-4 text-white" />
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              ))}
              {hasMoreReplies && (
                  <button
                      onClick={() => setShowReplyDetail(true)}
                      className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1 mt-2"
                  >
                      <MessageCircle className="w-3.5 h-3.5" />
                      查看所有回复 ({totalReplies})
                  </button>
              )}
          </div>
      );
  };

  const renderOTCAction = () => {
    if (!transaction.isOTC) return null;

    const isFiatRequest = transaction.currency !== Currency.USDT;

    // === 1. OPEN_REQUEST 状态 ===
    if (transaction.otcState === OTCState.OPEN_REQUEST) {
      // USDT Request：直接支付
      if (transaction.currency === Currency.USDT && !isMe) {
        return (
          <button 
            disabled={isProcessing}
            onClick={handlePayUSDTRequest}
            className="mt-3 w-full bg-blue-500 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-blue-600 transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-70 active:scale-[0.98]"
          >
            {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
            Pay {formatCurrency(transaction.amount, transaction.currency)}
          </button>
        );
      }

      // 法币 Request：抢单功能
      if (isFiatRequest) {
        if (isMe) {
          // 请求者：查看抢单列表
          const bidCount = transaction.bids?.length || 0;
          return (
            <button
              onClick={() => setShowBidList(true)}
              className="mt-3 w-full bg-blue-500 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-blue-600 transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <UserCheck className="w-4 h-4" />
              查看抢单列表 {bidCount > 0 && `(${bidCount})`}
            </button>
          );
        } else {
          // 非请求者：抢单按钮
          const hasBid = transaction.bids?.some(bid => bid.userId === currentUser?.id);
          if (hasBid) {
            return (
              <div className="mt-3 w-full bg-gray-100 text-gray-600 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                已抢单
              </div>
            );
          }
          return (
            <button
              disabled={isProcessing}
              onClick={handleBid}
              className="mt-3 w-full bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 disabled:opacity-70"
            >
              {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Hand className="w-4 h-4" />}
              抢单
            </button>
          );
        }
      }
    }

    // === 2. BIDDING 状态 ===
    if (transaction.otcState === OTCState.BIDDING) {
      if (isMe) {
        // 请求者：查看抢单列表并选择交易者
        const bidCount = transaction.bids?.length || 0;
        return (
          <button
            onClick={() => setShowBidList(true)}
            className="mt-3 w-full bg-blue-500 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-blue-600 transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <UserCheck className="w-4 h-4" />
            查看抢单列表并选择交易者 {bidCount > 0 && `(${bidCount})`}
          </button>
        );
      } else {
        // 非请求者：已抢单或抢单按钮
        const hasBid = transaction.bids?.some(bid => bid.userId === currentUser?.id);
        if (hasBid) {
          return (
            <div className="mt-3 w-full bg-gray-100 text-gray-600 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              已抢单，等待选择
            </div>
          );
        }
        return (
          <button
            disabled={isProcessing}
            onClick={handleBid}
            className="mt-3 w-full bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 disabled:opacity-70"
          >
            {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Hand className="w-4 h-4" />}
            抢单
          </button>
        );
      }
    }

    // === 3. SELECTED_TRADER 状态 ===
    if (transaction.otcState === OTCState.SELECTED_TRADER) {
      if (isMe && transaction.toUser) {
        // 请求者：创建多签合约并发送 USDT
        return (
          <button
            disabled={isProcessing}
            onClick={handleCreateMultisigAndSendUSDT}
            className="mt-3 w-full bg-blue-500 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-blue-600 transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-70"
          >
            {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            创建多签合约并发送 {formatCurrency(transaction.otcOfferAmount || 0, Currency.USDT)} USDT
          </button>
        );
      } else if (isToMe) {
        // 被选中的交易者：等待创建多签合约
        return (
          <div className="mt-3 w-full bg-gray-100 text-gray-600 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
            <Loader className="w-4 h-4 animate-spin" />
            等待创建多签合约...
          </div>
        );
      }
    }

    // === 4. USDT_IN_ESCROW 状态 ===
    if (transaction.otcState === OTCState.USDT_IN_ESCROW) {
      if (isMe) {
        return (
          <div className="mt-3 w-full bg-blue-50 text-blue-700 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-blue-200">
            <Shield className="w-4 h-4" />
            USDT 已发送到多签合约，等待交易者支付法币
          </div>
        );
      } else if (isToMe) {
        // 交易者：支付法币
        if (!showBankDetails) {
          const hasRejection = (transaction.fiatRejectionCount || 0) > 0;
          return (
            <button
              onClick={() => setShowBankDetails(true)}
              className="mt-3 w-full bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
            >
              <Banknote className="w-4 h-4" />
              {hasRejection 
                ? `对方没有收到法币支付，需再次支付 ${formatCurrency(transaction.amount, transaction.currency)} 法币`
                : `支付 ${formatCurrency(transaction.amount, transaction.currency)} 法币`}
            </button>
          );
        } else {
                 const bankInfo = {
                    bank: transaction.fromUser.fiatDetails?.bankName || 'Citibank',
                    account: transaction.fromUser.fiatDetails?.accountNumber || '987654321',
                    name: transaction.fromUser.fiatDetails?.accountName || transaction.fromUser.name
                 };

                 return (
                    <div className="mt-3 space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                           <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Requester's Bank Account</p>
                           {[
                               { label: 'Bank', value: bankInfo.bank },
                               { label: 'Account', value: bankInfo.account },
                               { label: 'Name', value: bankInfo.name }
                           ].map((item) => (
                               <div key={item.label} className="flex justify-between items-center bg-white p-2.5 rounded-lg border text-sm hover:border-gray-300 transition-colors">
                                   <div>
                                       <span className="text-[10px] text-gray-400 block uppercase leading-none mb-1">{item.label}</span>
                                       <span className="font-bold text-slate-700">{item.value}</span>
                                   </div>
                                   <button onClick={() => handleCopy(item.value, item.label)} className="p-1.5 hover:bg-gray-100 rounded-md transition text-gray-400">
                                       {copiedField === item.label ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                   </button>
                               </div>
                           ))}
                       </div>

                       <div className="space-y-3 pt-2 border-t border-gray-200">
                           <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">发布回复并附上支付截图</p>
                           <textarea 
                                placeholder="输入回复内容（例如：已向您的法币账户转账，请查看截图并确认收到后支付 USDT）..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-green-100 resize-none h-20"
                           />
                           <div className="flex gap-2">
                               <label className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 border-2 border-dashed rounded-xl py-3 bg-white cursor-pointer hover:bg-gray-50 transition border-gray-200">
                                   <Upload className="w-3.5 h-3.5" />
                                   <span className="truncate">{file ? file.name : "上传支付截图"}</span>
                                   <input 
                                       type="file" 
                                       accept="image/*" 
                                       className="hidden" 
                                       onChange={(e) => setFile(e.target.files?.[0] || null)} 
                                   />
                               </label>
                               <button 
                                   disabled={isProcessing || (!replyText.trim() && !file)}
                                   onClick={handlePaidAndPost}
                                   className="flex-[1.5] bg-green-600 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                               >
                                   {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                   支付并发布 {transaction.privacy === Privacy.PUBLIC_X && <Twitter className="w-3.5 h-3.5 fill-white/20" />}
                               </button>
                           </div>
                           <p className="text-[10px] text-gray-500 opacity-70">
                               * 发布回复后，状态将变为：需要 {transaction.fromUser.name} 支付 USDT
                           </p>
                       </div>
                   </div>
                 )
             }
        }
    }

    // === 5. AWAITING_FIAT_PAYMENT 状态 ===
    if (transaction.otcState === OTCState.AWAITING_FIAT_PAYMENT) {
      if (isFiatRequest) {
        // 交易者：支付法币
        if (isToMe) {
          if (!showBankDetails) {
            const hasRejection = (transaction.fiatRejectionCount || 0) > 0;
            return (
              <button
                onClick={() => setShowBankDetails(true)}
                className="mt-3 w-full bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
              >
                <Banknote className="w-4 h-4" />
                {hasRejection 
                  ? `对方没有收到法币支付，需再次支付 ${formatCurrency(transaction.amount, transaction.currency)} 法币`
                  : `支付 ${formatCurrency(transaction.amount, transaction.currency)} 法币`}
              </button>
            );
          } else {
            const bankInfo = {
              bank: transaction.fromUser.fiatDetails?.bankName || 'Citibank',
              account: transaction.fromUser.fiatDetails?.accountNumber || '987654321',
              name: transaction.fromUser.fiatDetails?.accountName || transaction.fromUser.name
            };

            return (
              <div className="mt-3 space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Requester's Bank Account</p>
                  {[
                    { label: 'Bank', value: bankInfo.bank },
                    { label: 'Account', value: bankInfo.account },
                    { label: 'Name', value: bankInfo.name }
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between items-center bg-white p-2.5 rounded-lg border text-sm hover:border-gray-300 transition-colors">
                      <div>
                        <span className="text-[10px] text-gray-400 block uppercase leading-none mb-1">{item.label}</span>
                        <span className="font-bold text-slate-700">{item.value}</span>
                      </div>
                      <button onClick={() => handleCopy(item.value, item.label)} className="p-1.5 hover:bg-gray-100 rounded-md transition text-gray-400">
                        {copiedField === item.label ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-200">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">发布回复并附上支付截图</p>
                  <textarea 
                    placeholder="输入回复内容（例如：已向您的法币账户转账，请查看截图并确认收到后支付 USDT）..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-green-100 resize-none h-20"
                  />
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 border-2 border-dashed rounded-xl py-3 bg-white cursor-pointer hover:bg-gray-50 transition border-gray-200">
                      <Upload className="w-3.5 h-3.5" />
                      <span className="truncate">{file ? file.name : "上传支付截图"}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => setFile(e.target.files?.[0] || null)} 
                      />
                    </label>
                    <button 
                      disabled={isProcessing || (!replyText.trim() && !file)}
                      onClick={handlePaidAndPost}
                      className="flex-[1.5] bg-green-600 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Paid & Post {transaction.privacy === Privacy.PUBLIC_X && <Twitter className="w-3.5 h-3.5 fill-white/20" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          }
        } else if (isMe) {
          // 请求者：等待交易者支付法币
          return (
            <div className="mt-3 w-full bg-blue-50 text-blue-700 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-blue-200">
              <Loader className="w-4 h-4 animate-spin" />
              等待 {transaction.toUser?.name} 支付法币
            </div>
          );
        }
      }
    }

    // === 6. AWAITING_FIAT_CONFIRMATION 状态 ===
    if (transaction.otcState === OTCState.AWAITING_FIAT_CONFIRMATION) {
      if (isFiatRequest) {
        if (isMe) {
          // 请求者：确认收到法币并激活多签合约，或拒绝
          return (
            <div className="mt-3 space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <p className="text-xs font-bold text-gray-700 mb-2">交易者已支付法币并发布截图，请确认收到后释放多签合约的 USDT</p>
              <div className="flex gap-2">
                <button
                  disabled={isProcessing}
                  onClick={handleActivateMultisig}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-green-500/20 hover:bg-green-700 transition disabled:opacity-50"
                >
                  {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  已接收到法币支付，释放多签合约的 USDT
                </button>
                <button
                  disabled={isProcessing}
                  onClick={handleRejectFiatPayment}
                  className="flex-1 bg-red-500 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-red-500/20 hover:bg-red-600 transition disabled:opacity-50"
                >
                  {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  未收到法币支付，需所选抢单者检查法币支付 & 再次支付
                </button>
              </div>
              {(transaction.fiatRejectionCount || 0) > 0 && (
                <p className="text-[10px] text-red-600 mt-2 text-center">
                  已拒绝 {transaction.fiatRejectionCount} 次{transaction.fiatRejectionCount >= 2 ? '，再次拒绝将导致交易失败' : ''}
                </p>
              )}
            </div>
          );
        } else if (isToMe) {
          // 交易者：等待请求者确认
          return (
            <div className="mt-3 bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800 flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold">
                <Check className="w-4 h-4 bg-blue-500 text-white rounded-full p-0.5" />
                已发布回复和转账截图
              </div>
              <div className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider flex items-center gap-2 border-t pt-2 border-blue-200/50">
                <Loader className="w-3 h-3 animate-spin text-blue-500" /> 
                待 Request 发布者检查是否收到法币支付 & 释放 USDT
              </div>
            </div>
          );
        }
      }
    }

    // === 旧流程兼容（USDT Request） ===
    if (transaction.otcState === OTCState.AWAITING_FIAT_PAYMENT && !isFiatRequest) {
        // 如果 toUser 是 null，说明状态被重置，法币支付方可以再次支付
        if (!isMe && !transaction.toUser && transaction.currency !== Currency.USDT) {
                // 法币支付方可以再次支付（状态被重置后）
                if (!showBankDetails) {
                    return (
                    <button 
                         onClick={() => setShowBankDetails(true)}
                            className="mt-3 w-full bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                        >
                            <Banknote className="w-4 h-4" /> 对方反馈没有收到法币，请重新支付 & 发帖
                        </button>
                    );
                } else {
                    const bankInfo = {
                        bank: transaction.fromUser.fiatDetails?.bankName || 'Citibank',
                        account: transaction.fromUser.fiatDetails?.accountNumber || '987654321',
                        name: transaction.fromUser.fiatDetails?.accountName || transaction.fromUser.name
                    };

                    return (
                        <div className="mt-3 space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 animate-in fade-in slide-in-from-top-2">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
                                <p className="text-xs text-yellow-800 font-bold">⚠️ 请重新支付并上传新的支付截图</p>
                            </div>
                            <div className="space-y-2">
                               <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Requester's Bank Account</p>
                               {[
                                   { label: 'Bank', value: bankInfo.bank },
                                   { label: 'Account', value: bankInfo.account },
                                   { label: 'Name', value: bankInfo.name }
                               ].map((item) => (
                                   <div key={item.label} className="flex justify-between items-center bg-white p-2.5 rounded-lg border text-sm hover:border-gray-300 transition-colors">
                                       <div>
                                           <span className="text-[10px] text-gray-400 block uppercase leading-none mb-1">{item.label}</span>
                                           <span className="font-bold text-slate-700">{item.value}</span>
                                       </div>
                                       <button onClick={() => handleCopy(item.value, item.label)} className="p-1.5 hover:bg-gray-100 rounded-md transition text-gray-400">
                                           {copiedField === item.label ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                       </button>
                                   </div>
                               ))}
                           </div>

                           <div className="space-y-3 pt-2 border-t border-gray-200">
                               <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">发布回复并附上支付截图</p>
                               <textarea 
                                    placeholder="输入回复内容（例如：已向您的法币账户转账，请查看截图并确认收到后支付 USDT）..."
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-green-100 resize-none h-20"
                               />
                               <div className="flex gap-2">
                                   <label className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 border-2 border-dashed rounded-xl py-3 bg-white cursor-pointer hover:bg-gray-50 transition border-gray-200">
                                       <Upload className="w-3.5 h-3.5" />
                                       <span className="truncate">{file ? file.name : "上传支付截图"}</span>
                                       <input 
                                           type="file" 
                                           accept="image/*" 
                                           className="hidden" 
                                           onChange={(e) => setFile(e.target.files?.[0] || null)} 
                                       />
                                   </label>
                                   <button 
                                       disabled={isProcessing || (!replyText.trim() && !file)}
                                       onClick={handlePaidAndPost}
                                       className="flex-[1.5] bg-green-600 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                   >
                                       {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                       支付并发布 {transaction.privacy === Privacy.PUBLIC_X && <Twitter className="w-3.5 h-3.5 fill-white/20" />}
                    </button>
                               </div>
                               <p className="text-[10px] text-gray-500 opacity-70">
                                   * 发布回复后，状态将变为：需要 {transaction.fromUser.name} 支付 USDT
                               </p>
                           </div>
                       </div>
                    );
                }
            }
            
            if (isMe && transaction.toUser) {
                // 请求者（Mike Chen）需要支付 USDT
                return (
                    <div className="mt-3 bg-green-50 p-4 rounded-xl border border-green-100 animate-in zoom-in-95">
                        <p className="text-sm text-green-800 mb-3 font-bold flex items-center gap-2">
                            <Check className="w-4 h-4 bg-green-500 text-white rounded-full p-0.5" />
                            需要您支付 USDT
                        </p>
                        <p className="text-xs text-green-700 mb-3 opacity-80">
                            {transaction.toUser.name} 已向您的法币账户转账 {formatCurrency(transaction.amount, transaction.currency)}，并发布了回复和支付截图。请确认收到法币后，支付 USDT。
                        </p>
                        
                        {/* 显示回复和截图 */}
                        {transaction.replies && transaction.replies.length > 0 && (
                            <div className="mb-4 p-3 bg-white rounded-lg border border-green-200">
                                <p className="text-[10px] text-gray-500 mb-2">支付法币的回复：</p>
                                <div className="space-y-2">
                                    {transaction.replies.map((reply) => (
                                        <div key={reply.id} className="text-xs">
                                            <p className="text-gray-700 mb-1">{reply.text}</p>
                                            {reply.proof && (
                                                <img 
                                                    src={reply.proof} 
                                                    alt="支付截图" 
                                                    className="rounded-lg w-full max-h-32 object-cover border border-gray-200"
                                                    onError={(e) => {
                                                        console.error('图片加载失败:', reply.proof);
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <div className="flex gap-2">
                            <button 
                                disabled={isProcessing}
                                onClick={handlePayUSDTForFiatRequest}
                                className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold shadow-md hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                                支付 {formatCurrency(transaction.otcOfferAmount || 0, Currency.USDT)}
                            </button>
                            <button 
                                onClick={handleRejectFiatForFiatRequest}
                                className="flex-1 bg-red-500 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-red-500/20 hover:bg-red-600 transition disabled:opacity-50"
                                disabled={isProcessing}
                            >
                                {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                没有收到法币，请再次确认
                            </button>
                        </div>
                        {(transaction.fiatRejectionCount || 0) > 0 && (
                            <p className="text-[10px] text-red-600 mt-2 text-center">
                                已拒绝 {transaction.fiatRejectionCount} 次{transaction.fiatRejectionCount >= 2 ? '，再次拒绝将导致交易失败' : '，再次拒绝将导致交易失败'}
                            </p>
                        )}
                    </div>
                );
            } else if (isToMe || (transaction.toUser && transaction.toUser.id === currentUser?.id)) {
                // 支付法币的人（Sarah Jones）等待请求者支付 USDT
                return (
                    <div className="mt-3 bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
                        <div className="flex items-center gap-2 font-bold mb-2">
                            <Check className="w-4 h-4 bg-blue-500 text-white rounded-full p-0.5" />
                            已支付法币并发布回复
                        </div>
                        <p className="text-xs opacity-70">
                            等待 {transaction.fromUser.name} 确认收到法币并支付 USDT...
                        </p>
                    </div>
                );
            }
        } else {
            // USDT Request 流程（之前的实现）
            if (isMe) {
                // 优先检查：如果对方反馈没有收到法币，不显示正常支付界面，让后面的逻辑处理
                if ((transaction.fiatRejectionCount || 0) > 0) {
                    // 这个逻辑会在后面处理，这里直接跳过，不显示正常支付界面
                    // 注意：这里不能 return，因为后面的代码会处理重新支付的逻辑
                } else if (!transaction.toUser) {
                    // USDT Request：等待对方支付 USDT（还没有人支付）
                    return (
                        <div className="mt-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p className="text-sm text-gray-700 mb-2 font-bold flex items-center gap-2">
                                <Loader className="w-4 h-4 animate-spin text-gray-500" />
                                待对方支付 USDT
                            </p>
                            <p className="text-xs text-gray-600 opacity-80">
                                等待其他用户支付 USDT...
                            </p>
                        </div>
                    );
                } else if (!hasConfirmedReceivedUSDT) {
                    // Sarah Jones (请求者) 收到 USDT 后的流程
                    return (
                        <div className="mt-3 bg-blue-50 p-4 rounded-xl border border-blue-100 animate-in zoom-in-95">
                            <p className="text-sm text-blue-800 mb-3 font-bold flex items-center gap-2">
                                <Check className="w-4 h-4 bg-blue-500 text-white rounded-full p-0.5" />
                                USDT 已收到！
                            </p>
                            <p className="text-xs text-blue-700 mb-3 opacity-80">
                                {transaction.toUser?.name} 已支付 USDT。请确认收到后，向 {transaction.toUser?.name} 的法币账户转账。
                            </p>
                            <button 
                                 onClick={handleConfirmReceivedUSDT}
                                 className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 transition"
                            >
                                 收到了 USDT
                            </button>
                        </div>
                    );
                } else {
                    // 显示法币账户信息和回复功能（只有在 fiatRejectionCount === 0 时才显示）
                    return (
                    <div className="mt-3 bg-blue-50 p-4 rounded-xl border border-blue-100 animate-in zoom-in-95">
                        <p className="text-sm text-blue-800 mb-3 font-bold flex items-center gap-2">
                            <Check className="w-4 h-4 bg-blue-500 text-white rounded-full p-0.5" />
                            USDT 已收到，请向法币账户转账
                        </p>
                        
                        {/* 法币账户信息 */}
                        <div className="mb-4 space-y-2">
                            <p className="text-xs font-bold text-blue-900 uppercase mb-2">收款人法币账户信息</p>
                            <div className="bg-white p-3 rounded-lg border text-sm text-gray-700 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-500">银行</span>
                                    <span className="font-bold">{transaction.toUser?.fiatDetails?.bankName || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-500">账户号</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold">{transaction.toUser?.fiatDetails?.accountNumber || 'N/A'}</span>
                                        <button 
                                            onClick={() => handleCopy(transaction.toUser?.fiatDetails?.accountNumber || '', 'account')}
                                            className="p-1 hover:bg-gray-100 rounded transition"
                                        >
                                            {copiedField === 'account' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-500">账户名</span>
                                    <span className="font-bold">{transaction.toUser?.fiatDetails?.accountName || transaction.toUser?.name || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        {/* 回复和截图上传 */}
                        <div className="space-y-3 pt-3 border-t border-blue-200">
                            <p className="text-xs font-bold text-blue-900 uppercase mb-2">发布回复并附上转账截图</p>
                            <textarea 
                                 placeholder="输入回复内容（例如：已向您的法币账户转账，请查看截图并确认）..."
                                 value={replyText}
                                 onChange={(e) => setReplyText(e.target.value)}
                                 className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-100 resize-none h-20"
                            />
                            <div className="flex gap-2">
                                <label className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 border-2 border-dashed rounded-xl py-3 bg-white cursor-pointer hover:bg-gray-50 transition border-gray-200">
                                    <Upload className="w-3.5 h-3.5" />
                                    <span className="truncate">{file ? file.name : "上传转账截图"}</span>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={(e) => setFile(e.target.files?.[0] || null)} 
                                    />
                                </label>
                                <button 
                                    disabled={isProcessing || (!replyText.trim() && !file)}
                                    onClick={handlePostReplyAndConfirm}
                                    className="flex-[1.5] bg-green-600 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed py-3"
                                >
                                    {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    发布回复并确认
                                    {transaction.privacy === Privacy.PUBLIC_X && <Twitter className="w-3.5 h-3.5 fill-white/20" />}
                                </button>
                            </div>
                            <p className="text-[10px] text-blue-700 opacity-70">
                                * 发布回复后，状态将变为：需要 {transaction.toUser?.name} 确认收到法币转账
                            </p>
                        </div>
                </div>
                    );
                }
            } else if (isToMe) {
                // Alex Rivera (支付 USDT 的人) 的视角 - 仅适用于 USDT Request
                // 注意：此时 USDT 已直接发送给对方（请求者），并非托管账户
                return (
                    <div className="mt-3 bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-sm text-indigo-900">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-indigo-500 text-white p-1 rounded-full"><Check className="w-4 h-4" /></div>
                            <p className="font-bold">USDT 已发送给对方</p>
                        </div>
                        <p className="text-xs opacity-70">等待 {transaction.fromUser.name} 向您的法币账户转账并发布回复...</p>
                    </div>
                );
            }
            
            // USDT Request: 发起需求的用户（isMe）在 AWAITING_FIAT_PAYMENT 状态
            // 如果 fiatRejectionCount > 0，说明对方反馈没有收到法币，需要重新支付
            if (isMe && transaction.currency === Currency.USDT && (transaction.fiatRejectionCount || 0) > 0) {
                // 显示提示和重新支付按钮
                if (!showBankDetails) {
                    return (
                    <div className="mt-3 bg-yellow-50 p-4 rounded-xl border border-yellow-200 animate-in zoom-in-95">
                        <div className="flex items-center gap-2 text-yellow-800 font-bold mb-2">
                            <X className="w-4 h-4 bg-yellow-500 text-white rounded-full p-0.5" />
                            对方反馈没有收到法币支付
                        </div>
                        <p className="text-xs text-yellow-700 mb-3 opacity-80">
                            {transaction.toUser?.name} 反馈没有收到法币转账。请重新支付法币，并发布支付动态和截图。
                        </p>
                        <button 
                            onClick={() => setShowBankDetails(true)}
                            className="w-full bg-yellow-600 text-white py-2.5 rounded-lg text-sm font-bold shadow-md hover:bg-yellow-700 transition flex items-center justify-center gap-2"
                        >
                            <Banknote className="w-4 h-4" />
                            查看对方法币账户并重新支付
                        </button>
                    </div>
                );
            } else {
                // 显示法币账户信息和重新支付界面
                const bankInfo = {
                    bank: transaction.toUser?.fiatDetails?.bankName || 'N/A',
                    account: transaction.toUser?.fiatDetails?.accountNumber || 'N/A',
                    name: transaction.toUser?.fiatDetails?.accountName || transaction.toUser?.name || 'N/A'
                };

                return (
                    <div className="mt-3 space-y-4 bg-yellow-50 p-4 rounded-2xl border border-yellow-200 animate-in fade-in slide-in-from-top-2">
                        <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-2 mb-2">
                            <p className="text-xs text-yellow-900 font-bold">⚠️ 请重新支付法币并上传新的支付截图</p>
                        </div>
                        <div className="space-y-2">
                           <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">收款人法币账户信息</p>
                           {[
                               { label: 'Bank', value: bankInfo.bank },
                               { label: 'Account', value: bankInfo.account },
                               { label: 'Name', value: bankInfo.name }
                           ].map((item) => (
                               <div key={item.label} className="flex justify-between items-center bg-white p-2.5 rounded-lg border text-sm hover:border-gray-300 transition-colors">
                                   <div>
                                       <span className="text-[10px] text-gray-400 block uppercase leading-none mb-1">{item.label}</span>
                                       <span className="font-bold text-slate-700">{item.value}</span>
                                   </div>
                                   <button onClick={() => handleCopy(item.value, item.label)} className="p-1.5 hover:bg-gray-100 rounded-md transition text-gray-400">
                                       {copiedField === item.label ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                   </button>
                               </div>
                           ))}
                       </div>

                       <div className="space-y-3 pt-2 border-t border-yellow-200">
                           <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">发布回复并附上支付截图</p>
                           <textarea 
                                placeholder="输入回复内容（例如：已重新向您的法币账户转账，请查看截图并确认收到）..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-yellow-100 resize-none h-20"
                           />
                           <div className="flex gap-2">
                               <label className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 border-2 border-dashed rounded-xl py-3 bg-white cursor-pointer hover:bg-gray-50 transition border-gray-200">
                                   <Upload className="w-3.5 h-3.5" />
                                   <span className="truncate">{file ? file.name : "上传支付截图"}</span>
                                   <input 
                                       type="file" 
                                       accept="image/*" 
                                       className="hidden" 
                                       onChange={(e) => setFile(e.target.files?.[0] || null)} 
                                   />
                               </label>
                               <button 
                                   disabled={isProcessing || (!replyText.trim() && !file)}
                                   onClick={(e) => {
                                       e.preventDefault();
                                       e.stopPropagation();
                                       console.log('Paid & Post button clicked', {
                                           hasCurrentUser: !!currentUser,
                                           hasToUser: !!transaction.toUser,
                                           hasReplyText: !!replyText.trim(),
                                           hasFile: !!file,
                                           isProcessing
                                       });
                                       if (!transaction.toUser) {
                                           alert('交易信息不完整，无法继续。请刷新页面重试。');
                                           return;
                                       }
                                       handlePostReplyAndConfirm();
                                   }}
                                   className="flex-[1.5] bg-yellow-600 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                               >
                                   {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                   Paid & Post {transaction.privacy === Privacy.PUBLIC_X && <Twitter className="w-3.5 h-3.5 fill-white/20" />}
                               </button>
                           </div>
                           <p className="text-[10px] text-yellow-700 opacity-70">
                               * 发布回复后，状态将变为：需要 {transaction.toUser?.name} 确认收到法币转账
                           </p>
                       </div>
                   </div>
                );
            }
        }
    }

    // === 7. COMPLETED 状态 ===
    if (transaction.otcState === OTCState.COMPLETED) {
        return (
            <div className="mt-3 bg-slate-900 text-white p-3 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-2 shadow-lg">
                <Shield className="w-4 h-4 text-blue-400" /> TRADE SECURED & COMPLETED
            </div>
        );
    }

    // === 8. FAILED 状态 ===
    if (transaction.otcState === OTCState.FAILED) {
        return (
            <div className="mt-3 bg-red-50 border border-red-200 p-4 rounded-xl text-center">
                <div className="flex items-center justify-center gap-2 text-red-800 font-bold mb-2">
                    <X className="w-4 h-4" /> 交易失败
                </div>
                <p className="text-xs text-red-700 opacity-80">
                    法币转账未收到，Request 已取消。
                </p>
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
              <span className="font-bold text-slate-900">{transaction.toUser ? transaction.toUser.name : (transaction.privacy === Privacy.PUBLIC_X ? 'Public on X' : (transaction.privacy === Privacy.PUBLIC ? 'Everyone' : 'Friends'))}</span>
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
                {transaction.isOTC && transaction.otcState === OTCState.OPEN_REQUEST && (
                    <span className="text-[10px] font-medium text-slate-400 ml-2 border-l border-slate-200 pl-2">Seeking {transaction.currency}</span>
                )}
            </div>
            {transaction.isOTC && transaction.otcOfferAmount && transaction.otcFiatCurrency && (
                <div className="text-xs opacity-80 mt-1 pt-1 border-t border-blue-200/50 w-full flex items-center gap-2">
                    <span className="font-normal text-[10px] text-slate-400 uppercase">For</span>
                    <span>{formatCurrency(transaction.otcOfferAmount, transaction.otcFiatCurrency)}</span>
                </div>
            )}
          </div>

          {renderOTCAction()}
          {renderReplies()}

          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-50">
            <button 
              onClick={handleLike}
              disabled={isProcessing || !currentUser}
              className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                hasLiked 
                  ? 'text-red-500' 
                  : 'text-slate-400 hover:text-red-500'
              } ${isProcessing || !currentUser ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Heart className={`w-4 h-4 ${hasLiked ? 'fill-red-500 text-red-500' : ''}`} />
              {transaction.likes > 0 ? transaction.likes : 'Like'}
            </button>
            <button 
              onClick={() => setShowCommentInput(!showCommentInput)}
              disabled={!currentUser}
              className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                showCommentInput 
                  ? 'text-blue-500' 
                  : 'text-slate-400 hover:text-blue-500'
              } ${!currentUser ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <MessageCircle className="w-4 h-4" />
              {transaction.comments > 0 ? transaction.comments : 'Comment'}
            </button>
          </div>

          {/* 评论输入框 */}
          {showCommentInput && currentUser && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex gap-2">
                <img 
                  src={currentUser.avatar} 
                  className="w-6 h-6 rounded-full flex-shrink-0" 
                  alt={currentUser.name} 
                />
                <div className="flex-1">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="添加评论..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 resize-none min-h-[60px]"
                    rows={2}
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => {
                        setShowCommentInput(false);
                        setCommentText('');
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 transition"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAddComment}
                      disabled={isProcessing || !commentText.trim()}
                      className="px-4 py-1.5 text-xs font-bold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {isProcessing ? <Loader className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      发布
                      {transaction.privacy === Privacy.PUBLIC_X && (
                        <Twitter className="w-3 h-3 fill-white/20" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 回复详情模态框 */}
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
          onSelectTrader={handleSelectTrader}
        />
      )}
    </div>
  );
};

export default FeedItem;
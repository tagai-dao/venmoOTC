import React, { useState } from 'react';
import { Transaction, TransactionType, OTCState, Currency, formatCurrency, timeAgo, Privacy, User, generateId } from '../utils';
import { useApp } from '../context/AppContext';
import { Heart, MessageCircle, Check, DollarSign, Upload, Shield, Globe, Lock, Users, Banknote, Loader, Twitter, Copy, Send, ExternalLink } from 'lucide-react';

interface FeedItemProps {
  transaction: Transaction;
  onUserClick?: (user: User) => void;
}

const FeedItem: React.FC<FeedItemProps> = ({ transaction, onUserClick }) => {
  const { currentUser, updateTransaction } = useApp();
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [hasConfirmedReceivedUSDT, setHasConfirmedReceivedUSDT] = useState(false);

  const isMe = currentUser ? transaction.fromUser.id === currentUser.id : false;
  const isToMe = currentUser ? transaction.toUser?.id === currentUser.id : false;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
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
        // This call now triggers the AppContext logic which calls the Blockchain Service
        await updateTransaction(transaction.id, {
            otcState: OTCState.AWAITING_FIAT_PAYMENT,
            toUser: currentUser 
        });
    } catch (error: any) {
        console.error('支付 USDT 失败:', error);
        alert(error?.message || '支付失败，请重试');
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
              // 法币 Request：支付法币后，发布回复，状态变为 AWAITING_FIAT_PAYMENT（需要请求者支付 USDT）
              await updateTransaction(transaction.id, {
                  otcState: OTCState.AWAITING_FIAT_PAYMENT,
                  toUser: currentUser, // 设置支付法币的人
                  newReply: {
                      id: generateId(),
                      user: currentUser,
                      text: replyText || "已支付法币，请查看截图。请支付 USDT。",
                      proof: proofUrl,
                      timestamp: Date.now()
                  }
              });
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
      if (!currentUser || !transaction.toUser) return;
      if (!replyText.trim() && !file) {
          alert('请添加回复内容或上传转账截图');
          return;
      }
      
      setIsProcessing(true);
      
      try {
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
      if (!transaction.replies || transaction.replies.length === 0) return null;

      return (
          <div className="mt-4 pl-4 border-l-2 border-gray-100 space-y-4">
              {transaction.replies.map((reply) => (
                  <div key={reply.id} className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                      <img src={reply.user.avatar} className="w-6 h-6 rounded-full flex-shrink-0" alt={reply.user.name} />
                      <div className="bg-gray-50 p-2.5 rounded-2xl rounded-tl-none flex-1">
                          <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-bold text-slate-700">{reply.user.name}</span>
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
          </div>
      );
  };

  const renderOTCAction = () => {
    if (!transaction.isOTC) return null;

    if (transaction.otcState === OTCState.OPEN_REQUEST && !isMe) {
        if (transaction.currency === Currency.USDT) {
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
        } else {
             if (!showBankDetails) {
                 return (
                    <button 
                        onClick={() => setShowBankDetails(true)}
                        className="mt-3 w-full bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                    >
                        <Banknote className="w-4 h-4" /> Pay {formatCurrency(transaction.amount, transaction.currency)}
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

    if (transaction.otcState === OTCState.AWAITING_FIAT_PAYMENT) {
        const isFiatRequest = transaction.currency !== Currency.USDT;
        
        if (isFiatRequest) {
            // 法币 Request 流程：已支付法币，需要请求者支付 USDT
            // isMe 表示是请求者（Mike Chen），isToMe 表示是支付法币的人（Sarah Jones）
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
                        
                        <button 
                            disabled={isProcessing}
                            onClick={handlePayUSDTForFiatRequest}
                            className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold shadow-md hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                            支付 {formatCurrency(transaction.otcOfferAmount || 0, Currency.USDT)}
                        </button>
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
                // Sarah Jones (请求者) 收到 USDT 后的流程
                if (!hasConfirmedReceivedUSDT) {
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
                }
                
                // 显示法币账户信息和回复功能
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
        }
    }

    if (transaction.otcState === OTCState.AWAITING_FIAT_CONFIRMATION) {
        // 对于 USDT Request: isMe 是请求者(Sarah), isToMe 是支付者(Alex)
        // 在这个状态下，Sarah 已经发布了回复和截图，等待 Alex 确认收到法币
        
        if (isToMe && transaction.currency === Currency.USDT) {
            // Alex Rivera (支付 USDT 的人) 需要确认收到法币转账
            return (
                <div className="mt-3 bg-green-50 p-4 rounded-xl border border-green-100 animate-in bounce-in duration-500">
                    <div className="flex items-center gap-2 text-green-800 font-bold mb-3">
                         <Check className="w-4 h-4 bg-green-500 text-white rounded-full p-0.5" /> 
                         需要您确认收到法币转账
                    </div>
                    <p className="text-xs text-green-700 mb-3 opacity-80">
                        {transaction.fromUser.name} 已向您的法币账户转账，并发布了回复和转账截图。请检查您的银行账户，确认收到转账后点击下方按钮。
                    </p>
                    {transaction.replies && transaction.replies.length > 0 && (
                        <div className="mb-4 p-2 bg-white rounded-lg border border-green-200">
                            <p className="text-[10px] text-gray-500 mb-1">最新回复：</p>
                            <p className="text-xs text-gray-700">{transaction.replies[transaction.replies.length - 1].text}</p>
                            {transaction.replies[transaction.replies.length - 1].proof && (
                                <img 
                                    src={transaction.replies[transaction.replies.length - 1].proof} 
                                    alt="转账截图" 
                                    className="mt-2 rounded-lg w-full max-h-32 object-cover border border-gray-200"
                                />
                            )}
                        </div>
                    )}
                    <button 
                        onClick={() => updateTransaction(transaction.id, { otcState: OTCState.COMPLETED })}
                        className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-green-500/20 hover:bg-green-700 transition"
                    >
                        <Shield className="w-4 h-4" /> 确认收到法币转账
                    </button>
                </div>
            );
        } else if (isMe && transaction.currency === Currency.USDT) {
            // Sarah Jones (请求者) 已发布回复，等待 Alex 确认
            return (
                <div className="mt-3 bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800 flex flex-col gap-2">
                    <div className="flex items-center gap-2 font-bold">
                        <Check className="w-4 h-4 bg-blue-500 text-white rounded-full p-0.5" />
                        已发布回复和转账截图
                    </div>
                    <div className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider flex items-center gap-2 border-t pt-2 border-blue-200/50">
                        <Loader className="w-3 h-3 animate-spin text-blue-500" /> 
                        等待 {transaction.toUser?.name} 确认收到法币转账
                    </div>
                    <p className="text-[10px] text-blue-700 opacity-70 mt-1">
                        一旦 {transaction.toUser?.name} 确认收到法币转账，此交易将标记为完成。
                    </p>
                </div>
            );
        }
    }

    if (transaction.otcState === OTCState.COMPLETED) {
        return (
            <div className="mt-3 bg-slate-900 text-white p-3 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-2 shadow-lg">
                <Shield className="w-4 h-4 text-blue-400" /> TRADE SECURED & COMPLETED
            </div>
        )
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

          <p className="text-sm text-slate-800 mb-2.5 break-words leading-relaxed whitespace-pre-line">
            {transaction.note} {transaction.sticker && <span className="inline-block ml-1 scale-125">{transaction.sticker}</span>}
          </p>

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
            <button className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors">
              <Heart className={`w-4 h-4 ${transaction.likes > 0 ? 'fill-red-500 text-red-500' : ''}`} />
              {transaction.likes > 0 ? transaction.likes : 'Like'}
            </button>
            <button className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors">
              <MessageCircle className="w-4 h-4" />
              {transaction.comments > 0 ? transaction.comments : 'Comment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedItem;
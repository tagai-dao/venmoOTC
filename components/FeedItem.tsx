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
    // This call now triggers the AppContext logic which calls the Blockchain Service
    await updateTransaction(transaction.id, {
        otcState: OTCState.AWAITING_FIAT_PAYMENT,
        toUser: currentUser 
    });
    setIsProcessing(false);
  };

  const handlePaidAndPost = async () => {
      if (!currentUser) return;
      setIsProcessing(true);
      
      const proofUrl = file ? URL.createObjectURL(file) : undefined;
      
      // This call triggers AppContext which calls the Social Service (Reply to X)
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
      
      setIsProcessing(false);
      setShowBankDetails(false);
      setReplyText('');
      setFile(null);
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
                                  <img src={reply.proof} className="w-full h-24 object-cover border border-gray-200" alt="Payment Proof" />
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
                           <textarea 
                                placeholder="Write a reply..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-green-100 resize-none h-20"
                           />
                           <div className="flex gap-2">
                               <label className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 border-2 border-dashed rounded-xl py-3 bg-white cursor-pointer hover:bg-gray-50 transition border-gray-200">
                                   <Upload className="w-3.5 h-3.5" />
                                   <span className="truncate">{file ? file.name : "Proof"}</span>
                                   <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                               </label>
                               <button 
                                   disabled={isProcessing}
                                   onClick={handlePaidAndPost}
                                   className="flex-[1.5] bg-green-600 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50"
                               >
                                   {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                   Paid and Post {transaction.privacy === Privacy.PUBLIC_X && <Twitter className="w-3.5 h-3.5 fill-white/20" />}
                               </button>
                           </div>
                       </div>
                   </div>
                 )
             }
        }
    }

    if (transaction.otcState === OTCState.AWAITING_FIAT_PAYMENT) {
        if (isMe) {
            return (
                <div className="mt-3 bg-blue-50 p-3 rounded-xl border border-blue-100 animate-in zoom-in-95">
                    <p className="text-sm text-blue-800 mb-3 font-bold flex items-center gap-2">
                        <Check className="w-4 h-4 bg-blue-500 text-white rounded-full p-0.5" />
                        USDT Received in Escrow!
                    </p>
                    <p className="text-xs text-blue-700 mb-3 opacity-80">
                        Please pay the local currency to {transaction.toUser?.name}.
                    </p>
                    <button 
                         onClick={() => setShowBankDetails(true)}
                         className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-bold shadow-md"
                    >
                         View Payer's Bank Info
                    </button>
                    {showBankDetails && (
                        <div className="mt-3 space-y-2 animate-in slide-in-from-top-2">
                             <div className="bg-white p-3 rounded-lg border text-sm text-gray-700">
                                <p className="font-bold">Bank: {transaction.toUser?.fiatDetails?.bankName}</p>
                                <p className="opacity-70">A/C: {transaction.toUser?.fiatDetails?.accountNumber}</p>
                            </div>
                            <button 
                                onClick={() => updateTransaction(transaction.id, { otcState: OTCState.AWAITING_FIAT_CONFIRMATION })}
                                className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-bold"
                            >
                                Confirm Sent
                            </button>
                        </div>
                    )}
                </div>
            );
        } else if (isToMe) {
             return (
                <div className="mt-3 bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-sm text-indigo-900">
                    <div className="flex items-center gap-3 mb-2">
                         <div className="bg-indigo-500 text-white p-1 rounded-full"><Check className="w-4 h-4" /></div>
                         <p className="font-bold">USDT Sent to Escrow!</p>
                    </div>
                    <p className="text-xs opacity-70">Waiting for {transaction.fromUser.name} to send local currency...</p>
                </div>
             );
        }
    }

    if (transaction.otcState === OTCState.AWAITING_FIAT_CONFIRMATION) {
        const amIReceivingFiat = (transaction.currency === Currency.USDT && isToMe) || (transaction.currency !== Currency.USDT && isMe);
        const amISendingFiat = (transaction.currency === Currency.USDT && isMe) || (transaction.currency !== Currency.USDT && isToMe);

        if (amIReceivingFiat) {
            const isReleasingUSDT = (transaction.currency !== Currency.USDT);
            return (
                <div className="mt-3 bg-green-50 p-4 rounded-xl border border-green-100 animate-in bounce-in duration-500">
                    <div className="flex items-center gap-2 text-green-800 font-bold mb-3">
                         <Check className="w-4 h-4 bg-green-500 text-white rounded-full p-0.5" /> 
                         Fiat Sent to you!
                    </div>
                    <p className="text-xs text-green-700 mb-4 opacity-80">
                        A payment reply was posted. Please release USDT once you verify the funds in your bank.
                    </p>
                    <button 
                        onClick={() => updateTransaction(transaction.id, { otcState: OTCState.COMPLETED })}
                        className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-green-500/20"
                    >
                        <Shield className="w-4 h-4" /> {isReleasingUSDT ? "Release USDT" : "Finish Trade"}
                    </button>
                </div>
            )
        } else if (amISendingFiat) {
            return (
                <div className="mt-3 bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800 flex flex-col gap-2">
                    <div className="flex items-center gap-2 font-bold">
                        <Check className="w-4 h-4 bg-blue-500 text-white rounded-full p-0.5" />
                        Fiat Payment Posted
                    </div>
                    <div className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider flex items-center gap-2 border-t pt-2 border-blue-200/50">
                        <Loader className="w-3 h-3 animate-spin text-blue-500" /> 
                        Need {transaction.currency === Currency.USDT ? transaction.toUser?.name : transaction.fromUser.name} to release USDT
                    </div>
                </div>
            )
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
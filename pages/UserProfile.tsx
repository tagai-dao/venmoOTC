import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, User as UserIcon, Globe, ArrowUpRight, ArrowDownLeft, Copy, CreditCard, Wallet, Check } from 'lucide-react';
import { User, TransactionType, formatCurrency, Privacy } from '../utils';
import OTCActionModal from '../components/OTCActionModal';

interface UserProfileProps {
    user: User;
    onBack: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onBack }) => {
  const { feed } = useApp();
  const [showPayModal, setShowPayModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const userFeed = feed.filter(t => t.fromUser.id === user.id || t.toUser?.id === user.id);

  const copyAddress = () => {
      navigator.clipboard.writeText(user.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="pb-20 min-h-screen bg-gray-50">
       {/* Header */}
       <div className="bg-white px-6 pt-6 pb-6 border-b sticky top-0 z-30 shadow-sm">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-500 mb-4 hover:text-slate-900 transition">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-bold">Back</span>
          </button>

          <div className="flex items-center gap-4">
              <img src={user.avatar} alt="Profile" className="w-20 h-20 rounded-full border-4 border-white shadow-lg" />
              <div>
                  <h1 className="text-2xl font-bold">{user.name}</h1>
                  <p className="text-slate-500 text-sm">{user.handle}</p>
                  {user.isVerified && <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-bold rounded-full mt-1">Verified X Account</span>}
              </div>
          </div>
          
          {/* Wallet & Fiat Info */}
          <div className="mt-6 flex flex-col gap-2">
              <div 
                onClick={copyAddress}
                className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition active:scale-[0.99]"
              >
                  <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white">
                          <Wallet className="w-4 h-4" />
                      </div>
                      <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Wallet Address</p>
                          <p className="text-xs font-mono font-medium text-slate-700">{user.walletAddress}</p>
                      </div>
                  </div>
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
              </div>

              {user.fiatDetails && (
                  <div className="flex items-center justify-between bg-blue-50 p-3 rounded-xl border border-blue-100">
                      <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                              <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Fiat Account</p>
                              <p className="text-xs font-medium text-blue-900">{user.fiatDetails.bankName} •••• {user.fiatDetails.accountNumber.slice(-4)}</p>
                          </div>
                      </div>
                  </div>
              )}
          </div>

          <div className="flex gap-3 mt-4">
              <button 
                onClick={() => setShowPayModal(true)}
                className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm shadow-xl shadow-slate-900/20 active:scale-95 transition"
              >
                  Pay or Request
              </button>
               <button className="flex-1 bg-white border border-gray-200 text-slate-700 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 active:scale-95 transition">
                  Add Friend
              </button>
          </div>
       </div>

       {/* Feed */}
       <div className="p-4">
           <h3 className="font-bold text-lg mb-4 text-slate-900">Activity</h3>
           {userFeed.length > 0 ? (
                <div className="space-y-3">
                     {userFeed.map(t => {
                        // For a public profile view, we show direction relative to the Viewed User
                        let isOutgoing = false;
                        let otherUser = null;

                        if (t.type === TransactionType.PAYMENT) {
                            isOutgoing = t.fromUser.id === user.id;
                            otherUser = isOutgoing ? t.toUser : t.fromUser;
                        } else {
                            if (t.toUser?.id === user.id) {
                                isOutgoing = true; 
                                otherUser = t.fromUser; 
                            } else {
                                isOutgoing = false; 
                                otherUser = t.toUser; 
                            }
                        }
                        
                        return (
                          <div key={t.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-gray-50">
                               {/* Directional Icon and Avatar */}
                               <div className="relative">
                                   {otherUser ? (
                                       <img src={otherUser.avatar} className="w-11 h-11 rounded-full object-cover border border-gray-100 shadow-sm" alt={otherUser.name} />
                                   ) : (
                                       <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 border border-blue-200">
                                           <Globe className="w-5 h-5" />
                                       </div>
                                   )}
                                   <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-white shadow-sm
                                       ${isOutgoing ? 'bg-black' : 'bg-green-500'}`}>
                                       {isOutgoing ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                                   </div>
                               </div>

                               {/* Transaction Info */}
                               <div className="flex-1 min-w-0">
                                   <div className="flex justify-between items-start">
                                       <span className="font-bold text-sm text-slate-900 truncate mt-0.5">
                                           {otherUser ? (
                                               <>
                                                 <span className={`text-xs font-normal mr-1 ${isOutgoing ? 'text-gray-400' : 'text-green-600'}`}>
                                                     {isOutgoing ? 'To' : 'From'}
                                                 </span>
                                                 {otherUser.name}
                                               </>
                                           ) : (
                                               <span className="text-gray-500">
                                                   {t.privacy === Privacy.PUBLIC ? 'Public Request' : 'Friends Request'}
                                               </span>
                                           )}
                                       </span>
                                       
                                       <div className="flex flex-col items-end ml-2">
                                           <span className={`font-bold text-sm whitespace-nowrap ${isOutgoing ? 'text-slate-900' : 'text-green-600'}`}>
                                               {isOutgoing ? '-' : '+'}{formatCurrency(t.amount, t.currency)}
                                           </span>
                                           {t.isOTC && t.otcOfferAmount && t.otcFiatCurrency && (
                                               <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap">
                                                   {isOutgoing ? 'Get' : 'Give'} {formatCurrency(t.otcOfferAmount, t.otcFiatCurrency)}
                                               </span>
                                           )}
                                       </div>
                                   </div>
                                   <div className="flex justify-between items-center">
                                       <span className="text-xs text-gray-400 truncate max-w-[140px] italic">
                                           {t.note}
                                       </span>
                                       <span className="text-[10px] text-gray-300 font-medium">
                                           {new Date(t.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                       </span>
                                   </div>
                               </div>
                          </div>
                        );
                     })}
                </div>
           ) : (
               <div className="text-center text-gray-400 py-10 bg-white rounded-2xl border-2 border-dashed border-gray-100">
                   <p className="text-sm font-medium">No public activity</p>
               </div>
           )}
       </div>

       {showPayModal && (
           <OTCActionModal 
                onClose={() => setShowPayModal(false)} 
                initialUser={user}
           />
       )}
    </div>
  );
};

export default UserProfile;
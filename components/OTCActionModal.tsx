import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { User, Currency, Privacy, TransactionType, OTCState, FRIENDS, generateId } from '../utils';
import { X, Search, Globe, Users, Lock, ArrowDown, ChevronLeft, Twitter, Loader } from 'lucide-react';

interface Props {
  onClose: () => void;
  initialType?: TransactionType;
  initialUser?: User | null;
}

const STICKERS = ['🍕', '☕️', '🎵', '🚗', '🍔', '🎁', '💡', '✈️'];

// Mock Exchange Rates (1 USDT = X Fiat)
const EXCHANGE_RATES: Record<string, number> = {
    [Currency.NGN]: 1650.00,
    [Currency.VES]: 45.50,
    [Currency.USD]: 1.00
};

const OTCActionModal: React.FC<Props> = ({ onClose, initialType = TransactionType.REQUEST, initialUser = null }) => {
  const { addTransaction, currentUser } = useApp();
  const [step, setStep] = useState(initialUser ? 2 : 1);
  const [selectedUser, setSelectedUser] = useState<User | null>(initialUser);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>(Currency.USDT);
  const [note, setNote] = useState('');
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<Privacy>(initialType === TransactionType.REQUEST ? Privacy.PUBLIC : Privacy.PUBLIC);
  const [otcTargetCurrency, setOtcTargetCurrency] = useState<Currency>(Currency.NGN);
  const [transactionType, setTransactionType] = useState<TransactionType>(initialType);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Direction: True = USDT -> Fiat (Selling USDT), False = Fiat -> USDT (Buying USDT)
  const [isUSDTSource, setIsUSDTSource] = useState(true);

  // Calculate the Target Amount based on Exchange Rate
  const convertedAmount = useMemo(() => {
      const numAmount = parseFloat(amount);
      if (!amount || isNaN(numAmount)) return '';

      const rate = EXCHANGE_RATES[otcTargetCurrency] || 1;
      
      if (isUSDTSource) {
          // Input: USDT (Offer) -> Output: Fiat (Request)
          return (numAmount * rate).toFixed(2);
      } else {
          // Input: Fiat (Offer) -> Output: USDT (Request)
          return (numAmount / rate).toFixed(2);
      }
  }, [amount, otcTargetCurrency, isUSDTSource]);

  const handleSend = async () => {
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) return;

    setIsSubmitting(true);

    const isOTC = transactionType === TransactionType.REQUEST;
    const rate = EXCHANGE_RATES[otcTargetCurrency] || 1;
    
    let finalAmount = numAmount;
    let finalCurrency = transactionType === TransactionType.PAYMENT ? Currency.USDT : currency;
    let finalOtcFiat = otcTargetCurrency;
    let finalOtcOfferAmount = 0;

    if (isOTC) {
        if (isUSDTSource) {
             // Offer USDT, Request Fiat. 
             finalAmount = numAmount * rate; // Request Amount (Fiat)
             finalCurrency = otcTargetCurrency;
             finalOtcFiat = Currency.USDT; // Counter Currency
             finalOtcOfferAmount = numAmount; // Offer Amount (USDT)
        } else {
             // Offer Fiat, Request USDT. 
             finalAmount = numAmount / rate; // Request Amount (USDT)
             finalCurrency = Currency.USDT;
             finalOtcFiat = otcTargetCurrency; // Counter Currency
             finalOtcOfferAmount = numAmount; // Offer Amount (Fiat)
        }
    }

    let finalNote = note;
    if (isOTC) {
        const directionTag = isUSDTSource 
            ? ` #${Currency.USDT}_to_${otcTargetCurrency}` 
            : ` #${otcTargetCurrency}_to_${Currency.USDT}`;
        
        const rateDisplay = `(@ ${rate})`;
        finalNote = `${note.trim()}${directionTag} ${rateDisplay}`;
    }

    await addTransaction({
      id: generateId(),
      fromUser: currentUser,
      toUser: selectedUser,
      amount: finalAmount,
      currency: finalCurrency,
      note: finalNote,
      sticker: selectedSticker || undefined,
      timestamp: Date.now(),
      privacy: privacy,
      type: transactionType,
      isOTC: isOTC,
      otcState: isOTC ? OTCState.OPEN_REQUEST : OTCState.NONE,
      otcFiatCurrency: isOTC ? finalOtcFiat : undefined,
      otcOfferAmount: isOTC ? finalOtcOfferAmount : undefined,
      likes: 0,
      comments: 0
    });
    
    setIsSubmitting(false);
    onClose();
  };

  const renderRecipientSelect = () => (
    <div className="h-full flex flex-col">
       <div className="px-4 py-3 border-b flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input 
            placeholder="Name, @username, email..." 
            className="flex-1 bg-transparent outline-none text-lg"
            autoFocus
          />
       </div>
       <div className="flex-1 overflow-y-auto pb-20">
         {/* Request Flow: Specialized broad options */}
         {transactionType === TransactionType.REQUEST ? (
             <div className="divide-y border-b">
                 <button 
                    onClick={() => { setSelectedUser(null); setPrivacy(Privacy.PUBLIC_X); setStep(2); }}
                    className="w-full px-4 py-5 flex items-center gap-4 hover:bg-gray-50 transition text-left group"
                 >
                    <div className="w-14 h-14 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 group-hover:scale-105 transition-transform">
                        <Twitter className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-900 text-lg">Public on X</p>
                        <p className="text-sm text-slate-500">Post request to your X timeline</p>
                    </div>
                 </button>
                 <button 
                    onClick={() => { setSelectedUser(null); setPrivacy(Privacy.PUBLIC); setStep(2); }}
                    className="w-full px-4 py-5 flex items-center gap-4 hover:bg-gray-50 transition text-left group"
                 >
                    <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                        <Globe className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-900 text-lg">Public within the app</p>
                        <p className="text-sm text-slate-500">Post to the community feed</p>
                    </div>
                 </button>
                 <button 
                    onClick={() => { setSelectedUser(null); setPrivacy(Privacy.FRIENDS); setStep(2); }}
                    className="w-full px-4 py-5 flex items-center gap-4 hover:bg-gray-50 transition text-left group"
                 >
                    <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
                        <Users className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-900 text-lg">Friends ONLY</p>
                        <p className="text-sm text-slate-500">Only visible to your friends</p>
                    </div>
                 </button>
             </div>
         ) : (
            <>
                <p className="px-4 py-2 text-xs font-bold text-gray-500 uppercase mt-2">Top People</p>
                {FRIENDS.map(f => (
                <button 
                    key={f.id} 
                    onClick={() => { setSelectedUser(f); setStep(2); }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition"
                >
                    <img src={f.avatar} alt={f.name} className="w-12 h-12 rounded-full object-cover" />
                    <div className="text-left">
                    <p className="font-bold text-slate-900">{f.name}</p>
                    <p className="text-sm text-slate-500">{f.handle}</p>
                    </div>
                </button>
                ))}
            </>
         )}
       </div>
    </div>
  );

  const renderAmountEntry = () => (
    <div className="h-full flex flex-col p-6 overflow-y-auto no-scrollbar pb-32">
      {/* Recipient Indicator */}
      <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setStep(1)} className="p-1 hover:bg-gray-100 rounded-full">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border">
             {selectedUser ? (
                <>
                  <img src={selectedUser.avatar} className="w-6 h-6 rounded-full" />
                  <span className="text-sm font-bold">{selectedUser.name}</span>
                </>
             ) : (
                <>
                  {privacy === Privacy.PUBLIC_X ? (
                    <Twitter className="w-4 h-4 text-sky-500" />
                  ) : privacy === Privacy.PUBLIC ? (
                    <Globe className="w-4 h-4 text-blue-500" />
                  ) : (
                    <Users className="w-4 h-4 text-indigo-500" />
                  )}
                  <span className="text-sm font-bold">
                    {privacy === Privacy.PUBLIC_X ? 'Public on X' : privacy === Privacy.PUBLIC ? 'Public within app' : 'Friends'}
                  </span>
                </>
             )}
          </div>
      </div>

      {/* Dynamic Header / Amount Display */}
      {transactionType === TransactionType.PAYMENT ? (
          <div className="flex flex-col items-center mb-8">
             <div className="flex items-center justify-center gap-2">
                <span className="text-4xl font-bold">₮</span>
                <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="text-6xl font-bold w-40 text-center outline-none bg-transparent placeholder-gray-200"
                    autoFocus
                />
             </div>
             <p className="text-sm text-gray-400 mt-2">Balance: {Currency.USDT} 1,250.50</p>
          </div>
      ) : (
          /* UNISWAP STYLE OTC INTERFACE */
          <div className="mb-6 relative">
              {/* Top Box (Source) */}
              <div className="bg-gray-100 rounded-2xl p-4 pb-8 transition-colors hover:bg-gray-200/70">
                  <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-gray-500">You Pay (Offer)</span>
                  </div>
                  <div className="flex justify-between items-center">
                      <input 
                          type="number" 
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0"
                          className="bg-transparent text-3xl font-bold outline-none w-1/2 placeholder-gray-400"
                          autoFocus
                      />
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm">
                          {isUSDTSource ? (
                               <span className="font-bold text-sm">₮ {Currency.USDT}</span>
                          ) : (
                               <select 
                                  value={otcTargetCurrency}
                                  onChange={(e) => setOtcTargetCurrency(e.target.value as Currency)}
                                  className="font-bold text-sm bg-transparent outline-none appearance-none pr-2"
                               >
                                  <option value={Currency.NGN}>NGN</option>
                                  <option value={Currency.VES}>VES</option>
                                  <option value={Currency.USD}>USD</option>
                               </select>
                          )}
                      </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-400 pl-1">
                      Balance: {isUSDTSource ? '1,250.50 ₮' : '50,000 Local'}
                  </div>
              </div>

              {/* Arrow Toggle */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <button 
                    onClick={() => setIsUSDTSource(!isUSDTSource)}
                    className="bg-white p-2 rounded-xl border-4 border-white shadow-sm hover:bg-gray-50 transition active:scale-95"
                  >
                      <ArrowDown className="w-5 h-5 text-gray-600" />
                  </button>
              </div>

              {/* Bottom Box (Target) */}
              <div className="bg-gray-100 rounded-2xl p-4 pt-8 mt-1 transition-colors hover:bg-gray-200/70">
                  <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-gray-500">You Receive (Request)</span>
                  </div>
                  <div className="flex justify-between items-center">
                      <input 
                          type="text" 
                          value={convertedAmount}
                          readOnly
                          placeholder="0.00"
                          className="bg-transparent text-3xl font-bold outline-none w-1/2 text-gray-500 cursor-default"
                      />
                       <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm">
                          {!isUSDTSource ? (
                               <span className="font-bold text-sm">₮ {Currency.USDT}</span>
                          ) : (
                               <select 
                                  value={otcTargetCurrency}
                                  onChange={(e) => setOtcTargetCurrency(e.target.value as Currency)}
                                  className="font-bold text-sm bg-transparent outline-none appearance-none pr-2"
                               >
                                  <option value={Currency.NGN}>NGN</option>
                                  <option value={Currency.VES}>VES</option>
                                  <option value={Currency.USD}>USD</option>
                               </select>
                          )}
                      </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-400 pl-1">
                      Rate: 1 USDT ≈ {EXCHANGE_RATES[otcTargetCurrency]} {otcTargetCurrency}
                  </div>
              </div>
          </div>
      )}

      <div className="space-y-6 flex-1">
        <textarea 
            placeholder={transactionType === TransactionType.REQUEST ? "Describe payment method preference..." : "What's this for?"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-gray-100 rounded-2xl p-4 outline-none resize-none h-24 focus:ring-2 focus:ring-blue-100 transition text-sm"
        />

        <div>
            <p className="text-xs font-bold text-gray-400 uppercase mb-3 ml-1">Stickers</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {STICKERS.map(s => (
                    <button
                        key={s}
                        onClick={() => setSelectedSticker(selectedSticker === s ? null : s)}
                        className={`text-2xl p-3 rounded-xl border-2 transition-all flex-shrink-0
                            ${selectedSticker === s ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}
                    >
                        {s}
                    </button>
                ))}
            </div>
        </div>

        <div>
            <p className="text-xs font-bold text-gray-400 uppercase mb-3 ml-1">Privacy</p>
            <div className={`grid ${transactionType === TransactionType.REQUEST ? 'grid-cols-3' : 'grid-cols-3'} gap-2`}>
                {transactionType === TransactionType.REQUEST ? (
                    <>
                        <button 
                            onClick={() => setPrivacy(Privacy.PUBLIC_X)}
                            className={`flex flex-col items-center justify-center gap-1 p-2 h-16 rounded-2xl border-2 transition-all
                                ${privacy === Privacy.PUBLIC_X ? 'border-sky-500 bg-sky-50 text-sky-600' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}`}
                        >
                            <Twitter className="w-4 h-4" />
                            <span className="text-[9px] font-bold text-center leading-tight">Public on X</span>
                        </button>
                        <button 
                            onClick={() => setPrivacy(Privacy.PUBLIC)}
                            className={`flex flex-col items-center justify-center gap-1 p-2 h-16 rounded-2xl border-2 transition-all
                                ${privacy === Privacy.PUBLIC ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}`}
                        >
                            <Globe className="w-4 h-4" />
                            <span className="text-[9px] font-bold text-center leading-tight">Public in App</span>
                        </button>
                        <button 
                            onClick={() => setPrivacy(Privacy.FRIENDS)}
                            className={`flex flex-col items-center justify-center gap-1 p-2 h-16 rounded-2xl border-2 transition-all
                                ${privacy === Privacy.FRIENDS ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}`}
                        >
                            <Users className="w-4 h-4" />
                            <span className="text-[9px] font-bold text-center leading-tight">Friends</span>
                        </button>
                    </>
                ) : (
                    <>
                        <button 
                            onClick={() => setPrivacy(Privacy.PUBLIC)}
                            className={`flex flex-col items-center justify-center gap-1 p-2 h-16 rounded-2xl border-2 transition-all
                                ${privacy === Privacy.PUBLIC ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}`}
                        >
                            <Globe className="w-5 h-5" />
                            <span className="text-[10px] font-bold">Public</span>
                        </button>
                        <button 
                            onClick={() => setPrivacy(Privacy.FRIENDS)}
                            className={`flex flex-col items-center justify-center gap-1 p-2 h-16 rounded-2xl border-2 transition-all
                                ${privacy === Privacy.FRIENDS ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}`}
                        >
                            <Users className="w-5 h-5" />
                            <span className="text-[10px] font-bold">Friends</span>
                        </button>
                        <button 
                            onClick={() => setPrivacy(Privacy.PRIVATE)}
                            className={`flex flex-col items-center justify-center gap-1 p-2 h-16 rounded-2xl border-2 transition-all
                                ${privacy === Privacy.PRIVATE ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}`}
                        >
                            <Lock className="w-5 h-5" />
                            <span className="text-[10px] font-bold">Private</span>
                        </button>
                    </>
                )}
            </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t max-w-md mx-auto z-20">
        <button 
            disabled={!amount || isSubmitting}
            onClick={handleSend}
            className="w-full bg-blue-500 text-white py-4 rounded-2xl font-bold shadow-xl shadow-blue-500/30 disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all text-lg flex items-center justify-center gap-2"
        >
            {isSubmitting && <Loader className="w-5 h-5 animate-spin" />}
            {transactionType === TransactionType.PAYMENT ? 'Pay' : 'Request'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white w-full h-[90vh] sm:h-[600px] sm:w-[400px] sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden relative animate-in slide-in-from-bottom-10 duration-300">
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b">
           {step === 1 ? (
             <div className="flex gap-4 text-sm font-bold">
                <button 
                  onClick={() => setTransactionType(TransactionType.REQUEST)}
                  className={`pb-2 border-b-2 transition-colors ${transactionType === TransactionType.REQUEST ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
                >
                  Request
                </button>
                <button 
                  onClick={() => setTransactionType(TransactionType.PAYMENT)}
                  className={`pb-2 border-b-2 transition-colors ${transactionType === TransactionType.PAYMENT ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
                >
                  Pay
                </button>
             </div>
           ) : (
             <button onClick={() => setStep(1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
                <ChevronLeft className="w-6 h-6" />
             </button>
           )}
           
           <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
             <X className="w-6 h-6 text-gray-500" />
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
            {step === 1 ? renderRecipientSelect() : renderAmountEntry()}
        </div>
      </div>
    </div>
  );
};

export default OTCActionModal;
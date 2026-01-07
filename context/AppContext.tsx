import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Transaction, MOCK_USER, FRIENDS, INITIAL_FEED, TransactionType, OTCState, Currency, Privacy, generateId, TransactionReply } from '../utils';
import { Services } from '../services';

interface AppContextType {
  currentUser: User;
  friends: User[];
  feed: Transaction[];
  isAuthenticated: boolean;
  walletBalance: { [key in Currency]: number };
  login: () => void;
  logout: () => void;
  addTransaction: (t: Transaction) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Transaction> & { newReply?: TransactionReply }) => Promise<void>;
  setCurrentUser: (u: User) => void;
  isReady: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USER);
  const [feed, setFeed] = useState<Transaction[]>(INITIAL_FEED);
  const [friends] = useState<User[]>(FRIENDS);
  const [walletBalance, setWalletBalance] = useState({
    [Currency.USDT]: 0,
    [Currency.NGN]: 0,
    [Currency.VES]: 0,
    [Currency.USD]: 0
  });

  // Fetch balances using The Graph simulation when auth changes
  useEffect(() => {
      if (isAuthenticated) {
          const fetchBalances = async () => {
              const usdt = await Services.blockchain.getBalance(currentUser.walletAddress, Currency.USDT);
              const ngn = await Services.blockchain.getBalance(currentUser.walletAddress, Currency.NGN);
              setWalletBalance(prev => ({ ...prev, [Currency.USDT]: usdt, [Currency.NGN]: ngn }));
          };
          fetchBalances();
      }
  }, [isAuthenticated, currentUser.walletAddress]);

  const login = async () => {
      // Use Privy Service
      const user = await Services.auth.loginWithX();
      setCurrentUser(user);
      setIsAuthenticated(true);
  };

  const logout = () => {
      Services.auth.logout();
      setIsAuthenticated(false);
  };

  const addTransaction = async (t: Transaction) => {
    // 1. If it's Public on X, Post to X first
    if (t.privacy === Privacy.PUBLIC_X && t.type === TransactionType.REQUEST) {
        const tweetContent = `Requesting ${t.isOTC ? `${t.amount} ${t.currency} for ${t.otcOfferAmount} ${t.otcFiatCurrency}` : `${t.amount} ${t.currency}`} on VenmoOTC! #DeFi #OTC`;
        const tweetId = await Services.social.postTweet(tweetContent);
        t.xPostId = tweetId;
    }

    // 2. Add to Local State
    setFeed((prev) => [t, ...prev]);
    
    // 3. If it's a direct payment, simulate blockchain deduction (Request logic handled in update)
    if (t.type === TransactionType.PAYMENT && t.fromUser.id === currentUser.id) {
       // Note: In real app, we would wait for tx confirmation here
       setWalletBalance(prev => ({
           ...prev,
           [t.currency]: prev[t.currency] - t.amount
       }));
    }
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction> & { newReply?: TransactionReply }) => {
    // Handling updates requires finding the transaction first to check context
    const tx = feed.find(t => t.id === id);
    if (!tx) return;

    // 1. Blockchain Payment Logic (Pay USDT)
    if (updates.otcState === OTCState.AWAITING_FIAT_PAYMENT && tx.otcState === OTCState.OPEN_REQUEST) {
        const payer = updates.toUser || tx.toUser;
        if (payer?.id === currentUser.id && tx.currency === Currency.USDT) {
            // Call BNB Chain Service
            await Services.blockchain.sendUSDT(tx.fromUser.walletAddress, tx.amount);
            setWalletBalance(b => ({ ...b, [Currency.USDT]: b[Currency.USDT] - tx.amount }));
        }
    }

    // 2. Social Logic (Reply on X)
    if (updates.newReply && tx.privacy === Privacy.PUBLIC_X && tx.xPostId) {
        const replyContent = updates.newReply.text;
        await Services.social.replyToTweet(tx.xPostId, replyContent);
    }

    // 3. State Update
    setFeed((prev) => {
      return prev.map(t => {
        if (t.id === id) {
          const { newReply, ...otherUpdates } = updates;

          // Logic for releasing escrow (USDT)
          if (updates.otcState === OTCState.COMPLETED && t.otcState !== OTCState.COMPLETED) {
             const requesterId = t.fromUser.id;
             if (t.currency !== Currency.USDT) {
                 if (requesterId === currentUser.id) {
                     // Requester releases USDT now
                     // In production: await Services.blockchain.releaseEscrow(...)
                     const amountToDeduct = t.otcOfferAmount || 0;
                     setWalletBalance(b => ({ ...b, [Currency.USDT]: b[Currency.USDT] - amountToDeduct }));
                 }
             }
          }

          const currentReplies = t.replies || [];
          const updatedReplies = newReply ? [...currentReplies, newReply] : currentReplies;
          const updatedComments = newReply ? (t.comments + 1) : (otherUpdates.comments ?? t.comments);

          return { 
            ...t, 
            ...otherUpdates, 
            replies: updatedReplies,
            comments: updatedComments
          };
        }
        return t;
      });
    });
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      friends,
      feed,
      isAuthenticated, 
      walletBalance,
      login, 
      logout,
      addTransaction,
      updateTransaction,
      setCurrentUser,
      isReady: true
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
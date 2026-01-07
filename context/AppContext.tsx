import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Transaction, TransactionType, OTCState, Currency, Privacy, TransactionReply } from '../utils';
import { Services } from '../services';

interface AppContextType {
  currentUser: User | null;
  friends: User[];
  feed: Transaction[];
  isAuthenticated: boolean;
  walletBalance: { [key in Currency]: number };
  login: (xHandle?: string) => Promise<void>;
  logout: () => Promise<void>;
  addTransaction: (t: Omit<Transaction, 'id' | 'timestamp'>) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Transaction> & { newReply?: TransactionReply }) => Promise<void>;
  setCurrentUser: (u: User) => void;
  isReady: boolean;
  refreshFeed: () => Promise<void>;
  refreshFriends: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [feed, setFeed] = useState<Transaction[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [walletBalance, setWalletBalance] = useState({
    [Currency.USDT]: 0,
    [Currency.NGN]: 0,
    [Currency.VES]: 0,
    [Currency.USD]: 0
  });

  // 获取交易列表
  const refreshFeed = async () => {
    try {
      const transactions = await Services.transactions.getTransactions();
      setFeed(transactions);
    } catch (error) {
      console.error('Failed to fetch feed:', error);
    }
  };

  // 获取用户列表
  const refreshFriends = async () => {
    try {
      const users = await Services.users.getUsers();
      setFriends(users);
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    }
  };

  // 初始化：获取 feed 和用户列表
  useEffect(() => {
    const initialize = async () => {
      try {
        await Promise.all([refreshFeed(), refreshFriends()]);
      } catch (error) {
        console.error('Failed to initialize:', error);
      } finally {
        setIsReady(true);
      }
    };
    initialize();
  }, []);

  // 当认证状态改变时，获取余额
  useEffect(() => {
      if (isAuthenticated && currentUser) {
          const fetchBalances = async () => {
              try {
                  const usdt = await Services.blockchain.getBalance(currentUser.walletAddress, Currency.USDT);
                  const ngn = await Services.blockchain.getBalance(currentUser.walletAddress, Currency.NGN);
                  setWalletBalance(prev => ({ ...prev, [Currency.USDT]: usdt, [Currency.NGN]: ngn }));
              } catch (error) {
                  console.error('Failed to fetch balances:', error);
              }
          };
          fetchBalances();
      }
  }, [isAuthenticated, currentUser?.walletAddress]);

  const login = async (xHandle?: string) => {
      try {
          const user = await Services.auth.loginWithX(xHandle);
          setCurrentUser(user);
          setIsAuthenticated(true);
          // 登录后刷新 feed
          await refreshFeed();
      } catch (error) {
          console.error('Login failed:', error);
          throw error;
      }
  };

  const logout = async () => {
      try {
          await Services.auth.logout();
      } catch (error) {
          console.error('Logout error:', error);
      } finally {
          setIsAuthenticated(false);
          setCurrentUser(null);
      }
  };

  const addTransaction = async (t: Omit<Transaction, 'id' | 'timestamp'>) => {
    try {
      // 1. If it's Public on X, Post to X first
      let xPostId: string | undefined;
      if (t.privacy === Privacy.PUBLIC_X && t.type === TransactionType.REQUEST) {
          const tweetContent = `Requesting ${t.isOTC ? `${t.amount} ${t.currency} for ${t.otcOfferAmount} ${t.otcFiatCurrency}` : `${t.amount} ${t.currency}`} on VenmoOTC! #DeFi #OTC`;
          xPostId = await Services.social.postTweet(tweetContent);
      }

      // 2. Create transaction via API
      const newTransaction = await Services.transactions.createTransaction({
        ...t,
        xPostId,
      });

      // 3. Update local state
      setFeed((prev) => [newTransaction, ...prev]);
      
      // 4. If it's a direct payment, update balance (Request logic handled in update)
      if (t.type === TransactionType.PAYMENT && t.fromUser.id === currentUser?.id) {
         setWalletBalance(prev => ({
             ...prev,
             [t.currency]: prev[t.currency] - t.amount
         }));
      }
    } catch (error) {
      console.error('Failed to add transaction:', error);
      throw error;
    }
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction> & { newReply?: TransactionReply }) => {
    try {
      // Handling updates requires finding the transaction first to check context
      const tx = feed.find(t => t.id === id);
      if (!tx) {
        console.error('Transaction not found:', id);
        return;
      }

      // 1. Blockchain Payment Logic (Pay USDT)
      if (updates.otcState === OTCState.AWAITING_FIAT_PAYMENT && tx.otcState === OTCState.OPEN_REQUEST) {
          const payer = updates.toUser || tx.toUser;
          if (payer?.id === currentUser?.id && tx.currency === Currency.USDT && currentUser) {
              // Call BNB Chain Service
              await Services.blockchain.sendUSDT(tx.fromUser.walletAddress, tx.amount, currentUser.walletAddress);
              setWalletBalance(b => ({ ...b, [Currency.USDT]: b[Currency.USDT] - tx.amount }));
          }
      }

      // 2. Social Logic (Reply on X)
      if (updates.newReply && tx.privacy === Privacy.PUBLIC_X && tx.xPostId) {
          const replyContent = updates.newReply.text;
          await Services.social.replyToTweet(tx.xPostId, replyContent);
      }

      // 3. Update transaction via API
      const updatedTransaction = await Services.transactions.updateTransaction(id, updates);

      // 4. Update local state
      setFeed((prev) => {
        return prev.map(t => {
          if (t.id === id) {
            // Logic for releasing escrow (USDT)
            if (updates.otcState === OTCState.COMPLETED && t.otcState !== OTCState.COMPLETED) {
               const requesterId = t.fromUser.id;
               if (t.currency !== Currency.USDT) {
                   if (requesterId === currentUser?.id) {
                       // Requester releases USDT now
                       const amountToDeduct = t.otcOfferAmount || 0;
                       setWalletBalance(b => ({ ...b, [Currency.USDT]: b[Currency.USDT] - amountToDeduct }));
                   }
               }
            }
            return updatedTransaction;
          }
          return t;
        });
      });
    } catch (error) {
      console.error('Failed to update transaction:', error);
      throw error;
    }
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
      isReady,
      refreshFeed,
      refreshFriends
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
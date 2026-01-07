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
      // 验证：支付时不能给自己转账
      if (t.type === TransactionType.PAYMENT && t.toUser && t.fromUser.id === t.toUser.id) {
        throw new Error('不能给自己转账，请选择其他收款人');
      }

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
      // 0. 找到当前交易上下文
      const tx = feed.find(t => t.id === id);
      if (!tx) {
        console.error('Transaction not found in local state:', id);
        return;
      }

      let activityTransaction: Transaction | null = null;

      // 1. 区块链逻辑 + 生成第一笔支付的 Activity（仅创建一次，避免重复）
      // 情况 1：USDT Request - 支付 USDT（从 OPEN_REQUEST -> AWAITING_FIAT_PAYMENT）
      if (updates.otcState === OTCState.AWAITING_FIAT_PAYMENT && tx.otcState === OTCState.OPEN_REQUEST) {
        const payer = updates.toUser || tx.toUser;
        if (payer?.id === currentUser?.id && currentUser) {
          // 检查是否已经存在相关的 Activity 记录，避免重复创建
          const existingActivity = feed.find(
            t => t.relatedTransactionId === tx.id && 
                 t.type === TransactionType.PAYMENT &&
                 ((tx.currency === Currency.USDT && t.currency === Currency.USDT && t.fromUser.id === currentUser.id && t.toUser?.id === tx.fromUser.id) ||
                  (tx.currency !== Currency.USDT && t.currency === tx.currency && t.fromUser.id === currentUser.id && t.toUser?.id === tx.fromUser.id))
          );

          if (!existingActivity) {
            if (tx.currency === Currency.USDT) {
              // 1.1 直接从当前用户打 USDT 给请求者
              await Services.blockchain.sendUSDT(tx.fromUser.walletAddress, tx.amount, currentUser.walletAddress);
              setWalletBalance(b => ({ ...b, [Currency.USDT]: b[Currency.USDT] - tx.amount }));

              // 1.2 记录一条 USDT Payment 的 Activity（双方 Your Activity 均可看到）
              try {
                const activityPayload: Omit<Transaction, 'id' | 'timestamp'> = {
                  fromUser: currentUser,
                  toUser: tx.fromUser,
                  amount: tx.amount,
                  currency: Currency.USDT,
                  note: tx.note ? `${tx.note} (USDT payment)` : 'USDT payment for request',
                  sticker: tx.sticker,
                  privacy: tx.privacy,
                  type: TransactionType.PAYMENT,
                  isOTC: tx.isOTC,
                  otcState: OTCState.NONE,
                  otcFiatCurrency: tx.otcFiatCurrency,
                  otcOfferAmount: tx.otcOfferAmount,
                  likes: 0,
                  comments: 0,
                  replies: [],
                  xPostId: tx.xPostId,
                  relatedTransactionId: tx.id,
                };
                activityTransaction = await Services.transactions.createTransaction(activityPayload);
              } catch (e) {
                console.warn('Failed to create USDT payment activity transaction:', e);
              }
            } else {
              // 情况 2：法币 Request - 支付法币（Off-chain Fiat Payment）
              // 在 Your Activity 中也记录一条法币 Payment
              if (tx.fromUser && currentUser && tx.amount > 0) {
                try {
                  const activityPayload: Omit<Transaction, 'id' | 'timestamp'> = {
                    fromUser: currentUser,
                    toUser: tx.fromUser,
                    amount: tx.amount,
                    currency: tx.currency,
                    note: tx.note ? `${tx.note} (Fiat payment)` : 'Fiat payment for OTC request',
                    sticker: tx.sticker,
                    privacy: tx.privacy,
                    type: TransactionType.PAYMENT,
                    isOTC: tx.isOTC,
                    otcState: OTCState.NONE,
                    otcFiatCurrency: tx.otcFiatCurrency,
                    otcOfferAmount: tx.otcOfferAmount,
                    likes: 0,
                    comments: 0,
                    replies: [],
                    xPostId: tx.xPostId,
                    relatedTransactionId: tx.id,
                  };
                  activityTransaction = await Services.transactions.createTransaction(activityPayload);
                } catch (e) {
                  console.warn('Failed to create fiat payment activity transaction:', e);
                }
              }
            }
          } else {
            console.log('Activity record already exists for this payment, skipping duplicate creation');
          }
        }
      }
      
      // 情况 3：法币 Request - 支付 USDT（从 AWAITING_FIAT_PAYMENT -> COMPLETED）
      if (updates.otcState === OTCState.COMPLETED && tx.otcState === OTCState.AWAITING_FIAT_PAYMENT) {
        const isFiatRequest = tx.currency !== Currency.USDT;
        if (isFiatRequest && tx.fromUser.id === currentUser?.id && currentUser && tx.toUser) {
          const usdtAmount = tx.otcOfferAmount || 0;
          if (usdtAmount > 0) {
            // 检查是否已经存在相关的 USDT Payment Activity 记录
            const existingActivity = feed.find(
              t => t.relatedTransactionId === tx.id && 
                   t.type === TransactionType.PAYMENT &&
                   t.currency === Currency.USDT &&
                   t.fromUser.id === currentUser.id &&
                   t.toUser?.id === tx.toUser.id &&
                   t.amount === usdtAmount
            );

            if (!existingActivity) {
              // 3.1 区块链打 USDT
              await Services.blockchain.sendUSDT(tx.toUser.walletAddress, usdtAmount, currentUser.walletAddress);
              setWalletBalance(b => ({ ...b, [Currency.USDT]: b[Currency.USDT] - usdtAmount }));

              // 3.2 记录一条 USDT Payment 的 Activity
              try {
                const activityPayload: Omit<Transaction, 'id' | 'timestamp'> = {
                  fromUser: currentUser,
                  toUser: tx.toUser,
                  amount: usdtAmount,
                  currency: Currency.USDT,
                  note: tx.note ? `${tx.note} (USDT release)` : 'USDT payment for fiat OTC',
                  sticker: tx.sticker,
                  privacy: tx.privacy,
                  type: TransactionType.PAYMENT,
                  isOTC: tx.isOTC,
                  otcState: OTCState.COMPLETED,
                  otcFiatCurrency: tx.currency,
                  otcOfferAmount: tx.amount,
                  likes: 0,
                  comments: 0,
                  replies: [],
                  xPostId: tx.xPostId,
                  relatedTransactionId: tx.id,
                };
                activityTransaction = await Services.transactions.createTransaction(activityPayload);
              } catch (e) {
                console.warn('Failed to create USDT payment activity transaction (fiat request):', e);
              }
            } else {
              console.log('USDT payment activity record already exists for this transaction, skipping duplicate creation');
            }
          }
        }
      }

      // 情况 4：USDT Request - 支付法币（从 AWAITING_FIAT_PAYMENT -> AWAITING_FIAT_CONFIRMATION）
      if (updates.otcState === OTCState.AWAITING_FIAT_CONFIRMATION && tx.otcState === OTCState.AWAITING_FIAT_PAYMENT && tx.currency === Currency.USDT) {
        if (tx.otcFiatCurrency && tx.otcOfferAmount && tx.toUser && tx.fromUser) {
          // 检查是否已经存在相关的法币 Payment Activity 记录
          const existingActivity = feed.find(
            t => t.relatedTransactionId === tx.id && 
                 t.type === TransactionType.PAYMENT &&
                 t.currency === tx.otcFiatCurrency &&
                 t.fromUser.id === tx.fromUser.id &&
                 t.toUser?.id === tx.toUser.id &&
                 t.amount === tx.otcOfferAmount
          );

          if (!existingActivity) {
            // 在 Activity 中记录一条法币 Payment：从 Request 发起人 -> 支付 USDT 的人
            const fiatAmount = tx.otcOfferAmount;
            const fiatCurrency = tx.otcFiatCurrency;
            try {
              const activityPayload: Omit<Transaction, 'id' | 'timestamp'> = {
                fromUser: tx.fromUser,
                toUser: tx.toUser,
                amount: fiatAmount,
                currency: fiatCurrency,
                note: tx.note ? `${tx.note} (Fiat payment)` : 'Fiat payment for USDT OTC',
                sticker: tx.sticker,
                privacy: tx.privacy,
                type: TransactionType.PAYMENT,
                isOTC: tx.isOTC,
                otcState: OTCState.NONE,
                otcFiatCurrency: tx.otcFiatCurrency,
                otcOfferAmount: tx.otcOfferAmount,
                likes: 0,
                comments: 0,
                replies: [],
                xPostId: tx.xPostId,
                relatedTransactionId: tx.id,
              };
              activityTransaction = await Services.transactions.createTransaction(activityPayload);
            } catch (e) {
              console.warn('Failed to create fiat payment activity transaction (USDT request):', e);
            }
          } else {
            console.log('Fiat payment activity record already exists for this transaction, skipping duplicate creation');
          }
        }
      }

      // 2. Social Logic (Reply on X)
      if (updates.newReply) {
        // 如果是公开在 X 上的交易，发布回复到 X
        if (tx.privacy === Privacy.PUBLIC_X && tx.xPostId) {
          const replyContent = updates.newReply.text;
          await Services.social.replyToTweet(tx.xPostId, replyContent);
        }
        
        // 验证：如果状态从 AWAITING_FIAT_PAYMENT 变为 AWAITING_FIAT_CONFIRMATION，必须要有回复
        if (updates.otcState === OTCState.AWAITING_FIAT_CONFIRMATION && tx.otcState === OTCState.AWAITING_FIAT_PAYMENT) {
          if (!updates.newReply || (!updates.newReply.text && !updates.newReply.proof)) {
            throw new Error('发布回复后才能确认。请添加回复内容或上传转账截图。');
          }
        }
      } else if (updates.otcState === OTCState.AWAITING_FIAT_CONFIRMATION && tx.otcState === OTCState.AWAITING_FIAT_PAYMENT) {
        // 如果没有回复但状态要变为 AWAITING_FIAT_CONFIRMATION，抛出错误
        throw new Error('必须发布回复并附上转账截图后才能确认。');
      }

      // 3. Update transaction via API
      let updatedTransaction: Transaction;
      try {
        updatedTransaction = await Services.transactions.updateTransaction(id, updates);
      } catch (error: any) {
        // 如果后端返回 404（例如：内存中的 mock 交易列表不同步），在前端优雅降级为本地更新
        const message = error?.message || '';
        if (message.includes('Not Found') || message.includes('Transaction not found')) {
          console.warn('Backend transaction not found, applying local fallback update for id:', id);

          // 本地构造一个更新后的交易对象
          const base: Transaction = { ...tx };

          // 处理回复
          let replies = base.replies || [];
          let comments = base.comments || 0;
          if (updates.newReply) {
            replies = [...replies, updates.newReply];
            comments = comments + 1;
          }

          updatedTransaction = {
            ...base,
            ...updates,
            replies,
            comments,
          };
        } else {
          throw error;
        }
      }

      // 4. 更新本地 feed：先更新原始 Request，再在顶部插入 Activity 记录
      setFeed((prev) => {
        const mapped = prev.map(t => (t.id === id ? updatedTransaction : t));
        if (activityTransaction) {
          return [activityTransaction, ...mapped];
        }
        return mapped;
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
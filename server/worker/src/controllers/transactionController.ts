import { Context } from 'hono';
import { TransactionType, Privacy, OTCState, Currency } from '../types.js';
import { D1Adapter } from '../db/d1Adapter.js';
import { TransactionRepository } from '../db/repositories/transactionRepository.js';
import { UserRepository } from '../db/repositories/userRepository.js';
import { AuthContext } from '../middleware/auth.js';
import { Env } from '../types.js';
import { TwitterService } from '../services/twitterService.js';

/**
 * 获取交易列表
 */
export const getTransactions = async (c: Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const userId = c.req.query('userId');
    const type = c.req.query('type');
    const privacy = c.req.query('privacy');
    
    const filters = {
      userId: userId ? String(userId) : undefined,
      type: type ? type as TransactionType : undefined,
      privacy: privacy ? privacy as Privacy : undefined,
    };
    
    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const transactionRepo = new TransactionRepository(db, userRepo);
    const transactions = await transactionRepo.findAll(filters);
    
    return c.json({ transactions });
  } catch (error: any) {
    console.error('Get transactions error:', error);
    return c.json({ error: error.message || 'Failed to get transactions' }, 500);
  }
};

/**
 * 创建新交易（简化版，不包含 Twitter 和通知功能）
 */
export const createTransaction = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { transaction, tweetContent } = body;
    const userId = c.user?.userId;
    
    if (!transaction) {
      return c.json({ error: 'Transaction is required' }, 400);
    }
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    console.log('📝 Creating transaction:', JSON.stringify({
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      isOTC: transaction.isOTC,
      privacy: transaction.privacy,
    }));
    
    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const transactionRepo = new TransactionRepository(db, userRepo);
    
    // 获取用户信息
    const fromUser = await userRepo.findById(userId);
    if (!fromUser) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    // 构建交易对象
    const transactionData = {
      ...transaction,
      fromUser,
      toUser: transaction.toUser ? await userRepo.findById(transaction.toUser.id) : undefined,
      timestamp: transaction.timestamp || Date.now(),
    };
    
    const newTransaction = await transactionRepo.create(transactionData);
    console.log('✅ Transaction created:', newTransaction.id);
    
    // Twitter 发布功能
    let twitterAuthStatus: { needsReauth: boolean; reason?: string; error?: string } | undefined;
    
    // 如果隐私设置为 PUBLIC_X 且类型为 REQUEST，发布到 Twitter
    if (newTransaction.privacy === Privacy.PUBLIC_X && newTransaction.type === TransactionType.REQUEST) {
      try {
        console.log('🐦 Attempting to post transaction to Twitter...');
        
        // 获取用户的 Twitter accessToken
        const twitterAccessToken = await userRepo.getTwitterAccessToken(userId);
        
        if (!twitterAccessToken) {
          console.warn('⚠️ User Twitter accessToken not found');
          twitterAuthStatus = {
            needsReauth: true,
            reason: 'no_access_token',
            error: '用户未授权 Twitter API 访问，需要重新授权'
          };
        } else {
          // 确定推文内容：优先使用用户编写的内容，否则自动生成
          let baseTweetContent = tweetContent?.trim();
          if (!baseTweetContent) {
            console.log('🐦 No tweet content provided, generating automatically...');
            baseTweetContent = TwitterService.generateTweetContent({
            type: newTransaction.type,
            amount: newTransaction.amount,
            currency: newTransaction.currency,
            note: newTransaction.note || '',
            fromUser: {
              handle: newTransaction.fromUser.handle,
              name: newTransaction.fromUser.name,
            },
            toUser: newTransaction.toUser ? {
              handle: newTransaction.toUser.handle,
              name: newTransaction.toUser.name,
            } : null,
            isOTC: newTransaction.isOTC,
            otcFiatCurrency: newTransaction.otcFiatCurrency,
            otcOfferAmount: newTransaction.otcOfferAmount,
          });
          } else {
            console.log('🐦 Using user-provided tweet content');
          }
          
          // 添加应用链接
          const frontendUrl = c.env.FRONTEND_URL || 'https://pay.tagai.fun';
          const txLink = `${frontendUrl.replace(/\/$/, '')}/?tx=${newTransaction.id}`;
          const separator = '\n\n';
          const maxLength = 280;
          const reservedForLink = separator.length + txLink.length;
          let finalTweetContent = baseTweetContent;
          
          if (finalTweetContent.length + reservedForLink > maxLength) {
            const allowedBaseLength = Math.max(maxLength - reservedForLink, 0);
            if (allowedBaseLength > 3) {
              finalTweetContent = finalTweetContent.substring(0, allowedBaseLength - 3) + '...';
            } else {
              finalTweetContent = '';
            }
          }
          
          if (finalTweetContent) {
            finalTweetContent += separator + txLink;
          } else {
            finalTweetContent = txLink;
          }
          
          if (finalTweetContent.length > maxLength) {
            finalTweetContent = finalTweetContent.substring(0, maxLength);
          }
          
          console.log('📝 Tweet content:', finalTweetContent);
          console.log('📝 Tweet content length:', finalTweetContent.length);
          
          // 发布推文
          try {
            const apiBase = 'https://api.twitter.com/2';
            const twitterService = new TwitterService(apiBase);
            const tweetResult = await twitterService.postTweet(finalTweetContent, twitterAccessToken);
            
            // 更新交易，保存推文 ID
            await transactionRepo.update(newTransaction.id, {
              xPostId: tweetResult.tweetId,
            });
            
            console.log(`✅ Transaction posted to Twitter: ${tweetResult.tweetId}`);
            console.log(`🔗 Tweet URL: ${tweetResult.url}`);
          } catch (tweetError: any) {
            console.error('❌ Failed to post tweet:', tweetError.message);
            
            // 检查是否是 token 无效的错误
            const isTokenError = tweetError.message?.includes('authentication failed') || 
                                 tweetError.message?.includes('invalid') ||
                                 tweetError.message?.includes('expired') ||
                                 tweetError.message?.includes('401');
            
            if (isTokenError) {
              twitterAuthStatus = {
                needsReauth: true,
                reason: 'tweet_failed_token_invalid',
                error: 'Twitter accessToken 无效或已过期，请重新登录'
              };
              
              // 清除无效的 accessToken
              try {
                await userRepo.update(userId, {
                  twitterAccessToken: null,
                  twitterRefreshToken: null,
                  twitterTokenExpiresAt: null,
                });
                console.log('✅ Cleared invalid tokens');
              } catch (clearError) {
                console.warn('⚠️ Failed to clear invalid tokens:', clearError);
              }
            } else {
              twitterAuthStatus = {
                needsReauth: false,
                reason: 'tweet_failed_other',
                error: tweetError.message || '推文发布失败'
              };
            }
          }
        }
      } catch (error: any) {
        // 如果 Twitter 发布失败，记录错误但不阻止交易创建
        console.error('❌ Failed to post transaction to Twitter:', error.message);
        twitterAuthStatus = {
          needsReauth: true,
          reason: 'tweet_failed',
          error: error.message || '推文发布失败'
        };
      }
    }
    
    // TODO: 添加通知功能
    
    // 如果 Twitter 授权状态有问题，在响应中包含
    const response: any = { transaction: newTransaction };
    if (twitterAuthStatus) {
      response.twitterAuthStatus = twitterAuthStatus;
    }
    
    return c.json(response, 201);
  } catch (error: any) {
    console.error('❌ Create transaction error:', error);
    return c.json({ 
      error: error.message || 'Failed to create transaction'
    }, 500);
  }
};

/**
 * 更新交易
 */
export const updateTransaction = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { updates } = body;
    
    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const transactionRepo = new TransactionRepository(db, userRepo);
    
    // 获取旧交易状态（用于检测状态变化）
    const oldTransaction = await transactionRepo.findById(id);
    const oldState = oldTransaction?.otcState;
    
    const transaction = await transactionRepo.update(id, updates);
    
    if (!transaction) {
      return c.json({ error: 'Transaction not found' }, 404);
    }
    
    // TODO: 如果状态发生变化，创建通知
    
    return c.json({ transaction });
  } catch (error: any) {
    console.error('Update transaction error:', error);
    return c.json({ error: error.message || 'Failed to update transaction' }, 500);
  }
};

/**
 * 选择交易者（从抢单列表中选择）
 */
export const selectTrader = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const userId = c.user?.userId;
    if (!userId) {
      return c.json({ error: { message: 'Unauthorized' } }, 401);
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    const { traderId } = body;

    console.log(`🔍 Select trader request: transactionId=${id}, traderId=${traderId}, userId=${userId}`);

    if (!traderId) {
      console.error('❌ Trader ID is missing');
      return c.json({ error: { message: 'Trader ID is required' } }, 400);
    }

    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const transactionRepo = new TransactionRepository(db, userRepo);

    // 检查交易是否存在
    const transaction = await transactionRepo.findById(id);
    if (!transaction) {
      console.error(`❌ Transaction not found: ${id}`);
      return c.json({ error: { message: 'Transaction not found' } }, 404);
    }

    console.log(`📊 Transaction state: ${transaction.otcState}, fromUser: ${transaction.fromUser.id}`);

    // 判断是否是 Request U（请求 USDT）
    const isRequestU = transaction.type === TransactionType.REQUEST && transaction.currency === Currency.USDT;

    // 权限检查
    if (isRequestU) {
      // Request U：交易者可以自己选择自己
      if (traderId !== userId || userId === transaction.fromUser.id) {
        console.error(`❌ Request U: Invalid trader selection. traderId=${traderId}, userId=${userId}, fromUser.id=${transaction.fromUser.id}`);
        return c.json({ error: { message: 'In Request U, only traders can select themselves' } }, 403);
      }
    } else {
      // Request 法币：只有发起者可以选择交易者
      if (transaction.fromUser.id !== userId) {
        console.error(`❌ Permission denied: userId=${userId}, transaction.fromUser.id=${transaction.fromUser.id}`);
        return c.json({ error: { message: 'Only the requester can select a trader' } }, 403);
      }
    }

    // 检查交易状态
    if (transaction.otcState !== OTCState.BIDDING && transaction.otcState !== OTCState.OPEN_REQUEST) {
      console.error(`❌ Invalid transaction state: ${transaction.otcState}, expected BIDDING or OPEN_REQUEST`);
      return c.json({ 
        error: { 
          message: `Transaction must be in BIDDING or OPEN_REQUEST state. Current state: ${transaction.otcState}` 
        } 
      }, 400);
    }

    // 更新交易：选择交易者并更新状态
    const newState = isRequestU ? transaction.otcState : OTCState.SELECTED_TRADER;
    
    const updatedTransaction = await transactionRepo.update(id, {
      selectedTraderId: traderId,
      otcState: newState,
    });

    if (!updatedTransaction) {
      console.error(`❌ Failed to update transaction: ${id}`);
      return c.json({ error: { message: 'Transaction not found' } }, 404);
    }

    console.log(`✅ Trader selected successfully: transactionId=${id}, traderId=${traderId}, isRequestU=${isRequestU}`);

    // TODO: 创建通知

    return c.json({ transaction: updatedTransaction });
  } catch (error: any) {
    console.error('❌ Select trader error:', error);
    return c.json({ error: { message: error.message || 'Failed to select trader' } }, 500);
  }
};

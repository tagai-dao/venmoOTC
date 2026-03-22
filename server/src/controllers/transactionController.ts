import { Response } from 'express';
import { CreateTransactionRequest, UpdateTransactionRequest, TransactionType, Privacy, OTCState, Currency } from '../types.js';
import { TransactionRepository } from '../db/repositories/transactionRepository.js';
import { AuthRequest } from '../middleware/auth.js';
import { NotificationService } from '../services/notificationService.js';
import { TwitterService } from '../services/twitterService.js';
import { config } from '../config.js';

/**
 * 获取交易列表
 */
export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, type, privacy } = req.query;
    
    const filters = {
      userId: userId ? String(userId) : undefined,
      type: type && Object.values(TransactionType).includes(type as TransactionType) ? type as TransactionType : undefined,
      privacy: privacy && Object.values(Privacy).includes(privacy as Privacy) ? privacy as Privacy : undefined,
    };
    
    const transactions = await TransactionRepository.findAll(filters);
    
    res.json({ transactions });
  } catch (error: any) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: error.message || 'Failed to get transactions' });
  }
};

/**
 * 创建新交易
 */
export const createTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const { transaction, tweetContent } = req.body as CreateTransactionRequest;
    const userId = req.user?.userId;
    
    if (!transaction) {
      return res.status(400).json({ error: 'Transaction is required' });
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify the authenticated user matches the fromUser in the transaction
    if (transaction.fromUser?.id && transaction.fromUser.id !== userId) {
      return res.status(403).json({ error: 'Forbidden: cannot create transaction on behalf of another user' });
    }

    console.log('📝 Creating transaction:', JSON.stringify({
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      isOTC: transaction.isOTC,
      privacy: transaction.privacy,
      hasTweetContent: !!tweetContent,
    }));
    console.log('👤 User info from JWT token:', {
      userId: userId,
      handle: req.user?.handle,
      walletAddress: req.user?.walletAddress,
    });
    
    const newTransaction = await TransactionRepository.create(transaction);
    console.log('✅ Transaction created:', newTransaction.id);
    
    // Twitter 授权状态（用于前端判断是否需要重新授权）
    let twitterAuthStatus: { needsReauth: boolean; reason?: string; error?: string } | undefined;
    
    // 如果隐私设置为 PUBLIC_X，后端使用用户的 Twitter accessToken 发布推文
    if (newTransaction.privacy === Privacy.PUBLIC_X && newTransaction.type === TransactionType.REQUEST) {
      try {
        // 使用 UserRepository 的方法获取 Twitter accessToken
        const { UserRepository } = await import('../db/repositories/userRepository.js');
        
        let twitterAccessToken: string | null = null;
        try {
          console.log('🔍 Attempting to retrieve Twitter accessToken for user:', userId);
          twitterAccessToken = await UserRepository.getTwitterAccessToken(userId);
          console.log('🔍 Retrieved Twitter accessToken from database:', {
            userId,
            hasToken: !!twitterAccessToken,
          });
          
          // 如果 token 为空，检查数据库中是否有该用户
          if (!twitterAccessToken) {
            const user = await UserRepository.findById(userId);
            console.log('🔍 User check:', {
              userId,
              userExists: !!user,
              userHandle: user?.handle,
              userWalletAddress: user?.walletAddress,
            });
            
            // 直接查询数据库确认
            const { pool } = await import('../db/config.js');
            const [rows] = await pool.execute(
              'SELECT twitter_access_token FROM users WHERE id = ?',
              [userId]
            );
            const result = rows as any[];
            console.log('🔍 Direct database query result:', {
              userId,
              rowCount: result.length,
              hasToken: !!result[0]?.twitter_access_token,
              tokenValue: result[0]?.twitter_access_token ? result[0].twitter_access_token.substring(0, 30) + '...' : null,
            });
          }
        } catch (dbError: any) {
          // 如果字段不存在，尝试执行迁移
          if (dbError.code === 'ER_BAD_FIELD_ERROR' || dbError.errno === 1054) {
            console.warn('⚠️ twitter_access_token column not found, attempting to add it...');
            try {
              const { pool } = await import('../db/config.js');
              // 尝试添加字段
              await pool.execute(
                'ALTER TABLE users ADD COLUMN twitter_access_token TEXT'
              );
              console.log('✅ twitter_access_token column added successfully');
              
              // 重新查询
              twitterAccessToken = await UserRepository.getTwitterAccessToken(userId);
            } catch (migrationError: any) {
              // 如果字段已存在，忽略错误
              if (migrationError.code === 'ER_DUP_FIELDNAME' || migrationError.errno === 1060) {
                console.log('ℹ️ twitter_access_token column already exists');
                // 重新查询
                twitterAccessToken = await UserRepository.getTwitterAccessToken(userId);
              } else {
                throw migrationError;
              }
            }
          } else {
            throw dbError;
          }
        }
        
        // 如果没有 accessToken，标记为需要重新授权
        if (!twitterAccessToken) {
          console.warn('⚠️ User Twitter accessToken not found');
          twitterAuthStatus = {
            needsReauth: true,
            reason: 'no_access_token',
            error: '用户未授权 Twitter API 访问，需要重新授权'
          };
          
          // 清除可能存在的无效 accessToken
          try {
            await UserRepository.update(userId, { twitterAccessToken: null } as any);
          } catch (clearError) {
            console.warn('⚠️ Failed to clear invalid accessToken:', clearError);
          }
        } else {
          // 在发推前，确保 token 有效（检查并刷新如果需要）
          const { TwitterTokenRefreshService } = await import('../services/twitterTokenRefreshService.js');
          let validAccessToken = await TwitterTokenRefreshService.ensureValidToken(userId);
          
          if (!validAccessToken) {
            console.error('❌ 无法获取有效的 Twitter accessToken');
            twitterAuthStatus = {
              needsReauth: true,
              reason: 'token_refresh_failed',
              error: 'Twitter accessToken 刷新失败，请重新登录'
            };
            
            // 清除无效的 token
            try {
              await UserRepository.update(userId, { 
                twitterAccessToken: null,
                twitterRefreshToken: null,
                twitterTokenExpiresAt: null,
              } as any);
              TwitterTokenRefreshService.stopRefreshTimer(userId);
              console.log('✅ Cleared invalid tokens and stopped refresh timer');
            } catch (clearError) {
              console.warn('⚠️ Failed to clear invalid tokens:', clearError);
            }
          } else {
            // 确定推文内容：优先使用用户编写的内容，否则自动生成
            let baseTweetContent = tweetContent?.trim();
            if (!baseTweetContent) {
              console.log('🐦 No tweet content provided, generating automatically...');
              baseTweetContent = TwitterService.generateTweetContent(newTransaction);
            } else {
              console.log('🐦 Using user-provided tweet content');
            }

            // 为每一个 Request 动态生成一个应用内链接，并附加到推文末尾
            // 例如：https://app.example.com/?tx=<transactionId>
            const txLink = `${config.frontendUrl.replace(/\/$/, '')}/?tx=${newTransaction.id}`;

            // 预留出链接与分隔符的长度，避免超过 280 字符
            const separator = '\n\n';
            const maxLength = 280;
            const reservedForLink = separator.length + txLink.length;
            let finalTweetContent = baseTweetContent;

            if (finalTweetContent.length + reservedForLink > maxLength) {
              const allowedBaseLength = Math.max(maxLength - reservedForLink, 0);
              // 预留 3 个字符给省略号
              if (allowedBaseLength > 3) {
                finalTweetContent = finalTweetContent.substring(0, allowedBaseLength - 3) + '...';
              } else {
                // 极端情况下，直接用链接
                finalTweetContent = '';
              }
            }

            // 仅当 base 内容非空时添加分隔符
            if (finalTweetContent) {
              finalTweetContent += separator + txLink;
            } else {
              finalTweetContent = txLink;
            }

            // 再次确保总长度不超过 280（极端保护）
            if (finalTweetContent.length > maxLength) {
              finalTweetContent = finalTweetContent.substring(0, maxLength);
            }

            console.log('📝 Tweet content with link:', finalTweetContent);
            console.log('📝 Tweet content length:', finalTweetContent.length);

            // 使用有效的 Twitter accessToken 发布推文
            console.log('🔑 Using user Twitter accessToken to post tweet...');
            
            try {
              const tweetResult = await TwitterService.postTweet(finalTweetContent, validAccessToken);
              
              // 更新交易，保存推文 ID
              await TransactionRepository.update(newTransaction.id, {
                xPostId: tweetResult.tweetId,
              });
              
              console.log(`✅ Transaction posted to Twitter using user's accessToken: ${tweetResult.tweetId}`);
              console.log(`🔗 Tweet URL: ${tweetResult.url}`);
            } catch (tweetError: any) {
              // 如果发推失败，标记为需要重新授权
              console.error('❌ Failed to post tweet:', tweetError.message);
              
              // 检查是否是 token 无效的错误
              const isTokenError = tweetError.message?.includes('authentication failed') || 
                                   tweetError.message?.includes('invalid') ||
                                   tweetError.message?.includes('expired') ||
                                   tweetError.response?.status === 401;
              
              if (isTokenError) {
                twitterAuthStatus = {
                  needsReauth: true,
                  reason: 'tweet_failed_token_invalid',
                  error: 'Twitter accessToken 无效或已过期，请重新登录'
                };
                
                // 清除无效的 accessToken 并停止刷新定时任务
                try {
                  await UserRepository.update(userId, { 
                    twitterAccessToken: null,
                    twitterRefreshToken: null,
                    twitterTokenExpiresAt: null,
                  } as any);
                  TwitterTokenRefreshService.stopRefreshTimer(userId);
                  console.log('✅ Cleared invalid tokens and stopped refresh timer');
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
        }
      } catch (error: any) {
        // 如果 Twitter 发布失败，记录错误但不阻止交易创建
        console.error('❌ Failed to post transaction to Twitter:', error.message);
        console.error('Error details:', error);
        twitterAuthStatus = {
          needsReauth: true,
          reason: 'tweet_failed',
          error: error.message || '推文发布失败'
        };
      }
    }
    
    // 创建通知（使用 try-catch 确保通知失败不会影响交易创建）
    try {
      // 1. 如果是 REQUEST，通知目标用户
      if (newTransaction.type === TransactionType.REQUEST) {
        await NotificationService.notifyRequestCreated(newTransaction);
      }
      // 2. 如果是 PAYMENT，通知收款人
      else if (newTransaction.type === TransactionType.PAYMENT && newTransaction.toUser) {
        await NotificationService.notifyPaymentReceived(newTransaction);
      }
    } catch (error: any) {
      console.error('❌ Failed to create notification:', error.message);
      // 通知失败不影响交易创建
    }
    
    // 重新获取交易（包含更新的 xPostId）
    const updatedTransaction = await TransactionRepository.findById(newTransaction.id);
    
    // 返回交易和 Twitter 授权状态
    res.status(201).json({ 
      transaction: updatedTransaction || newTransaction,
      ...(twitterAuthStatus && { twitterAuthStatus })
    });
  } catch (error: any) {
    console.error('❌ Create transaction error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Failed to create transaction',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * 更新交易
 */
export const updateTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { updates } = req.body as UpdateTransactionRequest;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    // 获取旧交易状态（用于检测状态变化）
    const oldTransaction = await TransactionRepository.findById(id);
    const oldState = oldTransaction?.otcState;

    // Only the initiator (fromUser) or selected counterparty may update the transaction
    if (
      oldTransaction &&
      oldTransaction.fromUser?.id !== userId &&
      oldTransaction.selectedTraderId !== userId &&
      oldTransaction.toUser?.id !== userId
    ) {
      return res.status(403).json({ error: { message: 'Forbidden: not authorized to update this transaction' } });
    }
    
    const transaction = await TransactionRepository.update(id, updates);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // 如果状态发生变化，创建通知
    if (oldState !== undefined && transaction.otcState !== oldState) {
      await NotificationService.notifyRequestStateChanged(transaction, oldState, transaction.otcState);
    }
    
    res.json({ transaction });
  } catch (error: any) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to update transaction' });
  }
};

/**
 * 选择交易者（从抢单列表中选择）
 */
export const selectTrader = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const { id } = req.params;
    const { traderId } = req.body;

    console.log(`🔍 Select trader request: transactionId=${id}, traderId=${traderId}, userId=${userId}`);

    if (!traderId) {
      console.error('❌ Trader ID is missing');
      return res.status(400).json({ error: { message: 'Trader ID is required' } });
    }

    // 检查交易是否存在
    const transaction = await TransactionRepository.findById(id);
    if (!transaction) {
      console.error(`❌ Transaction not found: ${id}`);
      return res.status(404).json({ error: { message: 'Transaction not found' } });
    }

    console.log(`📊 Transaction state: ${transaction.otcState}, fromUser: ${transaction.fromUser.id}`);

    // 判断是否是 Request U（请求 USDT）
    // Request U 的特征：currency 是 USDT，type 是 REQUEST
    const isRequestU = transaction.type === TransactionType.REQUEST && transaction.currency === Currency.USDT;

    // 权限检查：
    // 1. Request U：允许交易者自己选择自己（traderId === userId 且 userId !== fromUser.id）
    // 2. Request 法币：只有发起者可以选择交易者
    if (isRequestU) {
      // Request U：交易者可以自己选择自己
      if (traderId !== userId || userId === transaction.fromUser.id) {
        console.error(`❌ Request U: Invalid trader selection. traderId=${traderId}, userId=${userId}, fromUser.id=${transaction.fromUser.id}`);
        return res.status(403).json({ error: { message: 'In Request U, only traders can select themselves' } });
      }
    } else {
      // Request 法币：只有发起者可以选择交易者
      if (transaction.fromUser.id !== userId) {
        console.error(`❌ Permission denied: userId=${userId}, transaction.fromUser.id=${transaction.fromUser.id}`);
        return res.status(403).json({ error: { message: 'Only the requester can select a trader' } });
      }
    }

    // 检查交易状态
    if (transaction.otcState !== OTCState.BIDDING && transaction.otcState !== OTCState.OPEN_REQUEST) {
      console.error(`❌ Invalid transaction state: ${transaction.otcState}, expected BIDDING or OPEN_REQUEST`);
      return res.status(400).json({ 
        error: { 
          message: `Transaction must be in BIDDING or OPEN_REQUEST state. Current state: ${transaction.otcState}` 
        } 
      });
    }

    // 更新交易：选择交易者并更新状态
    // Request U：只设置 selectedTraderId，不改变状态（recordOrder 会将其更新为 USDT_IN_ESCROW）
    // Request 法币：设置 selectedTraderId 并将状态更新为 SELECTED_TRADER
    const newState = isRequestU ? transaction.otcState : OTCState.SELECTED_TRADER;
    
    const updatedTransaction = await TransactionRepository.update(id, {
      selectedTraderId: traderId,
      otcState: newState,
    });

    if (!updatedTransaction) {
      console.error(`❌ Failed to update transaction: ${id}`);
      return res.status(404).json({ error: { message: 'Transaction not found' } });
    }

    console.log(`✅ Trader selected successfully: transactionId=${id}, traderId=${traderId}, isRequestU=${isRequestU}`);

    // 创建通知（Request U 不需要发送 SELECTED_TRADER 通知，因为状态没有改变）
    if (!isRequestU) {
      await NotificationService.notifyRequestStateChanged(transaction, transaction.otcState, OTCState.SELECTED_TRADER);
    }

    res.json({ transaction: updatedTransaction });
  } catch (error: any) {
    console.error('❌ Select trader error:', error);
    res.status(500).json({ error: { message: error.message || 'Failed to select trader' } });
  }
};


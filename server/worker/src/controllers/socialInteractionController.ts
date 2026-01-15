import { Context } from 'hono';
import { D1Adapter } from '../db/d1Adapter.js';
import { SocialInteractionRepository } from '../db/repositories/socialInteractionRepository.js';
import { TransactionRepository } from '../db/repositories/transactionRepository.js';
import { UserRepository } from '../db/repositories/userRepository.js';
import { TwitterService } from '../services/twitterService.js';
import { AuthContext } from '../middleware/auth.js';
import { Env, Privacy } from '../types.js';

/**
 * 点赞/取消点赞交易
 */
export const likeTransaction = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const userId = c.user?.userId;
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const transactionId = c.req.param('transactionId');
    if (!transactionId) {
      return c.json({ error: 'Transaction ID is required' }, 400);
    }

    console.log(`👍 Like transaction request: transactionId=${transactionId}, userId=${userId}`);

    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const transactionRepo = new TransactionRepository(db, userRepo);
    const socialInteractionRepo = new SocialInteractionRepository(db, userRepo);

    const transaction = await transactionRepo.findById(transactionId);
    if (!transaction) {
      console.error(`Transaction not found: ${transactionId}`);
      return c.json({ error: 'Transaction not found' }, 404);
    }

    const likePrivacy = transaction.privacy;
    console.log(`Transaction privacy: ${likePrivacy}`);

    const result = await socialInteractionRepo.likeTransaction(
      transactionId,
      userId,
      likePrivacy
    );
    console.log(`Like result:`, result);

    // TODO: 如果点赞成功且交易发布在 X 上，同步到 X

    const updatedTransaction = await transactionRepo.findById(transactionId);
    const hasLiked = await socialInteractionRepo.hasUserLiked(transactionId, userId);

    return c.json({
      success: true,
      hasLiked,
      likes: updatedTransaction?.likes || 0
    });
  } catch (error: any) {
    console.error('Like transaction error:', error);
    return c.json({ error: error.message || 'Failed to like transaction' }, 500);
  }
};

/**
 * 添加评论
 */
export const addComment = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const userId = c.user?.userId;
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const transactionId = c.req.param('transactionId');
    const body = await c.req.json();
    const { text, proof } = body;

    if (!transactionId || !text) {
      return c.json({ error: 'Transaction ID and text are required' }, 400);
    }

    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const transactionRepo = new TransactionRepository(db, userRepo);
    const socialInteractionRepo = new SocialInteractionRepository(db, userRepo);

    const transaction = await transactionRepo.findById(transactionId);
    if (!transaction) {
      return c.json({ error: 'Transaction not found' }, 404);
    }

    const commentPrivacy = transaction.privacy;

    const commentId = await socialInteractionRepo.addComment(
      transactionId,
      userId,
      text,
      commentPrivacy,
      proof
    );

    // 如果评论成功且交易发布在 X 上，同步到 X
    let xCommentId: string | undefined;
    if (transaction.privacy === Privacy.PUBLIC_X && transaction.xPostId) {
      try {
        const commentUserAccessToken = await userRepo.getTwitterAccessToken(userId);
        
        if (!commentUserAccessToken) {
          console.warn(`⚠️ User ${userId} does not have Twitter accessToken. Comment will not be posted to X.`);
        } else {
          console.log(`🐦 Posting comment to X for transaction ${transactionId}...`);
          
          const txLink = `${c.env.FRONTEND_URL.replace(/\/$/, '')}/?tx=${transactionId}`;
          const separator = '\n\n';
          const maxLength = 280;
          const reservedForLink = separator.length + txLink.length;
          let finalCommentText = text;
          
          if (finalCommentText.length + reservedForLink > maxLength) {
            const allowedTextLength = Math.max(maxLength - reservedForLink, 0);
            if (allowedTextLength > 3) {
              finalCommentText = finalCommentText.substring(0, allowedTextLength - 3) + '...';
            } else {
              finalCommentText = '';
            }
          }
          
          if (finalCommentText) {
            finalCommentText += separator + txLink;
          } else {
            finalCommentText = txLink;
          }
          
          if (finalCommentText.length > maxLength) {
            finalCommentText = finalCommentText.substring(0, maxLength);
          }
          
          const apiBase = 'https://api.twitter.com/2';
          const twitterService = new TwitterService(apiBase);
          const replyResult = await twitterService.replyToTweet(
            transaction.xPostId,
            finalCommentText,
            commentUserAccessToken
          );
          
          if (replyResult && replyResult.replyId) {
            xCommentId = replyResult.replyId;
            await socialInteractionRepo.updateCommentXId(commentId, xCommentId);
            console.log(`✅ Comment posted to X successfully! Reply ID: ${xCommentId}`);
          }
        }
      } catch (error: any) {
        console.error('❌ Failed to sync comment to X:', error);
        // 不阻止评论操作，即使 X 同步失败
      }
    }

    const updatedTransaction = await transactionRepo.findById(transactionId);

    return c.json({
      success: true,
      commentId,
      xCommentId,
      comments: updatedTransaction?.comments || 0,
      transaction: updatedTransaction
    });
  } catch (error: any) {
    console.error('Add comment error:', error);
    return c.json({ error: error.message || 'Failed to add comment' }, 500);
  }
};

/**
 * 删除评论
 */
export const deleteComment = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const userId = c.user?.userId;
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const commentId = c.req.param('commentId');
    if (!commentId) {
      return c.json({ error: 'Comment ID is required' }, 400);
    }

    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const socialInteractionRepo = new SocialInteractionRepository(db, userRepo);
    
    const success = await socialInteractionRepo.deleteComment(commentId, userId);
    if (!success) {
      return c.json({ error: 'Comment not found or not authorized' }, 404);
    }

    return c.json({ success: true, message: 'Comment deleted' });
  } catch (error: any) {
    console.error('Delete comment error:', error);
    return c.json({ error: error.message || 'Failed to delete comment' }, 500);
  }
};

/**
 * 检查用户是否已点赞
 */
export const checkUserLiked = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const userId = c.user?.userId;
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const transactionId = c.req.param('transactionId');
    if (!transactionId) {
      return c.json({ error: 'Transaction ID is required' }, 400);
    }

    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const socialInteractionRepo = new SocialInteractionRepository(db, userRepo);
    
    const hasLiked = await socialInteractionRepo.hasUserLiked(transactionId, userId);
    return c.json({ hasLiked });
  } catch (error: any) {
    console.error('Check user liked error:', error);
    return c.json({ error: error.message || 'Failed to check like status' }, 500);
  }
};

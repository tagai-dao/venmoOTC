import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { SocialInteractionRepository } from '../db/repositories/socialInteractionRepository.js';
import { TransactionRepository } from '../db/repositories/transactionRepository.js';
import { UserRepository } from '../db/repositories/userRepository.js';
import { Privacy } from '../types.js';
import { TwitterService } from '../services/twitterService.js';
import { config } from '../config.js';

/**
 * 点赞/取消点赞交易
 */
export const likeTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { transactionId } = req.params;
    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    console.log(`👍 Like transaction request: transactionId=${transactionId}, userId=${userId}`);

    // 获取交易信息，确定点赞的隐私设置
    const transaction = await TransactionRepository.findById(transactionId);
    if (!transaction) {
      console.error(`Transaction not found: ${transactionId}`);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // 点赞的隐私设置继承自交易
    const likePrivacy = transaction.privacy;
    console.log(`Transaction privacy: ${likePrivacy}`);

    // 执行点赞/取消点赞
    const result = await SocialInteractionRepository.likeTransaction(
      transactionId,
      userId,
      likePrivacy
    );
    console.log(`Like result:`, result);

    // 如果点赞成功且交易发布在 X 上，同步到 X
    if (result.id && transaction.privacy === Privacy.PUBLIC_X && transaction.xPostId) {
      try {
        // 模拟点赞推文（实际应该调用 X API）
        const xLikeId = await SocialServices.likeTweet(transaction.xPostId);
        if (xLikeId) {
          await SocialInteractionRepository.updateLikeXId(result.id, xLikeId);
        }
      } catch (error) {
        console.error('Failed to sync like to X:', error);
        // 不阻止点赞操作，即使 X 同步失败
      }
    }

    // 获取更新后的交易信息
    const updatedTransaction = await TransactionRepository.findById(transactionId);
    const hasLiked = await SocialInteractionRepository.hasUserLiked(transactionId, userId);

    res.json({
      success: true,
      hasLiked,
      likes: updatedTransaction?.likes || 0
    });
  } catch (error: any) {
    console.error('Like transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to like transaction' });
  }
};

/**
 * 添加评论
 */
export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { transactionId } = req.params;
    const { text, proof } = req.body;

    if (!transactionId || !text) {
      return res.status(400).json({ error: 'Transaction ID and text are required' });
    }

    // 获取交易信息，确定评论的隐私设置
    const transaction = await TransactionRepository.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // 评论的隐私设置继承自交易
    const commentPrivacy = transaction.privacy;

    // 添加评论
    const commentId = await SocialInteractionRepository.addComment(
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
        // 获取评论用户的 Twitter accessToken
        const commentUserAccessToken = await UserRepository.getTwitterAccessToken(userId);
        
        if (!commentUserAccessToken) {
          console.warn(`⚠️ User ${userId} does not have Twitter accessToken. Comment will not be posted to X.`);
        } else {
          console.log(`🐦 Posting comment to X for transaction ${transactionId}...`);
          
          // 为评论生成应用内链接，并附加到评论文本末尾
          // 链接格式：https://app.example.com/?tx=<transactionId>
          const txLink = `${config.frontendUrl.replace(/\/$/, '')}/?tx=${transactionId}`;
          
          // 预留出链接与分隔符的长度，避免超过 280 字符
          const separator = '\n\n';
          const maxLength = 280;
          const reservedForLink = separator.length + txLink.length;
          let finalCommentText = text;
          
          // 如果原始文本加上链接会超过 280 字符，需要截断
          if (finalCommentText.length + reservedForLink > maxLength) {
            const allowedTextLength = Math.max(maxLength - reservedForLink, 0);
            // 预留 3 个字符给省略号
            if (allowedTextLength > 3) {
              finalCommentText = finalCommentText.substring(0, allowedTextLength - 3) + '...';
            } else {
              // 极端情况下，直接用链接
              finalCommentText = '';
            }
          }
          
          // 仅当原始文本非空时添加分隔符
          if (finalCommentText) {
            finalCommentText += separator + txLink;
          } else {
            finalCommentText = txLink;
          }
          
          // 再次确保总长度不超过 280（极端保护）
          if (finalCommentText.length > maxLength) {
            finalCommentText = finalCommentText.substring(0, maxLength);
          }
          
          console.log('📝 Comment text with link:', finalCommentText);
          console.log('📝 Comment text length:', finalCommentText.length);
          
          // 调用真实的 Twitter API 回复推文（使用带链接的文本）
          const replyResult = await TwitterService.replyToTweet(
            transaction.xPostId,
            finalCommentText,
            commentUserAccessToken
          );
          
          if (replyResult && replyResult.replyId) {
            xCommentId = replyResult.replyId;
            await SocialInteractionRepository.updateCommentXId(commentId, xCommentId);
            console.log(`✅ Comment posted to X successfully! Reply ID: ${xCommentId}`);
          }
        }
      } catch (error: any) {
        console.error('❌ Failed to sync comment to X:', error);
        console.error('Error details:', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        });
        // 不阻止评论操作，即使 X 同步失败
        // 但记录错误以便后续排查
      }
    }

    // 获取更新后的交易信息
    const updatedTransaction = await TransactionRepository.findById(transactionId);

    res.json({
      success: true,
      commentId,
      xCommentId,
      comments: updatedTransaction?.comments || 0,
      transaction: updatedTransaction
    });
  } catch (error: any) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: error.message || 'Failed to add comment' });
  }
};

/**
 * 删除评论
 */
export const deleteComment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { commentId } = req.params;
    if (!commentId) {
      return res.status(400).json({ error: 'Comment ID is required' });
    }

    const success = await SocialInteractionRepository.deleteComment(commentId, userId);
    if (!success) {
      return res.status(404).json({ error: 'Comment not found or not authorized' });
    }

    res.json({ success: true, message: 'Comment deleted' });
  } catch (error: any) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete comment' });
  }
};

/**
 * 检查用户是否已点赞
 */
export const checkUserLiked = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { transactionId } = req.params;
    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const hasLiked = await SocialInteractionRepository.hasUserLiked(transactionId, userId);
    res.json({ hasLiked });
  } catch (error: any) {
    console.error('Check user liked error:', error);
    res.status(500).json({ error: error.message || 'Failed to check like status' });
  }
};

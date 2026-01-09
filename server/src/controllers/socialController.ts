import { Request, Response } from 'express';
import { PostTweetRequest, ReplyTweetRequest } from '../types.js';
import { TwitterService } from '../services/twitterService.js';

/**
 * 发布推文到 X (Twitter)
 * 使用真实的 Twitter API v2
 */
export const postTweet = async (req: Request, res: Response) => {
  try {
    const { content, accessToken } = req.body as PostTweetRequest;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    console.log(`🐦 Posting to X API v2: "${content}"`);
    
    // 调用真实的 Twitter API
    const result = await TwitterService.postTweet(content, accessToken);
    
    console.log(`✅ Posted to X! Tweet ID: ${result.tweetId}`);
    
    res.json({ 
      tweetId: result.tweetId, 
      content,
      createdAt: new Date().toISOString(),
      url: result.url,
    });
  } catch (error: any) {
    console.error('Post tweet error:', error);
    res.status(500).json({ error: error.message || 'Failed to post tweet' });
  }
};

/**
 * 回复推文
 * 使用真实的 Twitter API v2
 */
export const replyToTweet = async (req: Request, res: Response) => {
  try {
    const { originalTweetId, content, accessToken } = req.body as ReplyTweetRequest;
    
    if (!originalTweetId || !content) {
      return res.status(400).json({ error: 'originalTweetId and content are required' });
    }
    
    console.log(`🐦 Replying to Tweet ${originalTweetId} on X: "${content}"`);
    
    // 调用真实的 Twitter API
    const result = await TwitterService.replyToTweet(originalTweetId, content, accessToken);
    
    console.log(`✅ Reply posted to X! ID: ${result.replyId}`);
    
    res.json({ 
      replyId: result.replyId, 
      originalTweetId, 
      content,
      createdAt: new Date().toISOString(),
      url: result.url,
    });
  } catch (error: any) {
    console.error('Reply tweet error:', error);
    res.status(500).json({ error: error.message || 'Failed to reply to tweet' });
  }
};


import { Request, Response } from 'express';
import { PostTweetRequest, ReplyTweetRequest } from '../types.js';
import { generateTweetId } from '../mockData.js';

/**
 * 发布推文到 X (Twitter)
 * 使用 Mock 数据返回推文 ID
 */
export const postTweet = async (req: Request, res: Response) => {
  try {
    const { content, accessToken } = req.body as PostTweetRequest;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    console.log(`🐦 Posting to X API v2: "${content}"`);
    
    // 模拟 API 调用延迟
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // 生成模拟推文 ID
    const tweetId = generateTweetId();
    
    console.log(`✅ Posted to X! Tweet ID: ${tweetId}`);
    
    res.json({ 
      tweetId, 
      content,
      createdAt: new Date().toISOString(),
      url: `https://twitter.com/user/status/${tweetId}`,
    });
  } catch (error: any) {
    console.error('Post tweet error:', error);
    res.status(500).json({ error: error.message || 'Failed to post tweet' });
  }
};

/**
 * 回复推文
 * 使用 Mock 数据返回回复 ID
 */
export const replyToTweet = async (req: Request, res: Response) => {
  try {
    const { originalTweetId, content, accessToken } = req.body as ReplyTweetRequest;
    
    if (!originalTweetId || !content) {
      return res.status(400).json({ error: 'originalTweetId and content are required' });
    }
    
    console.log(`🐦 Replying to Tweet ${originalTweetId} on X: "${content}"`);
    
    // 模拟 API 调用延迟
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // 生成模拟回复 ID
    const replyId = generateTweetId();
    
    console.log(`✅ Reply posted to X! ID: ${replyId}`);
    
    res.json({ 
      replyId, 
      originalTweetId, 
      content,
      createdAt: new Date().toISOString(),
      url: `https://twitter.com/user/status/${replyId}`,
    });
  } catch (error: any) {
    console.error('Reply tweet error:', error);
    res.status(500).json({ error: error.message || 'Failed to reply to tweet' });
  }
};


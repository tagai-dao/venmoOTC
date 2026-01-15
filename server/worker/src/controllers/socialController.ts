import { Context } from 'hono';
import { TwitterService } from '../services/twitterService.js';
import { AuthContext } from '../middleware/auth.js';
import { Env } from '../types.js';

/**
 * 发布推文到 X (Twitter)
 */
export const postTweet = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { content, accessToken } = body;
    
    if (!content) {
      return c.json({ error: 'Content is required' }, 400);
    }
    
    if (!accessToken) {
      return c.json({ error: 'Access token is required' }, 400);
    }
    
    console.log(`🐦 Posting to X API v2: "${content}"`);
    
    const apiBase = c.env.X_API_KEY ? 'https://api.twitter.com/2' : 'https://api.twitter.com/2';
    const twitterService = new TwitterService(apiBase);
    const result = await twitterService.postTweet(content, accessToken);
    
    console.log(`✅ Posted to X! Tweet ID: ${result.tweetId}`);
    
    return c.json({ 
      tweetId: result.tweetId, 
      content,
      createdAt: new Date().toISOString(),
      url: result.url,
    });
  } catch (error: any) {
    console.error('Post tweet error:', error);
    return c.json({ error: error.message || 'Failed to post tweet' }, 500);
  }
};

/**
 * 回复推文
 */
export const replyToTweet = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { originalTweetId, content, accessToken } = body;
    
    if (!originalTweetId || !content) {
      return c.json({ error: 'originalTweetId and content are required' }, 400);
    }
    
    if (!accessToken) {
      return c.json({ error: 'Access token is required' }, 400);
    }
    
    console.log(`🐦 Replying to Tweet ${originalTweetId} on X: "${content}"`);
    
    const apiBase = c.env.X_API_KEY ? 'https://api.twitter.com/2' : 'https://api.twitter.com/2';
    const twitterService = new TwitterService(apiBase);
    const result = await twitterService.replyToTweet(originalTweetId, content, accessToken);
    
    console.log(`✅ Reply posted to X! ID: ${result.replyId}`);
    
    return c.json({ 
      replyId: result.replyId, 
      originalTweetId, 
      content,
      createdAt: new Date().toISOString(),
      url: result.url,
    });
  } catch (error: any) {
    console.error('Reply tweet error:', error);
    return c.json({ error: error.message || 'Failed to reply to tweet' }, 500);
  }
};

import axios from 'axios';
import { config } from '../config.js';

/**
 * Twitter API 服务
 * 使用 Twitter API v2 发布推文
 */
export class TwitterService {
  /**
   * 发布推文到 Twitter
   * @param content 推文内容
   * @param accessToken 用户访问令牌（可选，如果提供则使用用户令牌，否则使用 Bearer Token）
   * @returns 推文 ID
   */
  static async postTweet(content: string, accessToken?: string): Promise<{ tweetId: string; url: string }> {
    try {
      // 检查配置
      if (!config.xApi.bearerToken && !accessToken) {
        throw new Error('Twitter API not configured. Please set X_BEARER_TOKEN or provide accessToken');
      }

      // 构建请求头
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // 使用 Bearer Token 或用户 Access Token
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      } else if (config.xApi.bearerToken) {
        headers['Authorization'] = `Bearer ${config.xApi.bearerToken}`;
      }

      // 调用 Twitter API v2 发布推文
      const response = await axios.post(
        `${config.xApi.apiBase}/tweets`,
        {
          text: content,
        },
        {
          headers,
        }
      );

      const tweetId = response.data.data.id;
      // Twitter API v2 可能不直接返回用户名，需要从用户信息中获取
      // 如果没有用户名，使用通用格式
      const username = response.data.data?.username || response.data.includes?.users?.[0]?.username || 'user';

      console.log(`✅ Tweet posted successfully! ID: ${tweetId}`);

      return {
        tweetId,
        url: `https://twitter.com/i/web/status/${tweetId}`, // 使用通用格式，不依赖用户名
      };
    } catch (error: any) {
      console.error('❌ Twitter API error:', error.response?.data || error.message);
      
      // 如果是配置错误，返回更友好的错误信息
      if (error.response?.status === 401) {
        throw new Error('Twitter API authentication failed. Please check your Bearer Token or Access Token.');
      } else if (error.response?.status === 403) {
        throw new Error('Twitter API access forbidden. Please check your API permissions.');
      } else if (error.response?.status === 429) {
        throw new Error('Twitter API rate limit exceeded. Please try again later.');
      }
      
      throw new Error(`Failed to post tweet: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * 回复推文
   * @param originalTweetId 原始推文 ID
   * @param content 回复内容
   * @param accessToken 用户访问令牌（可选）
   * @returns 回复推文 ID
   */
  static async replyToTweet(
    originalTweetId: string,
    content: string,
    accessToken?: string
  ): Promise<{ replyId: string; url: string }> {
    try {
      // 检查配置
      if (!config.xApi.bearerToken && !accessToken) {
        throw new Error('Twitter API not configured. Please set X_BEARER_TOKEN or provide accessToken');
      }

      // 构建请求头
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // 使用 Bearer Token 或用户 Access Token
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      } else if (config.xApi.bearerToken) {
        headers['Authorization'] = `Bearer ${config.xApi.bearerToken}`;
      }

      // 调用 Twitter API v2 回复推文
      const response = await axios.post(
        `${config.xApi.apiBase}/tweets`,
        {
          text: content,
          reply: {
            in_reply_to_tweet_id: originalTweetId,
          },
        },
        {
          headers,
        }
      );

      const replyId = response.data.data.id;
      // Twitter API v2 可能不直接返回用户名，需要从用户信息中获取
      // 如果没有用户名，使用通用格式
      const username = response.data.data?.username || response.data.includes?.users?.[0]?.username || 'user';

      console.log(`✅ Reply posted successfully! ID: ${replyId}`);

      return {
        replyId,
        url: `https://twitter.com/i/web/status/${replyId}`, // 使用通用格式，不依赖用户名
      };
    } catch (error: any) {
      console.error('❌ Twitter API error:', error.response?.data || error.message);
      
      // 如果是配置错误，返回更友好的错误信息
      if (error.response?.status === 401) {
        throw new Error('Twitter API authentication failed. Please check your Bearer Token or Access Token.');
      } else if (error.response?.status === 403) {
        throw new Error('Twitter API access forbidden. Please check your API permissions.');
      } else if (error.response?.status === 429) {
        throw new Error('Twitter API rate limit exceeded. Please try again later.');
      }
      
      throw new Error(`Failed to reply to tweet: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * 生成交易推文内容
   * @param transaction 交易对象
   * @returns 推文内容
   */
  static generateTweetContent(transaction: {
    type: string;
    amount: number;
    currency: string;
    note: string;
    fromUser: { handle: string; name: string };
    toUser?: { handle: string; name: string } | null;
    isOTC?: boolean;
    otcFiatCurrency?: string;
    otcOfferAmount?: number;
  }): string {
    let content = '';

    try {
      if (transaction.type === 'REQUEST') {
        if (transaction.isOTC) {
          // OTC Request
          const offerAmount = transaction.otcOfferAmount || 0;
          const fiatCurrency = transaction.otcFiatCurrency || '';
          
          let direction = '';
          if (transaction.currency === 'USDT') {
            // Requesting USDT, offering Fiat
            direction = `Requesting ${transaction.amount} ${transaction.currency} for ${offerAmount} ${fiatCurrency}`;
          } else {
            // Requesting Fiat, offering USDT
            direction = `Requesting ${transaction.amount} ${transaction.currency} (offering ${offerAmount} USDT)`;
          }
          
          content = `${direction} on VenmoOTC!${transaction.note ? `\n\n${transaction.note}` : ''}\n\n#DeFi #OTC #Crypto`;
        } else {
          // Regular Request
          content = `${transaction.fromUser.name} (${transaction.fromUser.handle}) is requesting ${transaction.amount} ${transaction.currency}${transaction.note ? `\n\n${transaction.note}` : ''}\n\n#DeFi #Crypto`;
        }
      } else if (transaction.type === 'PAYMENT') {
        // Payment
        const recipient = transaction.toUser 
          ? `${transaction.toUser.name} (${transaction.toUser.handle})`
          : 'a wallet address';
        
        content = `${transaction.fromUser.name} (${transaction.fromUser.handle}) paid ${transaction.amount} ${transaction.currency} to ${recipient}${transaction.note ? `\n\n${transaction.note}` : ''}\n\n#DeFi #Crypto`;
      }

      // 确保内容不超过 280 字符（Twitter 限制）
      if (content.length > 280) {
        content = content.substring(0, 277) + '...';
      }

      return content;
    } catch (error: any) {
      console.error('Error generating tweet content:', error);
      // 返回一个简单的默认内容
      return `${transaction.fromUser.name} (${transaction.fromUser.handle}) created a ${transaction.type} transaction on VenmoOTC! #DeFi #Crypto`;
    }
  }
}

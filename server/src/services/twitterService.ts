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
      // Twitter API v2 的 /tweets 端点不支持 OAuth 2.0 Application-Only (Bearer Token)
      // 只支持 OAuth 1.0a User Context 或 OAuth 2.0 User Context
      // 因此必须使用用户的 accessToken，不能使用应用的 Bearer Token
      if (!accessToken) {
        throw new Error('User Twitter accessToken is required. Bearer Token cannot be used to post tweets. Please authorize Twitter API access.');
      }

      console.log('🐦 Preparing to post tweet to Twitter API v2...');
      console.log('📝 Tweet content length:', content.length);

      // 构建请求头
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`, // 使用用户的 OAuth 2.0 accessToken
      };

      console.log('🌐 Twitter API request:', {
        url: `${config.xApi.apiBase}/tweets`,
        method: 'POST',
        hasAuthHeader: !!headers['Authorization'],
      });

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
      
      console.log('📥 Twitter API response:', {
        status: response.status,
        hasData: !!response.data,
        tweetId: response.data?.data?.id,
      });

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
      console.error('Error code:', error.code);
      console.error('Error stack:', error.stack);
      
      // 处理网络连接错误
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
        throw new Error(`Twitter API 连接错误: ${error.message}。请检查网络连接或稍后重试。`);
      }
      
      // 如果是配置错误，返回更友好的错误信息
      if (error.response?.status === 401) {
        const errorDetail = error.response?.data || {};
        console.error('❌ Twitter API 401 Unauthorized:', {
          title: errorDetail.title,
          detail: errorDetail.detail,
          type: errorDetail.type,
        });
        throw new Error('Twitter API authentication failed. The accessToken may be invalid or expired. Please re-authorize Twitter API access.');
      } else if (error.response?.status === 403) {
        // 403 错误通常表示认证方式不支持或权限不足
        const errorDetail = error.response?.data || {};
        const detail = errorDetail.detail || '';
        console.error('❌ Twitter API 403 Forbidden:', {
          title: errorDetail.title,
          detail: detail,
          type: errorDetail.type,
        });
        
        if (detail.includes('OAuth 2.0 Application-Only')) {
          throw new Error('Bearer Token cannot be used to post tweets. User accessToken is required. Please authorize Twitter API access.');
        }
        if (detail.includes('OAuth 1.0a User Context') || detail.includes('OAuth 2.0 User Context')) {
          throw new Error('Twitter API access forbidden. The accessToken may not have the required permissions (tweet.write scope). Please re-authorize with correct permissions.');
        }
        throw new Error(`Twitter API access forbidden: ${detail || 'Please check your API permissions and ensure the accessToken has tweet.write scope.'}`);
      } else if (error.response?.status === 429) {
        throw new Error('Twitter API rate limit exceeded. Please try again later.');
      } else if (error.response?.status) {
        const errorDetail = error.response?.data || {};
        console.error(`❌ Twitter API ${error.response.status} error:`, errorDetail);
        throw new Error(`Twitter API 错误 (${error.response.status}): ${errorDetail.detail || errorDetail.title || error.message}`);
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
      // Twitter API v2 的 /tweets 端点不支持 OAuth 2.0 Application-Only (Bearer Token)
      // 必须使用用户的 accessToken
      if (!accessToken) {
        throw new Error('User Twitter accessToken is required. Bearer Token cannot be used to reply to tweets. Please authorize Twitter API access.');
      }

      // 构建请求头
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`, // 使用用户的 OAuth 2.0 accessToken
      };

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

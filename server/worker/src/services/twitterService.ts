/**
 * Twitter API 服务（Workers 版本）
 * 使用 Twitter API v2 发布推文
 * 注意：Workers 环境使用 fetch API 而不是 axios
 */
export class TwitterService {
  private apiBase: string;

  constructor(apiBase: string = 'https://api.twitter.com/2') {
    this.apiBase = apiBase;
  }

  /**
   * 发布推文到 Twitter
   */
  async postTweet(content: string, accessToken: string): Promise<{ tweetId: string; url: string }> {
    if (!accessToken) {
      throw new Error('User Twitter accessToken is required. Bearer Token cannot be used to post tweets. Please authorize Twitter API access.');
    }

    console.log('🐦 Preparing to post tweet to Twitter API v2...');
    console.log('📝 Tweet content:', content);
    console.log('📝 Tweet content length:', content.length);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };

    try {
      const response = await fetch(`${this.apiBase}/tweets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: content,
        }),
      });

      if (!response.ok) {
        const errorData: any = await response.json().catch(() => ({}));
        
        if (response.status === 401) {
          throw new Error('Twitter API authentication failed. The accessToken may be invalid or expired. Please re-authorize Twitter API access.');
        } else if (response.status === 403) {
          const detail = errorData.detail || '';
          if (detail.includes('OAuth 2.0 Application-Only')) {
            throw new Error('Bearer Token cannot be used to post tweets. User accessToken is required. Please authorize Twitter API access.');
          }
          throw new Error(`Twitter API access forbidden: ${detail || 'Please check your API permissions and ensure the accessToken has tweet.write scope.'}`);
        } else if (response.status === 429) {
          throw new Error('Twitter API rate limit exceeded. Please try again later.');
        }
        
        throw new Error(`Twitter API error (${response.status}): ${errorData.detail || errorData.title || 'Unknown error'}`);
      }

      const data: any = await response.json();
      const tweetId = data.data.id;

      console.log(`✅ Tweet posted successfully! ID: ${tweetId}`);

      return {
        tweetId,
        url: `https://twitter.com/i/web/status/${tweetId}`,
      };
    } catch (error: any) {
      console.error('❌ Twitter API error:', error.message);
      
      if (error.message.includes('fetch')) {
        throw new Error(`Twitter API 连接错误: ${error.message}。请检查网络连接或稍后重试。`);
      }
      
      throw error;
    }
  }

  /**
   * 回复推文
   */
  async replyToTweet(
    originalTweetId: string,
    content: string,
    accessToken: string
  ): Promise<{ replyId: string; url: string }> {
    if (!accessToken) {
      throw new Error('User Twitter accessToken is required. Bearer Token cannot be used to reply to tweets. Please authorize Twitter API access.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };

    try {
      const response = await fetch(`${this.apiBase}/tweets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: content,
          reply: {
            in_reply_to_tweet_id: originalTweetId,
          },
        }),
      });

      if (!response.ok) {
        const errorData: any = await response.json().catch(() => ({}));
        
        if (response.status === 401) {
          throw new Error('Twitter API authentication failed. Please check your Access Token.');
        } else if (response.status === 403) {
          throw new Error('Twitter API access forbidden. Please check your API permissions.');
        } else if (response.status === 429) {
          throw new Error('Twitter API rate limit exceeded. Please try again later.');
        }
        
        throw new Error(`Twitter API error (${response.status}): ${errorData.detail || errorData.title || 'Unknown error'}`);
      }

      const data: any = await response.json();
      const replyId = data.data.id;

      console.log(`✅ Reply posted successfully! ID: ${replyId}`);

      return {
        replyId,
        url: `https://twitter.com/i/web/status/${replyId}`,
      };
    } catch (error: any) {
      console.error('❌ Twitter API error:', error.message);
      throw error;
    }
  }

  /**
   * 生成交易推文内容
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
          const offerAmount = transaction.otcOfferAmount || 0;
          const fiatCurrency = transaction.otcFiatCurrency || '';
          
          let direction = '';
          if (transaction.currency === 'USDT') {
            direction = `Requesting ${transaction.amount} ${transaction.currency} for ${offerAmount} ${fiatCurrency}`;
          } else {
            direction = `Requesting ${transaction.amount} ${transaction.currency} (offering ${offerAmount} USDT)`;
          }
          
          content = `${direction} on VenmoOTC!${transaction.note ? `\n\n${transaction.note}` : ''}\n\n#DeFi #OTC #Crypto`;
        } else {
          content = `${transaction.fromUser.name} (${transaction.fromUser.handle}) is requesting ${transaction.amount} ${transaction.currency}${transaction.note ? `\n\n${transaction.note}` : ''}\n\n#DeFi #Crypto`;
        }
      } else if (transaction.type === 'PAYMENT') {
        const recipient = transaction.toUser 
          ? `${transaction.toUser.name} (${transaction.toUser.handle})`
          : 'a wallet address';
        
        content = `${transaction.fromUser.name} (${transaction.fromUser.handle}) paid ${transaction.amount} ${transaction.currency} to ${recipient}${transaction.note ? `\n\n${transaction.note}` : ''}\n\n#DeFi #Crypto`;
      }

      if (content.length > 280) {
        content = content.substring(0, 277) + '...';
      }

      return content;
    } catch (error: any) {
      console.error('Error generating tweet content:', error);
      return `${transaction.fromUser.name} (${transaction.fromUser.handle}) created a ${transaction.type} transaction on VenmoOTC! #DeFi #Crypto`;
    }
  }
}

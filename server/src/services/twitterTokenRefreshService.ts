import axios from 'axios';
import { config } from '../config.js';
import { UserRepository } from '../db/repositories/userRepository.js';

// 注意：Twitter OAuth 2.0 的 token 刷新端点可能需要不同的实现
// 这里假设使用标准的 OAuth 2.0 token 刷新流程

/**
 * Twitter Token 刷新服务
 * 管理用户的 Twitter accessToken 自动刷新
 */
export class TwitterTokenRefreshService {
  // 存储每个用户的定时任务
  private static refreshTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * 启动用户的 token 刷新定时任务
   * @param userId 用户 ID
   * @param accessToken 当前的 accessToken
   * @param refreshToken refreshToken（可选）
   * @param expiresIn token 过期时间（秒），默认 2 小时（7200 秒）
   */
  static async startRefreshTimer(
    userId: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn: number = 7200 // 默认 2 小时
  ): Promise<void> {
    // 清除现有的定时任务（如果存在）
    this.stopRefreshTimer(userId);

    // 计算刷新时间：在 token 过期前 30 分钟刷新（1.5 小时 = 5400 秒）
    const refreshDelay = Math.max(5400 * 1000, (expiresIn - 1800) * 1000); // 至少 1.5 小时，或过期前 30 分钟

    console.log(`⏰ 启动 Twitter token 刷新定时任务: userId=${userId}, refreshDelay=${refreshDelay}ms (${refreshDelay / 1000 / 60} 分钟)`);

    const timer = setTimeout(async () => {
      try {
        console.log(`🔄 开始刷新 Twitter token: userId=${userId}`);
        await this.refreshToken(userId, refreshToken);
      } catch (error: any) {
        console.error(`❌ 刷新 Twitter token 失败: userId=${userId}`, error.message);
        // 刷新失败，清除 token，通知前端重新登录
        await this.handleTokenRefreshFailure(userId);
      }
    }, refreshDelay);

    this.refreshTimers.set(userId, timer);

    // 更新数据库中的 token 过期时间
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    try {
      await UserRepository.update(userId, {
        twitterTokenExpiresAt: expiresAt,
        ...(refreshToken && { twitterRefreshToken: refreshToken } as any),
      } as any);
      console.log(`✅ Token 过期时间已更新: userId=${userId}, expiresAt=${new Date(expiresAt * 1000).toISOString()}`);
    } catch (error: any) {
      console.error(`❌ 更新 token 过期时间失败: userId=${userId}`, error.message);
    }
  }

  /**
   * 停止用户的 token 刷新定时任务
   * @param userId 用户 ID
   */
  static stopRefreshTimer(userId: string): void {
    const timer = this.refreshTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.refreshTimers.delete(userId);
      console.log(`⏹️ 停止 Twitter token 刷新定时任务: userId=${userId}`);
    }
  }

  /**
   * 刷新用户的 Twitter accessToken
   * @param userId 用户 ID
   * @param refreshToken refreshToken（如果未提供，从数据库获取）
   */
  static async refreshToken(userId: string, refreshToken?: string): Promise<void> {
    try {
      // 如果没有提供 refreshToken，从数据库获取
      if (!refreshToken) {
        refreshToken = await UserRepository.getTwitterRefreshToken(userId);
      }

      if (!refreshToken) {
        throw new Error('Refresh token not found. User needs to re-authorize.');
      }

      console.log(`🔄 使用 refreshToken 刷新 accessToken: userId=${userId}`);

      // 调用 Twitter OAuth 2.0 token 刷新端点
      const response = await axios.post(
        'https://api.twitter.com/2/oauth2/token',
        new URLSearchParams({
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          client_id: config.twitterOAuth.clientId,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(
              `${config.twitterOAuth.clientId}:${config.twitterOAuth.clientSecret}`
            ).toString('base64')}`,
          },
        }
      );

      const { access_token, refresh_token: newRefreshToken, expires_in } = response.data;

      if (!access_token) {
        throw new Error('Failed to refresh token: no access_token in response');
      }

      console.log(`✅ Token 刷新成功: userId=${userId}, expiresIn=${expires_in}秒`);

      // 更新数据库中的 accessToken 和 refreshToken
      await UserRepository.update(userId, {
        twitterAccessToken: access_token,
        twitterRefreshToken: newRefreshToken || refreshToken,
        twitterTokenExpiresAt: Math.floor(Date.now() / 1000) + (expires_in || 7200),
      } as any);

      // 重新启动定时任务
      await this.startRefreshTimer(userId, access_token, newRefreshToken || refreshToken, expires_in || 7200);

      console.log(`✅ Token 已更新并重新启动刷新定时任务: userId=${userId}`);
    } catch (error: any) {
      console.error(`❌ 刷新 token 失败: userId=${userId}`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 处理 token 刷新失败
   * @param userId 用户 ID
   */
  static async handleTokenRefreshFailure(userId: string): Promise<void> {
    try {
      // 清除数据库中的 token
      await UserRepository.update(userId, {
        twitterAccessToken: null,
        twitterRefreshToken: null,
        twitterTokenExpiresAt: null,
      } as any);

      // 停止定时任务
      this.stopRefreshTimer(userId);

      console.log(`🗑️ 已清除无效的 Twitter token: userId=${userId}`);
      console.log(`📢 用户需要重新登录以更新 accessToken: userId=${userId}`);

      // TODO: 通知前端用户需要重新登录
      // 可以通过 WebSocket 或轮询机制通知前端
    } catch (error: any) {
      console.error(`❌ 处理 token 刷新失败时出错: userId=${userId}`, error.message);
    }
  }

  /**
   * 检查 token 是否过期
   * @param userId 用户 ID
   * @returns 如果 token 过期或即将过期（30 分钟内），返回 true
   */
  static async isTokenExpiredOrExpiringSoon(userId: string): Promise<boolean> {
    try {
      const expiresAt = await UserRepository.getTwitterTokenExpiresAt(userId);
      if (!expiresAt) {
        return true; // 如果没有过期时间，认为已过期
      }

      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = expiresAt - now;
      const thirtyMinutes = 30 * 60; // 30 分钟

      return timeUntilExpiry <= thirtyMinutes;
    } catch (error: any) {
      console.error(`❌ 检查 token 过期时间失败: userId=${userId}`, error.message);
      return true; // 出错时认为已过期
    }
  }

  /**
   * 在发推前检查并刷新 token（如果需要）
   * @param userId 用户 ID
   * @returns 有效的 accessToken
   */
  static async ensureValidToken(userId: string): Promise<string | null> {
    try {
      // 检查 token 是否过期或即将过期
      const isExpired = await this.isTokenExpiredOrExpiringSoon(userId);
      
      if (isExpired) {
        console.log(`🔄 Token 已过期或即将过期，尝试刷新: userId=${userId}`);
        try {
          await this.refreshToken(userId);
        } catch (error: any) {
          console.error(`❌ 刷新 token 失败: userId=${userId}`, error.message);
          // 刷新失败，清除 token
          await this.handleTokenRefreshFailure(userId);
          return null;
        }
      }

      // 获取最新的 accessToken
      const accessToken = await UserRepository.getTwitterAccessToken(userId);
      return accessToken;
    } catch (error: any) {
      console.error(`❌ 确保 token 有效时出错: userId=${userId}`, error.message);
      return null;
    }
  }

  /**
   * 初始化所有用户的 token 刷新定时任务（服务器启动时调用）
   * 为所有有有效 token 的用户启动刷新定时任务
   */
  static async initializeAllRefreshTimers(): Promise<void> {
    try {
      console.log('🔄 初始化所有用户的 Twitter token 刷新定时任务...');
      
      // 查询所有有 Twitter accessToken 的用户
      const { pool } = await import('../db/config.js');
      const [rows] = await pool.execute(
        `SELECT id, twitter_access_token, twitter_refresh_token, twitter_token_expires_at 
         FROM users 
         WHERE twitter_access_token IS NOT NULL 
         AND twitter_access_token != ''`
      );
      const users = rows as any[];
      
      console.log(`📊 找到 ${users.length} 个有 Twitter accessToken 的用户`);
      
      let initializedCount = 0;
      let skippedCount = 0;
      
      for (const user of users) {
        try {
          const userId = user.id;
          const accessToken = user.twitter_access_token;
          const refreshToken = user.twitter_refresh_token || undefined;
          const expiresAt = user.twitter_token_expires_at;
          
          if (!accessToken) {
            continue;
          }
          
          // 计算剩余时间
          let expiresIn = 7200; // 默认 2 小时
          if (expiresAt) {
            const now = Math.floor(Date.now() / 1000);
            const remaining = expiresAt - now;
            
            if (remaining <= 0) {
              // Token 已过期，清除它
              console.log(`⚠️ Token 已过期，清除: userId=${userId}`);
              await UserRepository.update(userId, {
                twitterAccessToken: null,
                twitterRefreshToken: null,
                twitterTokenExpiresAt: null,
              } as any);
              skippedCount++;
              continue;
            }
            
            expiresIn = remaining;
          }
          
          // 启动刷新定时任务
          await this.startRefreshTimer(userId, accessToken, refreshToken, expiresIn);
          initializedCount++;
          console.log(`✅ 已为用户启动刷新定时任务: userId=${userId}, 剩余时间=${Math.floor(expiresIn / 60)}分钟`);
        } catch (error: any) {
          console.error(`❌ 为用户启动刷新定时任务失败: userId=${user.id}`, error.message);
          skippedCount++;
        }
      }
      
      console.log(`✅ Token 刷新定时任务初始化完成: ${initializedCount} 个已启动, ${skippedCount} 个跳过`);
    } catch (error: any) {
      console.error('❌ 初始化 token 刷新定时任务失败:', error.message);
      // 不抛出错误，允许服务器继续启动
    }
  }

  /**
   * 清理所有定时任务（用于服务器关闭时）
   */
  static cleanup(): void {
    console.log('🧹 清理所有 Twitter token 刷新定时任务...');
    for (const [userId, timer] of this.refreshTimers.entries()) {
      clearTimeout(timer);
      console.log(`⏹️ 已停止定时任务: userId=${userId}`);
    }
    this.refreshTimers.clear();
  }
}

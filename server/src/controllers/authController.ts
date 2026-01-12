import { Request, Response } from 'express';
import { LoginResponse } from '../types.js';
import { UserRepository } from '../db/repositories/userRepository.js';
import { generateToken } from '../utils/jwt.js';
import crypto from 'crypto';

/**
 * Privy 登录（同步用户到后端）
 * 这是唯一的登录方式，通过 Privy 钱包登录（支持 Twitter 登录）
 */
export const loginWithPrivy = async (req: Request, res: Response) => {
  try {
    console.log('📥 Privy login request received');
    
    const { walletAddress, handle, name, avatar, privyUserId, twitterAccessToken, twitterRefreshToken } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: { message: 'Wallet address is required' } });
    }
    
    // 查找或创建用户
    let user = await UserRepository.findByWalletAddress(walletAddress);
    const updates: any = {};
    
    if (!user) {
      // 创建新用户
      const userId = crypto.randomUUID();
      let userHandle = handle || `@user_${walletAddress.slice(2, 10)}`;
      
      // 确保 handle 以 @ 开头
      if (!userHandle.startsWith('@')) {
        userHandle = `@${userHandle}`;
      }
      
      // 检查 handle 是否已被使用，如果被使用则生成唯一 handle
      let existingUser = await UserRepository.findByHandle(userHandle);
      if (existingUser) {
        // 如果 handle 已被使用，添加随机后缀生成唯一 handle
        const suffix = Math.random().toString(36).substring(2, 8);
        userHandle = `${userHandle}_${suffix}`;
        console.log(`⚠️ Handle conflict, using new handle: ${userHandle}`);
      }
      
      const userAvatar = avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${walletAddress}`;
      
      try {
        const userData: any = {
          id: userId,
          handle: userHandle,
          name: name || 'User',
          avatar: userAvatar,
          walletAddress,
          isVerified: false,
        };

        if (twitterAccessToken) {
          userData.twitterAccessToken = twitterAccessToken;
          userData.twitterRefreshToken = twitterRefreshToken;
          userData.twitterTokenExpiresAt = Math.floor(Date.now() / 1000) + 7200;
          updates.twitterAccessToken = twitterAccessToken; // 记录以便后面启动定时器
        }

        user = await UserRepository.create(userData);
        console.log(`✅ Created new user from Privy: ${user.handle}`);
      } catch (createError: any) {
        // 如果仍然出现重复键错误（并发情况），使用钱包地址生成唯一 handle
        if (createError.code === 'ER_DUP_ENTRY' || createError.errno === 1062 || createError.message?.includes('Duplicate entry')) {
          console.warn(`⚠️ Handle conflict during creation, generating unique handle from wallet address`);
          userHandle = `@user_${walletAddress.slice(2, 12).toLowerCase()}`;
          
          const fallbackUserData: any = {
            id: userId,
            handle: userHandle,
            name: name || 'User',
            avatar: userAvatar,
            walletAddress,
            isVerified: false,
          };

          if (twitterAccessToken) {
            fallbackUserData.twitterAccessToken = twitterAccessToken;
            fallbackUserData.twitterRefreshToken = twitterRefreshToken;
            fallbackUserData.twitterTokenExpiresAt = Math.floor(Date.now() / 1000) + 7200;
          }

          user = await UserRepository.create(fallbackUserData);
          console.log(`✅ Created new user from Privy with fallback handle: ${user.handle}`);
        } else {
          throw createError;
        }
      }
    } else {
      // 更新用户信息（如果有新的信息）
      if (name && name !== user.name) updates.name = name;
      if (avatar && avatar !== user.avatar) updates.avatar = avatar;
      if (handle && handle !== user.handle) {
        // 确保 handle 以 @ 开头
        let normalizedHandle = handle.startsWith('@') ? handle : `@${handle}`;
        
        // 检查 handle 是否已被其他用户使用
        const existingUser = await UserRepository.findByHandle(normalizedHandle);
        if (!existingUser || existingUser.id === user.id) {
          // 如果 handle 未被使用，或者是当前用户自己的 handle，可以更新
          updates.handle = normalizedHandle;
        } else {
          console.warn(`⚠️ Handle ${normalizedHandle} is already taken by another user, keeping current handle`);
        }
      }
      
    // 如果提供了 Twitter accessToken，更新它（即使之前已存在也要更新，因为可能刷新了）
    // 如果传递空字符串，则清除 accessToken
    if (twitterAccessToken !== undefined) {
      if (twitterAccessToken && twitterAccessToken.trim() !== '') {
        updates.twitterAccessToken = twitterAccessToken;
        updates.twitterRefreshToken = twitterRefreshToken;
        updates.twitterTokenExpiresAt = Math.floor(Date.now() / 1000) + 7200;
        console.log('📝 Twitter accessToken provided, will be stored/updated');
        console.log('🔑 AccessToken (first 30 chars):', twitterAccessToken.substring(0, 30) + '...');
        console.log('🔑 AccessToken length:', twitterAccessToken.length);
        console.log('🔑 AccessToken ends with:', twitterAccessToken.substring(twitterAccessToken.length - 10));
      } else {
        // 传递空字符串或 null，清除 accessToken
        updates.twitterAccessToken = null;
        updates.twitterRefreshToken = null;
        updates.twitterTokenExpiresAt = null;
        console.log('📝 Clearing Twitter accessToken');
      }
    }
      
      if (Object.keys(updates).length > 0) {
        try {
          console.log('📝 Updating user with:', {
            hasTwitterToken: !!(updates as any).twitterAccessToken,
            twitterTokenLength: (updates as any).twitterAccessToken?.length || 0,
            otherFields: Object.keys(updates).filter(k => k !== 'twitterAccessToken'),
          });
          
          await UserRepository.update(user.id, updates);
          user = await UserRepository.findById(user.id);
          console.log(`✅ Updated user from Privy: ${user?.handle}`);
          
          // 验证 Twitter accessToken 是否已存储
          if ((updates as any).twitterAccessToken) {
            const { UserRepository: UR } = await import('../db/repositories/userRepository.js');
            
            // 等待一小段时间，确保数据库写入完成
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const storedToken = await UR.getTwitterAccessToken(user.id);
            if (storedToken) {
              console.log('✅ Verified: Twitter accessToken stored successfully');
              console.log('✅ User ID:', user.id);
              console.log('✅ Stored token length:', storedToken.length);
              console.log('✅ Stored token preview:', storedToken.substring(0, 30) + '...');
              console.log('✅ Stored token ends with:', storedToken.substring(storedToken.length - 10));
            } else {
              console.error('❌ ERROR: Twitter accessToken was NOT stored correctly!');
              console.error('❌ User ID:', user.id);
              console.error('❌ User handle:', user.handle);
              console.error('❌ User wallet address:', user.walletAddress);
              console.error('❌ Expected token length:', (updates as any).twitterAccessToken?.length);
              console.error('❌ Expected token preview:', (updates as any).twitterAccessToken?.substring(0, 30) + '...');
              
              // 尝试直接查询数据库
              try {
                const { pool } = await import('../db/config.js');
                const [rows] = await pool.execute(
                  'SELECT id, handle, twitter_access_token FROM users WHERE id = ?',
                  [user.id]
                );
                const result = rows as any[];
                console.error('❌ Direct database query:', {
                  userId: user.id,
                  rowCount: result.length,
                  hasToken: !!result[0]?.twitter_access_token,
                  tokenValue: result[0]?.twitter_access_token || null,
                });
              } catch (dbError: any) {
                console.error('❌ Failed to query database directly:', dbError.message);
              }
            }
          }
        } catch (updateError: any) {
          // 如果更新时出现重复键错误，忽略 handle 更新
          if (updateError.code === 'ER_DUP_ENTRY' || updateError.errno === 1062 || updateError.message?.includes('Duplicate entry')) {
            console.warn(`⚠️ Handle conflict during update, skipping handle update`);
            if (updates.handle) {
              delete updates.handle;
              if (Object.keys(updates).length > 0) {
                await UserRepository.update(user.id, updates);
                user = await UserRepository.findById(user.id);
                console.log(`✅ Updated user from Privy (without handle): ${user?.handle}`);
              }
            }
          } else {
            throw updateError;
          }
        }
      }
    }
    
    if (!user) {
      return res.status(500).json({ error: { message: 'Failed to create or find user' } });
    }
    
    // 生成 JWT token
    const token = generateToken({
      userId: user.id,
      handle: user.handle,
      walletAddress: user.walletAddress,
    });
    
    const response: LoginResponse = {
      user: user,
      token: token,
    };
    
    // 如果用户有 Twitter accessToken，启动 token 刷新定时任务
    if ((updates as any).twitterAccessToken) {
      try {
        const { TwitterTokenRefreshService } = await import('../services/twitterTokenRefreshService.js');
        const { twitterRefreshToken } = req.body;
        
        // 启动刷新定时任务（默认 2 小时过期）
        await TwitterTokenRefreshService.startRefreshTimer(
          user.id,
          (updates as any).twitterAccessToken,
          twitterRefreshToken,
          7200 // 默认 2 小时
        );
        console.log(`✅ Twitter token 刷新定时任务已启动: userId=${user.id}`);
      } catch (error: any) {
        console.error('❌ 启动 Twitter token 刷新定时任务失败:', error.message);
        // 不阻止登录，只是记录错误
      }
    }

    console.log('📤 Sending Privy login response:', JSON.stringify({ 
      user: { 
        id: user.id, 
        handle: user.handle,
        walletAddress: user.walletAddress,
      }, 
      token: 'JWT_TOKEN_GENERATED',
      jwtPayload: {
        userId: user.id,
        handle: user.handle,
        walletAddress: user.walletAddress,
      }
    }));
    res.json(response);
  } catch (error: any) {
    console.error('❌ Privy login error:', error);
    res.status(500).json({ error: { message: error.message || 'Privy login failed' } });
  }
};

/**
 * 登出
 */
export const logout = async (req: Request, res: Response) => {
  try {
    // TODO: 撤销 token，清理会话等
    console.log('🔓 Logging out...');
    res.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ error: error.message || 'Logout failed' });
  }
};


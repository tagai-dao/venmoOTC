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
    
    const { walletAddress, handle, name, avatar, privyUserId, twitterAccessToken } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: { message: 'Wallet address is required' } });
    }
    
    // 查找或创建用户
    let user = await UserRepository.findByWalletAddress(walletAddress);
    
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
        user = await UserRepository.create({
          id: userId,
          handle: userHandle,
          name: name || 'User',
          avatar: userAvatar,
          walletAddress,
          isVerified: false,
          ...(twitterAccessToken && { twitterAccessToken } as any),
        });
        console.log(`✅ Created new user from Privy: ${user.handle}`);
      } catch (createError: any) {
        // 如果仍然出现重复键错误（并发情况），使用钱包地址生成唯一 handle
        if (createError.code === 'ER_DUP_ENTRY' || createError.errno === 1062 || createError.message?.includes('Duplicate entry')) {
          console.warn(`⚠️ Handle conflict during creation, generating unique handle from wallet address`);
          userHandle = `@user_${walletAddress.slice(2, 12).toLowerCase()}`;
          user = await UserRepository.create({
            id: userId,
            handle: userHandle,
            name: name || 'User',
            avatar: userAvatar,
            walletAddress,
            isVerified: false,
          });
          console.log(`✅ Created new user from Privy with fallback handle: ${user.handle}`);
        } else {
          throw createError;
        }
      }
    } else {
      // 更新用户信息（如果有新的信息）
      const updates: any = {};
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
        console.log('📝 Twitter accessToken provided, will be stored/updated');
        console.log('🔑 AccessToken (first 30 chars):', twitterAccessToken.substring(0, 30) + '...');
        console.log('🔑 AccessToken length:', twitterAccessToken.length);
        console.log('🔑 AccessToken ends with:', twitterAccessToken.substring(twitterAccessToken.length - 10));
      } else {
        // 传递空字符串或 null，清除 accessToken
        updates.twitterAccessToken = null;
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
            const storedToken = await UR.getTwitterAccessToken(user.id);
            if (storedToken) {
              console.log('✅ Verified: Twitter accessToken stored successfully');
            } else {
              console.warn('⚠️ Warning: Twitter accessToken was not stored correctly');
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
    
    console.log('📤 Sending Privy login response:', JSON.stringify({ user: { id: user.id, handle: user.handle }, token: 'JWT_TOKEN_GENERATED' }));
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


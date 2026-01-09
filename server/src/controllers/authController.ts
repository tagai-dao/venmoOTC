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
    
    const { walletAddress, handle, name, avatar, privyUserId } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: { message: 'Wallet address is required' } });
    }
    
    // 查找或创建用户
    let user = await UserRepository.findByWalletAddress(walletAddress);
    
    if (!user) {
      // 创建新用户
      const userId = crypto.randomUUID();
      const userHandle = handle || `@user_${walletAddress.slice(2, 10)}`;
      const userAvatar = avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${walletAddress}`;
      
      user = await UserRepository.create({
        id: userId,
        handle: userHandle,
        name: name || 'User',
        avatar: userAvatar,
        walletAddress,
        isVerified: false,
      });
      
      console.log(`✅ Created new user from Privy: ${user.handle}`);
    } else {
      // 更新用户信息（如果有新的信息）
      const updates: any = {};
      if (name && name !== user.name) updates.name = name;
      if (avatar && avatar !== user.avatar) updates.avatar = avatar;
      if (handle && handle !== user.handle) {
        // 检查 handle 是否已被使用
        const existingUser = await UserRepository.findByHandle(handle);
        if (!existingUser) {
          updates.handle = handle;
        }
      }
      
      if (Object.keys(updates).length > 0) {
        await UserRepository.update(user.id, updates);
        user = await UserRepository.findById(user.id);
        console.log(`✅ Updated user from Privy: ${user?.handle}`);
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


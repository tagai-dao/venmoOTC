import { Request, Response } from 'express';
import { LoginRequest, LoginResponse } from '../types.js';
import { UserRepository } from '../db/repositories/userRepository.js';
import { generateToken } from '../utils/jwt.js';

/**
 * X (Twitter) 登录
 * 使用数据库查询用户信息
 * 支持通过 X handle 登录（测试用）
 */
export const loginWithX = async (req: Request, res: Response) => {
  try {
    console.log('📥 Login request received:', JSON.stringify(req.body));
    
    const { xToken, xTokenSecret, xHandle } = req.body as LoginRequest & { xHandle?: string };
    
    // 模拟登录过程
    console.log('🔗 Connecting to Privy...');
    console.log('🐦 Authenticating with X (Twitter)...');
    console.log('📝 xHandle received:', xHandle);
    
    // 模拟 API 延迟
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    let user = null;
    
    // 如果提供了 xHandle，尝试根据 handle 查找用户
    if (xHandle) {
      const handle = xHandle.startsWith('@') ? xHandle : `@${xHandle}`;
      user = await UserRepository.findByHandle(handle);
      
      if (user) {
        console.log(`✅ Found user with handle: ${handle}`);
      } else {
        console.log(`⚠️ User not found with handle: ${handle}`);
        // 如果找不到用户，返回错误
        return res.status(404).json({ error: { message: `User with handle ${handle} not found` } });
      }
    } else {
      // 如果没有提供 handle，尝试获取第一个用户（用于测试）
      const allUsers = await UserRepository.findAll();
      if (allUsers.length > 0) {
        user = allUsers[0];
        console.log(`✅ Using default user: ${user.handle}`);
      } else {
        return res.status(404).json({ error: { message: 'No users found in database' } });
      }
    }
    
    console.log('✅ Privy Wallet Created: ' + user.walletAddress);
    
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
    
    console.log('📤 Sending login response:', JSON.stringify({ user: { id: user.id, handle: user.handle }, token: 'JWT_TOKEN_GENERATED' }));
    res.json(response);
  } catch (error: any) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: { message: error.message || 'Login failed' } });
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


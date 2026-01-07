import { Request, Response } from 'express';
import { LoginRequest, LoginResponse } from '../types.js';
import { mockUsers } from '../mockData.js';

/**
 * X (Twitter) 登录
 * 使用 Mock 数据返回用户信息
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
    
    let mockUser = mockUsers[0]; // 默认返回第一个用户
    
    // 如果提供了 xHandle，尝试根据 handle 查找用户
    if (xHandle) {
      const handle = xHandle.startsWith('@') ? xHandle : `@${xHandle}`;
      const foundUser = mockUsers.find(u => u.handle.toLowerCase() === handle.toLowerCase());
      
      if (foundUser) {
        mockUser = foundUser;
        console.log(`✅ Found user with handle: ${handle}`);
      } else {
        console.log(`⚠️ User not found with handle: ${handle}, using default user`);
        // 即使找不到用户，也返回默认用户，不返回错误
      }
    }
    
    console.log('✅ Privy Wallet Created: ' + mockUser.walletAddress);
    
    const response: LoginResponse = {
      user: mockUser,
      token: 'mock_jwt_token_' + Date.now(), // Mock JWT token
    };
    
    console.log('📤 Sending login response:', JSON.stringify({ user: { id: mockUser.id, handle: mockUser.handle }, token: response.token }));
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


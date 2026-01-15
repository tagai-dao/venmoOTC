import { Context } from 'hono';
import { D1Adapter } from '../db/d1Adapter.js';
import { UserRepository } from '../db/repositories/userRepository.js';
import { AuthContext } from '../middleware/auth.js';
import { Env } from '../types.js';

/**
 * 获取用户列表
 */
export const getUsers = async (c: Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const search = c.req.query('search');
    const verified = c.req.query('verified');
    
    const searchStr = search ? String(search) : undefined;
    const verifiedBool = verified === 'true' ? true : verified === 'false' ? false : undefined;
    
    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const users = await userRepo.findAll(searchStr, verifiedBool);
    
    return c.json({ users });
  } catch (error: any) {
    console.error('Get users error:', error);
    return c.json({ error: error.message || 'Failed to get users' }, 500);
  }
};

/**
 * 获取当前用户信息（需要认证）
 */
export const getCurrentUser = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const userId = c.user?.userId;
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const user = await userRepo.findById(userId);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    // 检查是否有 Twitter accessToken（不返回 token 本身，只返回状态）
    const hasTwitterToken = !!(await userRepo.getTwitterAccessToken(userId));
    
    return c.json({ 
      user,
      twitterAuth: {
        hasAccessToken: hasTwitterToken,
      }
    });
  } catch (error: any) {
    console.error('Get current user error:', error);
    return c.json({ error: error.message || 'Failed to get current user' }, 500);
  }
};

/**
 * 获取用户信息
 */
export const getUser = async (c: Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const id = c.req.param('id');
    
    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const user = await userRepo.findById(id);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    return c.json({ user });
  } catch (error: any) {
    console.error('Get user error:', error);
    return c.json({ error: error.message || 'Failed to get user' }, 500);
  }
};

/**
 * 更新当前用户信息（需要认证）
 */
export const updateCurrentUser = async (c: AuthContext & Context<{ Bindings: Env }>): Promise<Response> => {
  try {
    const userId = c.user?.userId;
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const body = await c.req.json();
    const { fiatDetails } = body;
    
    if (!fiatDetails) {
      return c.json({ error: 'fiatDetails is required' }, 400);
    }
    
    const db = new D1Adapter(c.env.DB);
    const userRepo = new UserRepository(db);
    const updatedUser = await userRepo.update(userId, {
      fiatDetails: {
        bankName: fiatDetails.bankName,
        accountNumber: fiatDetails.accountNumber,
        accountName: fiatDetails.accountName,
        country: fiatDetails.country,
      }
    });
    
    if (!updatedUser) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    return c.json({ user: updatedUser });
  } catch (error: any) {
    console.error('Update current user error:', error);
    return c.json({ error: error.message || 'Failed to update user' }, 500);
  }
};

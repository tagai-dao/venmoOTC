import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { UserRepository } from '../db/repositories/userRepository.js';

/**
 * 获取用户列表
 */
export const getUsers = async (req: Request, res: Response) => {
  try {
    const { search, verified } = req.query;
    
    const searchStr = search ? String(search) : undefined;
    const verifiedBool = verified === 'true' ? true : verified === 'false' ? false : undefined;
    
    const users = await UserRepository.findAll(searchStr, verifiedBool);
    
    res.json({ users });
  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({ error: error.message || 'Failed to get users' });
  }
};

/**
 * 获取当前用户信息（需要认证）
 */
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const user = await UserRepository.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // 检查是否有 Twitter accessToken（不返回 token 本身，只返回状态）
    const { UserRepository: UR } = await import('../db/repositories/userRepository.js');
    const hasTwitterToken = !!(await UR.getTwitterAccessToken(userId));
    
    res.json({ 
      user,
      twitterAuth: {
        hasAccessToken: hasTwitterToken,
      }
    });
  } catch (error: any) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: error.message || 'Failed to get current user' });
  }
};

/**
 * 获取用户信息
 */
export const getUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const user = await UserRepository.findById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message || 'Failed to get user' });
  }
};

/**
 * 更新当前用户信息（需要认证）
 */
export const updateCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { fiatDetails } = req.body;
    
    if (!fiatDetails) {
      return res.status(400).json({ error: 'fiatDetails is required' });
    }
    
    const updatedUser = await UserRepository.update(userId, {
      fiatDetails: {
        bankName: fiatDetails.bankName,
        accountNumber: fiatDetails.accountNumber,
        accountName: fiatDetails.accountName,
        country: fiatDetails.country,
      }
    });
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: updatedUser });
  } catch (error: any) {
    console.error('Update current user error:', error);
    res.status(500).json({ error: error.message || 'Failed to update user' });
  }
};


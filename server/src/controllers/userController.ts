import { Request, Response } from 'express';
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


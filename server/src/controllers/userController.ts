import { Request, Response } from 'express';
import { mockUsers } from '../mockData.js';

// 使用 mock 数据（生产环境应使用数据库）
const users = mockUsers;

/**
 * 获取用户列表
 */
export const getUsers = async (req: Request, res: Response) => {
  try {
    const { search, verified } = req.query;
    
    let filteredUsers = [...users];
    
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredUsers = filteredUsers.filter(
        u => u.name.toLowerCase().includes(searchLower) || 
             u.handle.toLowerCase().includes(searchLower)
      );
    }
    
    if (verified === 'true') {
      filteredUsers = filteredUsers.filter(u => u.isVerified);
    }
    
    res.json({ users: filteredUsers });
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
    
    const user = users.find(u => u.id === id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message || 'Failed to get user' });
  }
};


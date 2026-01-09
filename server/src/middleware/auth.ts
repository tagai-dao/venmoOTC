import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt.js';

/**
 * 扩展 Express Request 类型，添加 user 属性
 */
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    handle: string;
    walletAddress: string;
  };
}

/**
 * JWT 认证中间件
 * 验证请求头中的 Authorization token
 */
export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      res.status(401).json({ error: { message: 'No token provided' } });
      return;
    }
    
    try {
      const payload = verifyToken(token);
      // 将用户信息附加到请求对象
      req.user = payload;
      next();
    } catch (error: any) {
      console.error('Token verification failed:', error.message);
      res.status(401).json({ error: { message: error.message || 'Invalid or expired token' } });
      return;
    }
  } catch (error: any) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ error: { message: 'Authentication failed' } });
    return;
  }
};

/**
 * 可选的认证中间件
 * 如果有 token 就验证，没有 token 也允许通过（用于公开接口）
 */
export const optionalAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    
    if (token) {
      try {
        const payload = verifyToken(token);
        req.user = payload;
      } catch (error) {
        // token 无效，但不阻止请求继续
        console.warn('Optional auth: Invalid token, continuing without authentication');
      }
    }
    
    next();
  } catch (error) {
    // 出错也继续，不影响请求
    next();
  }
};

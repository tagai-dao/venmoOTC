import { Context, Next } from 'hono';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt.js';
import { Env } from '../types.js';

/**
 * 扩展 Hono Context 类型，添加 user 属性
 */
export interface AuthContext extends Context {
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
export const authenticateToken = async (
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<Response | void> => {
  try {
    const authHeader = c.req.header('authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return c.json({ error: { message: 'No token provided' } }, 401);
    }
    
    try {
      const payload = verifyToken(token, c.env.JWT_SECRET);
      // 将用户信息附加到 context
      (c as AuthContext).user = payload;
      await next();
    } catch (error: any) {
      console.error('Token verification failed:', error.message);
      return c.json({ error: { message: error.message || 'Invalid or expired token' } }, 401);
    }
  } catch (error: any) {
    console.error('Authentication middleware error:', error);
    return c.json({ error: { message: 'Authentication failed' } }, 500);
  }
};

/**
 * 可选的认证中间件
 * 如果有 token 就验证，没有 token 也允许通过（用于公开接口）
 */
export const optionalAuth = async (
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<Response | void> => {
  try {
    const authHeader = c.req.header('authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (token) {
      try {
        const payload = verifyToken(token, c.env.JWT_SECRET);
        (c as AuthContext).user = payload;
      } catch (error) {
        // token 无效，但不阻止请求继续
        console.warn('Optional auth: Invalid token, continuing without authentication');
      }
    }
    
    await next();
  } catch (error) {
    // 出错也继续，不影响请求
    await next();
  }
};

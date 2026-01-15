import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  handle: string;
  walletAddress: string;
}

/**
 * 生成 JWT token
 */
export const generateToken = (payload: JWTPayload, secret: string, expiresIn: string = '7d'): string => {
  return jwt.sign(payload, secret, {
    expiresIn,
  } as jwt.SignOptions);
};

/**
 * 验证 JWT token
 */
export const verifyToken = (token: string, secret: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;
    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw new Error('Token verification failed');
  }
};

/**
 * 从请求头中提取 token
 */
export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) {
    return null;
  }
  
  // 支持 "Bearer <token>" 格式
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }
  
  return null;
};

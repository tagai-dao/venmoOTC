import crypto from 'crypto';

/**
 * 生成随机字符串
 */
export function generateRandomString(length: number): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * 生成 code_verifier（用于 PKCE）
 */
export function generateCodeVerifier(): string {
  return generateRandomString(32);
}

/**
 * 生成 code_challenge（用于 PKCE）
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

/**
 * 生成 state 参数（用于防止 CSRF 攻击）
 */
export function generateState(): string {
  return generateRandomString(32);
}

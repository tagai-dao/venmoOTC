import { Request, Response } from 'express';
import { LoginRequest, LoginResponse } from '../types.js';
import { UserRepository } from '../db/repositories/userRepository.js';
import { generateToken } from '../utils/jwt.js';
import { config } from '../config.js';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../utils/oauth.js';
import axios from 'axios';
import crypto from 'crypto';

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
 * Twitter OAuth 2.0 授权端点
 * 生成授权 URL 并重定向到 Twitter
 */
export const twitterAuthorize = async (req: Request, res: Response) => {
  try {
    const { clientId, redirectUri, scope } = config.twitterOAuth;
    
    if (!clientId) {
      return res.status(500).json({ error: { message: 'Twitter OAuth not configured. Please set TWITTER_CLIENT_ID in environment variables.' } });
    }
    
    // 生成 PKCE 参数
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();
    
    // 存储 code_verifier 和 state 到 session（这里简化处理，实际应该使用 Redis 或数据库）
    // 为了简化，我们将 code_verifier 编码到 state 中（不安全，仅用于演示）
    // 实际生产环境应该使用 session 或 Redis
    const stateWithVerifier = Buffer.from(JSON.stringify({ state, codeVerifier })).toString('base64url');
    
    // 构建授权 URL
    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', stateWithVerifier);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    
    console.log('🔗 Redirecting to Twitter OAuth:', authUrl.toString());
    
    // 重定向到 Twitter 授权页面
    res.redirect(authUrl.toString());
  } catch (error: any) {
    console.error('Twitter authorize error:', error);
    res.status(500).json({ error: { message: error.message || 'Failed to initiate Twitter OAuth' } });
  }
};

/**
 * Twitter OAuth 2.0 回调端点
 * 处理授权码，获取 access token 和用户信息
 */
export const twitterCallback = async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      console.error('Twitter OAuth error:', error);
      return res.redirect(`${config.frontendUrl}?error=${encodeURIComponent(error as string)}`);
    }
    
    if (!code || !state) {
      return res.redirect(`${config.frontendUrl}?error=missing_code_or_state`);
    }
    
    // 从 state 中恢复 code_verifier
    let codeVerifier: string;
    try {
      const stateData = JSON.parse(Buffer.from(state as string, 'base64url').toString());
      codeVerifier = stateData.codeVerifier;
    } catch (e) {
      return res.redirect(`${config.frontendUrl}?error=invalid_state`);
    }
    
    const { clientId, clientSecret, redirectUri } = config.twitterOAuth;
    
    // 1. 用授权码换取 access token
    const tokenResponse = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      new URLSearchParams({
        code: code as string,
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
      }
    );
    
    const { access_token, refresh_token } = tokenResponse.data;
    
    if (!access_token) {
      throw new Error('Failed to get access token from Twitter');
    }
    
    // 2. 使用 access token 获取用户信息
    const userResponse = await axios.get('https://api.twitter.com/2/users/me', {
      params: {
        'user.fields': 'id,name,username,profile_image_url,verified',
      },
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });
    
    const twitterUser = userResponse.data.data;
    
    if (!twitterUser) {
      throw new Error('Failed to get user info from Twitter');
    }
    
    // 3. 查找或创建用户
    const handle = `@${twitterUser.username}`;
    let user = await UserRepository.findByHandle(handle);
    
    if (!user) {
      // 创建新用户
      // 生成钱包地址（模拟）
      const walletAddress = `0x${crypto.randomBytes(20).toString('hex')}`;
      
      // 生成用户 ID
      const userId = crypto.randomUUID();
      
      user = await UserRepository.create({
        id: userId,
        handle,
        name: twitterUser.name || twitterUser.username,
        avatar: twitterUser.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${twitterUser.username}`,
        walletAddress,
        isVerified: twitterUser.verified || false,
      });
      
      console.log(`✅ Created new user: ${handle}`);
    } else {
      // 更新用户信息（头像、验证状态等）
      if (twitterUser.profile_image_url && twitterUser.profile_image_url !== user.avatar) {
        await UserRepository.update(user.id, {
          avatar: twitterUser.profile_image_url,
          isVerified: twitterUser.verified || false,
        });
        user.avatar = twitterUser.profile_image_url;
        user.isVerified = twitterUser.verified || false;
      }
      
      console.log(`✅ Found existing user: ${handle}`);
    }
    
    // 4. 生成 JWT token
    const token = generateToken({
      userId: user.id,
      handle: user.handle,
      walletAddress: user.walletAddress,
    });
    
    // 5. 重定向到前端，带上 token 和用户信息
    // 注意：URL 参数有长度限制，如果用户信息太大，可能需要使用其他方式传递
    const frontendUrl = new URL(config.frontendUrl);
    frontendUrl.searchParams.set('token', token);
    frontendUrl.searchParams.set('user', JSON.stringify(user));
    
    console.log('✅ Twitter OAuth successful');
    console.log('📤 Redirecting to frontend:', frontendUrl.toString());
    console.log('👤 User:', user.handle);
    
    res.redirect(frontendUrl.toString());
  } catch (error: any) {
    console.error('Twitter callback error:', error);
    const errorMessage = error.response?.data?.error_description || error.message || 'OAuth callback failed';
    res.redirect(`${config.frontendUrl}?error=${encodeURIComponent(errorMessage)}`);
  }
};

/**
 * Privy 登录（同步用户到后端）
 */
export const loginWithPrivy = async (req: Request, res: Response) => {
  try {
    console.log('📥 Privy login request received');
    
    const { walletAddress, handle, name, avatar, privyUserId } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: { message: 'Wallet address is required' } });
    }
    
    // 查找或创建用户
    let user = await UserRepository.findByWalletAddress(walletAddress);
    
    if (!user) {
      // 创建新用户
      const userId = crypto.randomUUID();
      const userHandle = handle || `@user_${walletAddress.slice(2, 10)}`;
      const userAvatar = avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${walletAddress}`;
      
      user = await UserRepository.create({
        id: userId,
        handle: userHandle,
        name: name || 'User',
        avatar: userAvatar,
        walletAddress,
        isVerified: false,
      });
      
      console.log(`✅ Created new user from Privy: ${user.handle}`);
    } else {
      // 更新用户信息（如果有新的信息）
      const updates: any = {};
      if (name && name !== user.name) updates.name = name;
      if (avatar && avatar !== user.avatar) updates.avatar = avatar;
      if (handle && handle !== user.handle) {
        // 检查 handle 是否已被使用
        const existingUser = await UserRepository.findByHandle(handle);
        if (!existingUser) {
          updates.handle = handle;
        }
      }
      
      if (Object.keys(updates).length > 0) {
        await UserRepository.update(user.id, updates);
        user = await UserRepository.findById(user.id);
        console.log(`✅ Updated user from Privy: ${user?.handle}`);
      }
    }
    
    if (!user) {
      return res.status(500).json({ error: { message: 'Failed to create or find user' } });
    }
    
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
    
    console.log('📤 Sending Privy login response:', JSON.stringify({ user: { id: user.id, handle: user.handle }, token: 'JWT_TOKEN_GENERATED' }));
    res.json(response);
  } catch (error: any) {
    console.error('❌ Privy login error:', error);
    res.status(500).json({ error: { message: error.message || 'Privy login failed' } });
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


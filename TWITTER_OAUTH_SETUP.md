# Twitter OAuth 2.0 授权登录配置指南

## 概述

本项目已实现 Twitter OAuth 2.0 授权登录功能，用户可以通过 Twitter 账号直接登录应用。

## 配置步骤

### 1. 在 Twitter Developer Portal 创建应用

1. 访问 [Twitter Developer Portal](https://developer.twitter.com/en/portal)
2. 创建新应用或使用现有应用
3. 获取以下信息：
   - **Client ID** (OAuth 2.0 Client ID)
   - **Client Secret** (OAuth 2.0 Client Secret)

### 2. 配置回调 URL

在 Twitter Developer Portal 中，设置以下回调 URL：
- `http://localhost:3001/api/auth/twitter/callback` (开发环境)
- `https://yourdomain.com/api/auth/twitter/callback` (生产环境)

### 3. 配置环境变量

在 `server/` 目录下创建 `.env` 文件（如果不存在），添加以下配置：

```env
# Twitter OAuth 2.0
TWITTER_CLIENT_ID=your_twitter_client_id_here
TWITTER_CLIENT_SECRET=your_twitter_client_secret_here
TWITTER_REDIRECT_URI=http://localhost:3001/api/auth/twitter/callback

# 前端 URL（用于 OAuth 回调后重定向）
FRONTEND_URL=http://localhost:3000
```

### 4. 启动服务

1. 启动后端服务：
```bash
cd server
npm run dev
```

2. 启动前端服务：
```bash
npm run dev
```

## 使用流程

1. 用户点击"使用 Twitter 登录"按钮
2. 重定向到 Twitter 授权页面
3. 用户在 Twitter 授权后，Twitter 回调到后端
4. 后端获取用户信息，创建或更新用户记录
5. 后端生成 JWT token，重定向回前端
6. 前端自动完成登录

## API 端点

### GET /api/auth/twitter/authorize
生成 Twitter OAuth 授权 URL 并重定向到 Twitter。

### GET /api/auth/twitter/callback
处理 Twitter OAuth 回调：
- 接收授权码
- 用授权码换取 access token
- 获取用户信息
- 创建或更新用户
- 生成 JWT token
- 重定向到前端

## 注意事项

1. **安全性**：
   - 确保 `TWITTER_CLIENT_SECRET` 不要泄露
   - 生产环境使用 HTTPS
   - 定期更新 JWT secret

2. **回调 URL**：
   - 回调 URL 必须与 Twitter Developer Portal 中配置的完全一致
   - 开发和生产环境需要分别配置

3. **用户创建**：
   - 首次登录的用户会自动创建账户
   - 系统会为每个用户生成一个模拟钱包地址
   - 用户信息（头像、验证状态等）会自动同步

4. **测试模式**：
   - 应用仍保留通过 handle 登录的测试模式
   - 生产环境建议禁用测试模式

## 故障排除

### 错误：`Twitter OAuth not configured`
- 检查 `.env` 文件中是否配置了 `TWITTER_CLIENT_ID`

### 错误：`redirect_uri_mismatch`
- 检查 Twitter Developer Portal 中的回调 URL 配置
- 确保与 `.env` 中的 `TWITTER_REDIRECT_URI` 完全一致

### 错误：`invalid_client`
- 检查 `TWITTER_CLIENT_ID` 和 `TWITTER_CLIENT_SECRET` 是否正确

### 登录后没有自动跳转
- 检查 `FRONTEND_URL` 配置是否正确
- 检查浏览器控制台是否有错误信息

## 技术实现

- **OAuth 2.0 流程**：使用 PKCE (Proof Key for Code Exchange) 增强安全性
- **JWT 认证**：登录成功后生成 JWT token 用于后续 API 请求
- **用户管理**：自动创建新用户，同步 Twitter 用户信息

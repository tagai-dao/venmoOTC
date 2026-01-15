# Privy 登录配置指南

## 概述

本项目已集成 Privy 登录功能，支持通过 Twitter、Email、SMS 等方式登录，并自动生成 EVM 钱包。

## 配置步骤

### 1. 获取 Privy App ID

1. 访问 [Privy Dashboard](https://dashboard.privy.io/)
2. 创建应用或选择现有应用
3. 在应用设置中获取 **App ID**

### 2. 配置环境变量

在项目根目录创建 `.env` 文件（如果不存在），添加：

```env
VITE_PRIVY_APP_ID=你的_privy_app_id
```

或者在 `vite.config.ts` 中配置。

### 3. 配置 Privy Dashboard 回调 URL（重要！）

**这是解决 "Something went wrong" 错误的关键步骤：**

1. 访问 [Privy Dashboard](https://dashboard.privy.io/)
2. 选择您的应用
3. 进入 **Settings** > **Redirect URIs**
4. 添加以下回调 URL（**必须全部添加**）：
   - `http://localhost:3000` （开发环境 - localhost）
   - `http://localhost:3000/` （带斜杠）
   - `http://127.0.0.1:3000` （开发环境 - 127.0.0.1）
   - `http://127.0.0.1:3000/` （带斜杠）
   - 如果部署到生产环境，添加生产环境的 URL

**重要提示**：
- 回调 URL 必须完全匹配，包括协议（http/https）、端口号和路径
- `localhost` 和 `127.0.0.1` 被视为不同的域名，必须分别配置
- 如果用户通过 `http://127.0.0.1:3000` 访问，但只配置了 `localhost`，登录会失败

### 4. 配置 Twitter OAuth（可选）

如果要在 Privy 中使用 Twitter 登录：

1. 在 Privy Dashboard 中进入 **Settings** > **OAuth Providers**
2. 启用 **Twitter** 登录方式
3. 输入 Twitter Client ID 和 Client Secret（需要在 [Twitter Developer Portal](https://developer.twitter.com/) 创建应用）
4. 在 Twitter Developer Portal 中配置回调 URL：
   - Privy 会提供一个回调 URL（格式类似：`https://auth.privy.io/api/v1/oauth/twitter/callback`）
   - 将这个 URL 添加到 Twitter 应用的回调 URL 列表中

### 4. 启动应用

```bash
npm run dev
```

## 功能说明

### Privy 登录流程

1. 用户点击"使用 Privy 登录（生成钱包）"按钮
2. Privy 弹出登录模态框，用户可以选择：
   - Twitter 登录
   - Email 登录
   - SMS 登录
   - 连接现有钱包
3. 登录成功后，Privy 自动为用户创建嵌入式钱包（如果用户没有钱包）
4. 前端获取钱包地址，同步到后端
5. 后端创建或更新用户记录，生成 JWT token
6. 用户完成登录

### 钱包生成

- Privy 会自动为没有钱包的用户创建嵌入式钱包
- 钱包地址会自动同步到后端数据库
- 用户可以使用这个钱包进行交易

### 支持的链

当前配置支持 BSC (Binance Smart Chain)：
- Chain ID: 56
- RPC URL: https://bsc-dataseed.binance.org/
- 原生代币: BNB

## API 端点

### POST /api/auth/privy

同步 Privy 用户到后端。

**请求体：**
```json
{
  "walletAddress": "0x...",
  "handle": "@username",
  "name": "User Name",
  "avatar": "https://...",
  "privyUserId": "privy_user_id"
}
```

**响应：**
```json
{
  "user": {
    "id": "...",
    "handle": "@username",
    "name": "User Name",
    "walletAddress": "0x...",
    ...
  },
  "token": "jwt_token"
}
```

## 注意事项

1. **环境变量**：确保 `VITE_PRIVY_APP_ID` 已正确配置
2. **Privy Dashboard**：确保在 Privy Dashboard 中配置了正确的回调 URL
3. **Twitter OAuth**：如果使用 Twitter 登录，需要在 Privy Dashboard 中配置 Twitter OAuth
4. **钱包安全**：Privy 的嵌入式钱包由 Privy 管理，用户无需管理私钥

## 故障排除

### 错误：Privy App ID 未配置
- 检查 `.env` 文件中是否设置了 `VITE_PRIVY_APP_ID`
- 重启开发服务器

### 错误：Something went wrong / You weren't able to give access to the App

这是最常见的错误，通常由以下原因引起：

1. **回调 URL 未配置**：
   - 进入 Privy Dashboard > Settings > Redirect URIs
   - 确保添加了 `http://localhost:3000` 和 `http://localhost:3000/`
   - 保存后等待几秒钟让配置生效

2. **Twitter OAuth 配置错误**（如果使用 Twitter 登录）：
   - 检查 Privy Dashboard 中的 Twitter OAuth 配置
   - 确认 Twitter Client ID 和 Secret 正确
   - 确保 Twitter 应用的回调 URL 包含 Privy 提供的回调 URL

3. **环境变量未生效**：
   - 确保 `.env` 文件在项目根目录
   - 确保 `VITE_PRIVY_APP_ID` 值正确（没有多余空格）
   - **重启开发服务器**（修改环境变量后必须重启）

4. **浏览器缓存问题**：
   - 清除浏览器缓存
   - 尝试使用隐私/无痕模式
   - 检查浏览器控制台的错误信息

### 错误：Twitter 登录失败
- 检查 Privy Dashboard 中的 Twitter OAuth 配置
- 确认 Twitter Client ID 和 Secret 正确
- 确保 Twitter 应用的回调 URL 配置正确

### 钱包地址未同步
- 检查浏览器控制台是否有错误
- 检查后端日志
- 确认网络请求是否成功

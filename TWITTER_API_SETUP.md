# Twitter API 配置指南

## 概述

本项目已实现真实的 Twitter API v2 集成，当用户创建 Pay 或 Request 动态并选择 "Public on X" 隐私设置时，系统会自动将动态发布到 Twitter。

## 配置步骤

### 1. 在 Twitter Developer Portal 创建应用

1. 访问 [Twitter Developer Portal](https://developer.twitter.com/en/portal)
2. 创建新应用或使用现有应用
3. 获取以下信息：
   - **Bearer Token** (推荐) - 用于应用级别的 API 调用
   - 或者 **API Key** 和 **API Secret** - 用于 OAuth 1.0a
   - 或者 **Client ID** 和 **Client Secret** - 用于 OAuth 2.0

### 2. 配置环境变量

在 `server/` 目录下的 `.env` 文件中添加以下配置：

```env
# Twitter API v2 Bearer Token (推荐)
X_BEARER_TOKEN=your_bearer_token_here

# 或者使用 OAuth 1.0a (可选)
X_API_KEY=your_api_key_here
X_API_SECRET=your_api_secret_here
X_ACCESS_TOKEN=your_access_token_here
X_ACCESS_TOKEN_SECRET=your_access_token_secret_here
```

### 3. 获取 Bearer Token

#### 方法 1: 从 Twitter Developer Portal 获取

1. 登录 [Twitter Developer Portal](https://developer.twitter.com/en/portal)
2. 选择你的应用
3. 在 "Keys and tokens" 页面，找到 "Bearer Token"
4. 点击 "Generate" 生成新的 Bearer Token
5. 复制 Bearer Token 到 `.env` 文件

#### 方法 2: 使用 OAuth 2.0 生成

如果你使用 OAuth 2.0，可以通过以下步骤获取 Bearer Token：

1. 使用你的 Client ID 和 Client Secret 获取 Bearer Token
2. 或者使用用户级别的 Access Token（通过 OAuth 2.0 流程获取）

### 4. API 权限要求

确保你的 Twitter 应用具有以下权限：

- **Read and Write** - 用于发布推文
- **Tweet** - 用于创建推文和回复

### 5. 启动服务

1. 确保 `.env` 文件已正确配置
2. 启动后端服务：
```bash
cd server
npm run dev
```

3. 启动前端服务：
```bash
npm run dev
```

## 使用流程

1. 用户登录应用
2. 创建 Pay 或 Request 动态
3. 在隐私设置中选择 **"Public on X"**
4. 提交动态
5. 系统自动将动态发布到 Twitter
6. 推文 ID 会保存在数据库中，可以在动态详情中查看

## 推文内容格式

### Request 动态

- **OTC Request**: `Requesting {amount} {currency} for {offerAmount} {fiatCurrency} on VenmoOTC! {note} #DeFi #OTC #Crypto`
- **Regular Request**: `{userName} ({handle}) is requesting {amount} {currency} {note} #DeFi #Crypto`

### Payment 动态

`{userName} ({handle}) paid {amount} {currency} to {recipient} {note} #DeFi #Crypto`

## API 端点

### POST /api/social/tweet

发布推文到 Twitter（需要认证）

**请求体：**
```json
{
  "content": "推文内容",
  "accessToken": "可选的用户访问令牌"
}
```

**响应：**
```json
{
  "tweetId": "推文ID",
  "content": "推文内容",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "url": "https://twitter.com/i/web/status/推文ID"
}
```

### POST /api/social/reply

回复推文（需要认证）

**请求体：**
```json
{
  "originalTweetId": "原始推文ID",
  "content": "回复内容",
  "accessToken": "可选的用户访问令牌"
}
```

## 故障排除

### 错误：`Twitter API not configured`

- 检查 `.env` 文件中是否配置了 `X_BEARER_TOKEN`
- 确保 Bearer Token 格式正确（以 `Bearer ` 开头，但配置时不需要加前缀）

### 错误：`Twitter API authentication failed`

- 检查 Bearer Token 是否有效
- 确认 Token 没有过期
- 检查应用权限是否足够

### 错误：`Twitter API access forbidden`

- 检查应用是否具有 "Read and Write" 权限
- 确认应用已通过 Twitter 的审核（如果需要）

### 错误：`Twitter API rate limit exceeded`

- Twitter API v2 有速率限制
- 等待一段时间后重试
- 考虑升级到更高的 API 计划

### 推文没有发布

- 检查浏览器控制台和后端日志
- 确认隐私设置选择了 "Public on X"
- 检查推文内容是否超过 280 字符限制
- 查看后端日志中的错误信息

## 注意事项

1. **速率限制**：Twitter API v2 有速率限制，请合理使用
2. **内容限制**：推文内容不能超过 280 字符
3. **错误处理**：如果 Twitter 发布失败，交易仍会创建，但不会发布到 Twitter
4. **Bearer Token 安全**：确保 Bearer Token 不要泄露，不要提交到版本控制系统
5. **测试环境**：建议先在测试环境中测试 Twitter API 集成

## 技术实现

- 使用 Twitter API v2 的 `/2/tweets` 端点发布推文
- 支持 Bearer Token 认证（应用级别）
- 支持用户 Access Token（用户级别，通过 OAuth 2.0 获取）
- 自动生成推文内容，包含交易详情和标签
- 推文 ID 保存在数据库的 `x_post_id` 字段中

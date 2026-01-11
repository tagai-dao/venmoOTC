# Twitter Bearer Token 配置指南

## 概述

当用户创建 Request 并选择 "Public on X" 时，系统需要发布推文到 Twitter/X。有两种方式：

1. **使用用户的 Twitter accessToken（推荐）**：用户授权后，使用用户的账号发推
2. **使用应用的 Bearer Token（降级方案）**：如果用户没有授权，使用应用的 Bearer Token 发推

## 配置 Bearer Token（可选）

如果您想要使用应用的 Bearer Token 作为降级方案，请按照以下步骤配置：

### 1. 获取 Twitter Bearer Token

1. 访问 [Twitter Developer Portal](https://developer.twitter.com/en/portal)
2. 登录您的 Twitter 开发者账号
3. 选择您的应用或创建新应用
4. 进入 **Keys and tokens** 页面
5. 在 **Bearer Token** 部分，点击 **Regenerate** 或复制现有的 Bearer Token

### 2. 配置环境变量

在 `server/` 目录下的 `.env` 文件中添加：

```env
X_BEARER_TOKEN=your_bearer_token_here
```

### 3. 重启服务器

配置完成后，重启服务器：

```bash
cd server
npm run dev
```

## 用户授权 Twitter API（推荐）

推荐让用户授权 Twitter API 访问，这样可以：

- 使用用户的 Twitter 账号发推
- 推文会显示为用户自己发布的
- 更好的用户体验

### 用户授权流程

1. 用户登录后，在 Profile 页面会看到 "Twitter API 授权状态" 区域
2. 如果未授权，会显示 "授权 Twitter API 访问" 按钮
3. 用户点击按钮后，会弹出 Twitter OAuth 授权页面
4. 用户授权后，系统会自动获取并存储 Twitter accessToken
5. 之后创建 Request 时，会自动使用用户的 accessToken 发布推文

### 在 Privy Dashboard 中启用 OAuth Token 返回

为了确保能够获取用户的 Twitter accessToken，需要在 Privy Dashboard 中配置：

1. 访问 [Privy Dashboard](https://dashboard.privy.io/)
2. 选择您的应用
3. 进入 **Settings** > **Login Methods**
4. 找到 **Twitter** 登录方式
5. 启用 **Return OAuth tokens** 选项
6. 确保 **Scopes** 包含 `tweet.write` 和 `offline.access`

## 工作流程

1. **用户授权**（推荐）：
   - 用户在 Profile 页面授权 Twitter API 访问
   - 系统获取并存储用户的 Twitter accessToken
   - 创建 Request 时，使用用户的 accessToken 发布推文

2. **使用 Bearer Token**（降级方案）：
   - 如果用户没有授权，系统会尝试使用配置的 Bearer Token
   - 如果 Bearer Token 也未配置，推文发布会失败，但交易仍会创建

## 注意事项

1. **Bearer Token** 是应用的全局 token，适用于所有推文
2. **用户的 accessToken** 是用户个人的 token，每个用户都有自己的 token
3. 推荐使用用户的 accessToken，因为推文会显示为用户自己发布的
4. Bearer Token 可以作为降级方案，确保即使没有用户授权也能发布推文

## 故障排除

### 问题：推文发布失败，提示 "请配置 X_BEARER_TOKEN 环境变量，或用户在登录时授权 Twitter API 访问"

**解决方案**：
1. 在 Profile 页面点击 "授权 Twitter API 访问" 按钮
2. 或者配置 `X_BEARER_TOKEN` 环境变量

### 问题：授权后仍然无法发布推文

**可能原因**：
1. Privy Dashboard 中未启用 "Return OAuth tokens"
2. Twitter API 权限不足（需要 `tweet.write` scope）
3. Bearer Token 或 accessToken 已过期

**解决方案**：
1. 检查 Privy Dashboard 配置
2. 确认 Twitter API 权限
3. 重新授权或更新 Bearer Token

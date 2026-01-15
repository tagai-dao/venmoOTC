# 快速测试指南

## 环境变量已配置

`.dev.vars` 文件已创建，包含以下配置：

### 已设置的默认值
- `JWT_SECRET` - 开发环境密钥
- `FRONTEND_URL` - http://localhost:3000
- `BNB_CHAIN_RPC_URL` - BSC 主网 RPC
- `USDT_CONTRACT_ADDRESS` - USDT 合约地址
- `MULTISIG_CONTRACT_ADDRESS` - 多签合约地址

### 需要填入实际值的变量
以下变量需要从你的实际配置中获取：

1. **PRIVY_APP_ID** 和 **PRIVY_APP_SECRET**
   - 从 Privy Dashboard 获取
   - 如果没有，某些认证功能可能无法正常工作

2. **TWITTER_CLIENT_ID** 和 **TWITTER_CLIENT_SECRET**
   - 从 Twitter Developer Portal 获取
   - 如果没有，Twitter 相关功能将无法使用

3. **PRIVATE_KEY**
   - 用于区块链操作的私钥
   - 如果没有，区块链相关功能将无法使用

## 测试步骤

### 1. 检查服务器是否运行

```bash
curl http://localhost:8787/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": "...",
  "service": "venmootc-api"
}
```

### 2. 测试认证端点（需要 Privy 配置）

```bash
curl -X POST http://localhost:8787/api/auth/privy \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "handle": "@testuser",
    "name": "Test User"
  }'
```

### 3. 测试用户端点

```bash
# 获取用户列表
curl http://localhost:8787/api/users

# 获取特定用户（需要先创建用户）
curl http://localhost:8787/api/users/USER_ID
```

### 4. 测试交易端点

```bash
# 获取交易列表
curl http://localhost:8787/api/transactions

# 创建交易（需要认证）
curl -X POST http://localhost:8787/api/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "transaction": {
      "fromUser": {
        "id": "user_id",
        "handle": "@user",
        "name": "User",
        "avatar": "https://...",
        "walletAddress": "0x...",
        "isVerified": false
      },
      "amount": 100,
      "currency": "USDT",
      "privacy": "Public",
      "type": "PAYMENT",
      "isOTC": false,
      "otcState": "NONE",
      "usdtInEscrow": false,
      "likes": 0,
      "comments": 0
    }
  }'
```

### 5. 测试通知端点（需要认证）

```bash
# 获取通知
curl http://localhost:8787/api/notifications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 获取未读数量
curl http://localhost:8787/api/notifications/unread/count \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 常见问题

### 服务器无法启动

1. 检查端口 8787 是否被占用
2. 确保 `.dev.vars` 文件存在
3. 检查 D1 数据库是否已初始化

### 数据库错误

运行数据库迁移：
```bash
cd /Users/0xnought/Desktop/04\ mini\ Apps/venmoOTC/venmootc
wrangler d1 execute venmootc-db --local --file=./server/d1-migrations/001_initial_schema.sql
```

### CORS 错误

确保 `FRONTEND_URL` 在 `.dev.vars` 中设置为 `http://localhost:3000`

### 认证失败

1. 检查 `JWT_SECRET` 是否设置
2. 确保 Privy 配置正确（如果需要）

## 下一步

1. ✅ 环境变量已配置
2. ✅ 服务器已启动
3. ⏳ 测试各个 API 端点
4. ⏳ 验证数据库操作
5. ⏳ 测试完整流程

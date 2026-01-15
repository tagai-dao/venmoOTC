# Workers 测试指南

## ✅ 类型检查通过

所有 TypeScript 类型检查已通过，代码可以正常编译。

## 测试步骤

### 1. 准备环境变量

创建 `.dev.vars` 文件（用于本地开发）：

```bash
cd server/worker
cp .dev.vars.example .dev.vars
# 然后编辑 .dev.vars 填入实际值
```

**必需的环境变量：**
- `JWT_SECRET` - JWT 密钥
- `PRIVY_APP_ID` - Privy 应用 ID
- `PRIVY_APP_SECRET` - Privy 应用密钥
- `FRONTEND_URL` - 前端 URL（本地开发：`http://localhost:3000`）

**可选的环境变量：**
- `BNB_CHAIN_RPC_URL` - BNB Chain RPC URL
- `USDT_CONTRACT_ADDRESS` - USDT 合约地址
- `MULTISIG_CONTRACT_ADDRESS` - 多签合约地址
- `PRIVATE_KEY` - 私钥（用于区块链操作）
- `TWITTER_CLIENT_ID` - Twitter 客户端 ID
- `TWITTER_CLIENT_SECRET` - Twitter 客户端密钥

### 2. 确保本地 D1 数据库已初始化

```bash
# 在项目根目录执行
wrangler d1 execute venmootc-db --local --file=./server/d1-migrations/001_initial_schema.sql
```

### 3. 启动本地开发服务器

```bash
cd server/worker
npm run dev
```

服务器将在 `http://localhost:8787` 启动。

### 4. 测试 API 端点

#### 健康检查
```bash
curl http://localhost:8787/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T...",
  "service": "venmootc-api"
}
```

#### 认证端点

**Privy 登录** (`POST /api/auth/privy`):
```bash
curl -X POST http://localhost:8787/api/auth/privy \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x...",
    "handle": "@testuser",
    "name": "Test User",
    "avatar": "https://..."
  }'
```

#### 用户端点

**获取用户列表** (`GET /api/users`):
```bash
curl http://localhost:8787/api/users
```

**获取当前用户** (`GET /api/users/me`):
```bash
curl http://localhost:8787/api/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 交易端点

**获取交易列表** (`GET /api/transactions`):
```bash
curl http://localhost:8787/api/transactions
```

**创建交易** (`POST /api/transactions`):
```bash
curl -X POST http://localhost:8787/api/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "transaction": {
      "fromUser": {...},
      "amount": 100,
      "currency": "USDT",
      "privacy": "Public",
      "type": "PAYMENT"
    }
  }'
```

#### 通知端点

**获取通知** (`GET /api/notifications`):
```bash
curl http://localhost:8787/api/notifications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**获取未读数量** (`GET /api/notifications/unread/count`):
```bash
curl http://localhost:8787/api/notifications/unread/count \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 抢单端点

**创建抢单** (`POST /api/bids/:transactionId`):
```bash
curl -X POST http://localhost:8787/api/bids/TRANSACTION_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "message": "我可以完成这个交易"
  }'
```

**获取抢单列表** (`GET /api/bids/:transactionId`):
```bash
curl http://localhost:8787/api/bids/TRANSACTION_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 多签端点

**记录多签订单** (`POST /api/multisig/record-order`):
```bash
curl -X POST http://localhost:8787/api/multisig/record-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "transactionId": "...",
    "traderAddress": "0x...",
    "usdtAmount": "100",
    "onchainOrderId": 123
  }'
```

**记录签名** (`POST /api/multisig/record-signature`):
```bash
curl -X POST http://localhost:8787/api/multisig/record-signature \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "transactionId": "...",
    "choice": 2,
    "paymentProofUrl": "https://..."
  }'
```

## 已转换的功能

### ✅ 已完成
- [x] 认证系统 (`/api/auth`)
- [x] 用户管理 (`/api/users`)
- [x] 交易管理 (`/api/transactions`) - 基础版
- [x] 通知系统 (`/api/notifications`)
- [x] 抢单系统 (`/api/bids`)
- [x] 多签合约 (`/api/multisig`) - 基础版

### ⏳ 待转换
- [ ] 区块链交互 (`/api/blockchain`)
- [ ] 社交功能 (`/api/social`)
- [ ] 社交互动 (`/api/social-interactions`)

## 注意事项

1. **本地 D1 数据库**：本地开发使用 `.wrangler/state/v3/d1/` 目录存储数据
2. **环境变量**：`.dev.vars` 文件仅用于本地开发，不会提交到 Git
3. **CORS**：本地开发时，CORS 已配置为允许 `http://localhost:3000`
4. **数据库迁移**：每次修改数据库结构后，需要重新运行迁移脚本

## 常见问题

### 1. 数据库连接错误
确保已运行数据库迁移：
```bash
wrangler d1 execute venmootc-db --local --file=./server/d1-migrations/001_initial_schema.sql
```

### 2. 环境变量未找到
确保 `.dev.vars` 文件存在且包含所有必需的环境变量。

### 3. CORS 错误
检查 `FRONTEND_URL` 环境变量是否正确设置。

### 4. JWT 验证失败
确保 `JWT_SECRET` 环境变量已设置，且与前端使用的密钥一致。

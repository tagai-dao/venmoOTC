# 生产环境 API URL

## Workers API 地址

**生产环境 API URL**: 
```
https://venmootc-api.donut33-social.workers.dev
```

## 可用的 API 端点

### 健康检查
```
GET https://venmootc-api.donut33-social.workers.dev/health
```

### 认证
```
POST https://venmootc-api.donut33-social.workers.dev/api/auth/privy
POST https://venmootc-api.donut33-social.workers.dev/api/auth/logout
```

### 用户
```
GET https://venmootc-api.donut33-social.workers.dev/api/users
GET https://venmootc-api.donut33-social.workers.dev/api/users/me
PUT https://venmootc-api.donut33-social.workers.dev/api/users/me
GET https://venmootc-api.donut33-social.workers.dev/api/users/:id
```

### 交易
```
GET https://venmootc-api.donut33-social.workers.dev/api/transactions
POST https://venmootc-api.donut33-social.workers.dev/api/transactions
PUT https://venmootc-api.donut33-social.workers.dev/api/transactions/:id
POST https://venmootc-api.donut33-social.workers.dev/api/transactions/:id/select-trader
```

### 通知
```
GET https://venmootc-api.donut33-social.workers.dev/api/notifications
GET https://venmootc-api.donut33-social.workers.dev/api/notifications/unread/count
PUT https://venmootc-api.donut33-social.workers.dev/api/notifications/:id/read
PUT https://venmootc-api.donut33-social.workers.dev/api/notifications/read/all
DELETE https://venmootc-api.donut33-social.workers.dev/api/notifications/:id
```

### 抢单
```
POST https://venmootc-api.donut33-social.workers.dev/api/bids/:transactionId
GET https://venmootc-api.donut33-social.workers.dev/api/bids/:transactionId
DELETE https://venmootc-api.donut33-social.workers.dev/api/bids/:bidId
```

### 多签合约
```
POST https://venmootc-api.donut33-social.workers.dev/api/multisig/record-order
POST https://venmootc-api.donut33-social.workers.dev/api/multisig/record-signature
GET https://venmootc-api.donut33-social.workers.dev/api/multisig/:transactionId
```

### 区块链
```
GET https://venmootc-api.donut33-social.workers.dev/api/blockchain/balance/:address/:currency
POST https://venmootc-api.donut33-social.workers.dev/api/blockchain/send
GET https://venmootc-api.donut33-social.workers.dev/api/blockchain/transaction/:txHash
POST https://venmootc-api.donut33-social.workers.dev/api/blockchain/balances
```

### 社交
```
POST https://venmootc-api.donut33-social.workers.dev/api/social/tweet
POST https://venmootc-api.donut33-social.workers.dev/api/social/reply
```

### 社交互动
```
POST https://venmootc-api.donut33-social.workers.dev/api/social-interactions/:transactionId/like
GET https://venmootc-api.donut33-social.workers.dev/api/social-interactions/:transactionId/liked
POST https://venmootc-api.donut33-social.workers.dev/api/social-interactions/:transactionId/comment
DELETE https://venmootc-api.donut33-social.workers.dev/api/social-interactions/comment/:commentId
```

## 前端配置

在前端项目中，设置环境变量：

```env
VITE_API_URL=https://venmootc-api.donut33-social.workers.dev
```

或在 `vite.config.ts` 中：

```typescript
define: {
  'process.env.VITE_API_URL': JSON.stringify('https://venmootc-api.donut33-social.workers.dev')
}
```

## 测试命令

```bash
# 健康检查
curl https://venmootc-api.donut33-social.workers.dev/health

# 获取用户列表
curl https://venmootc-api.donut33-social.workers.dev/api/users

# 测试认证
curl -X POST https://venmootc-api.donut33-social.workers.dev/api/auth/privy \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "handle": "@testuser",
    "name": "Test User"
  }'
```

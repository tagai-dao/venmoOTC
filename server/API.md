# VenmoOTC API 文档

所有 API 端点都使用 Mock 数据，便于开发和测试。

## 基础 URL

```
http://localhost:3001
```

## 认证 API

### POST /api/auth/privy

Privy 登录（同步用户到后端）
这是唯一的登录方式，通过 Privy 钱包登录（支持 Twitter 登录）

**请求体:**
```json
{
  "walletAddress": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  "handle": "@crypto_native",
  "name": "Alex Rivera",
  "avatar": "https://picsum.photos/200/200?random=1",
  "privyUserId": "privy_user_id_123"
}
```

**响应:**
```json
{
  "user": {
    "id": "u1",
    "handle": "@crypto_native",
    "name": "Alex Rivera",
    "avatar": "https://picsum.photos/200/200?random=1",
    "walletAddress": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    "isVerified": true,
    "fiatDetails": {
      "bankName": "Monzo",
      "accountNumber": "12345678",
      "accountName": "Alex Rivera"
    }
  },
  "token": "jwt_token_1234567890"
}
```

### POST /api/auth/logout

登出

**响应:**
```json
{
  "message": "Logged out successfully"
}
```

## 区块链 API

### GET /api/blockchain/balance/:address/:currency

获取钱包余额

**参数:**
- `address`: 钱包地址
- `currency`: 货币类型 (USDT, NGN, VES, USD)

**示例:**
```
GET /api/blockchain/balance/0x71C7656EC7ab88b098defB751B7401B5f6d8976F/USDT
```

**响应:**
```json
{
  "balance": 1250.50,
  "currency": "USDT",
  "address": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  "timestamp": 1234567890
}
```

### POST /api/blockchain/send

发送 USDT

**请求体:**
```json
{
  "fromAddress": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  "toAddress": "0xB2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1E1F1A1B1",
  "amount": 100.50
}
```

**响应:**
```json
{
  "txHash": "0x1234567890abcdef...",
  "toAddress": "0xB2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1E1F1A1B1",
  "amount": 100.50,
  "fromAddress": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  "status": "confirmed",
  "blockNumber": 1234567,
  "timestamp": 1234567890
}
```

## 社交 API

### POST /api/social/tweet

发布推文到 X (Twitter)

**请求体:**
```json
{
  "content": "Requesting 100 USDT for 165000 NGN on VenmoOTC! #DeFi #OTC",
  "accessToken": "optional_token"
}
```

**响应:**
```json
{
  "tweetId": "1839201923",
  "content": "Requesting 100 USDT for 165000 NGN on VenmoOTC! #DeFi #OTC",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "url": "https://twitter.com/user/status/1839201923"
}
```

### POST /api/social/reply

回复推文

**请求体:**
```json
{
  "originalTweetId": "1839201923",
  "content": "I've paid! Please check and release USDT.",
  "accessToken": "optional_token"
}
```

**响应:**
```json
{
  "replyId": "1839201924",
  "originalTweetId": "1839201923",
  "content": "I've paid! Please check and release USDT.",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "url": "https://twitter.com/user/status/1839201924"
}
```

## 交易 API

### GET /api/transactions

获取交易列表

**查询参数:**
- `userId`: 用户 ID（可选）
- `type`: 交易类型 PAYMENT 或 REQUEST（可选）
- `privacy`: 隐私设置（可选）

**示例:**
```
GET /api/transactions?userId=u1&type=REQUEST
```

**响应:**
```json
{
  "transactions": [
    {
      "id": "t1",
      "fromUser": { ... },
      "toUser": { ... },
      "amount": 15.00,
      "currency": "USDT",
      "note": "Pizza night 🍕",
      "timestamp": 1234567890,
      "privacy": "Public",
      "type": "PAYMENT",
      "isOTC": false,
      "otcState": "NONE",
      "likes": 2,
      "comments": 0
    }
  ]
}
```

### POST /api/transactions

创建新交易

**请求体:**
```json
{
  "transaction": {
    "fromUser": { ... },
    "toUser": null,
    "amount": 100.00,
    "currency": "USDT",
    "note": "Need USDT for gas fees",
    "privacy": "Public",
    "type": "REQUEST",
    "isOTC": true,
    "otcState": "OPEN_REQUEST",
    "otcFiatCurrency": "NGN",
    "otcOfferAmount": 82500,
    "likes": 0,
    "comments": 0
  }
}
```

**响应:**
```json
{
  "transaction": {
    "id": "t_new123",
    ... // 包含所有字段，自动添加 id 和 timestamp
  }
}
```

### PUT /api/transactions/:id

更新交易

**请求体:**
```json
{
  "updates": {
    "otcState": "AWAITING_FIAT_PAYMENT",
    "toUser": { ... },
    "newReply": {
      "id": "r1",
      "user": { ... },
      "text": "I've paid!",
      "timestamp": 1234567890
    }
  }
}
```

**响应:**
```json
{
  "transaction": {
    ... // 更新后的交易对象
  }
}
```

## 用户 API

### GET /api/users

获取用户列表

**查询参数:**
- `search`: 搜索关键词（可选）
- `verified`: 是否已验证（true/false，可选）

**示例:**
```
GET /api/users?search=alex&verified=true
```

**响应:**
```json
{
  "users": [
    {
      "id": "u1",
      "handle": "@crypto_native",
      "name": "Alex Rivera",
      "avatar": "https://picsum.photos/200/200?random=1",
      "walletAddress": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      "isVerified": true,
      "fiatDetails": { ... }
    }
  ]
}
```

### GET /api/users/:id

获取用户信息

**响应:**
```json
{
  "user": {
    "id": "u1",
    "handle": "@crypto_native",
    "name": "Alex Rivera",
    ...
  }
}
```

## Mock 数据说明

所有 API 都使用预定义的 Mock 数据：

- **用户**: 4 个预设用户（u1-u4）
- **交易**: 3 个预设交易（t1, t_ngn_req, t2）
- **余额**: 每个用户地址都有预设的 USDT 和 NGN 余额
- **推文 ID**: 随机生成的 9 位数字
- **交易哈希**: 随机生成的 64 字符十六进制字符串

## 测试示例

使用 curl 测试 API：

```bash
# 健康检查
curl http://localhost:3001/health

# 登录
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{}'

# 获取余额
curl http://localhost:3001/api/blockchain/balance/0x71C7656EC7ab88b098defB751B7401B5f6d8976F/USDT

# 获取交易列表
curl http://localhost:3001/api/transactions

# 获取用户列表
curl http://localhost:3001/api/users
```


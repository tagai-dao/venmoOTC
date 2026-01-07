# VenmoOTC Backend API

Node.js + Express 后端 API 服务器。

## 功能

- 🔐 认证 API（X/Twitter 登录）
- ⛓️ 区块链 API（余额查询、USDT 转账）
- 🐦 社交 API（X/Twitter 推文和回复）
- 💸 交易 API（创建、查询、更新交易）
- 👤 用户 API（查询用户信息）

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API 密钥和配置。

### 3. 运行开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3001` 启动。

### 4. 构建生产版本

```bash
npm run build
npm start
```

## API 端点

### 认证

- `POST /api/auth/login` - X (Twitter) 登录
- `POST /api/auth/logout` - 登出

### 区块链

- `GET /api/blockchain/balance/:address/:currency` - 获取余额
- `POST /api/blockchain/send` - 发送 USDT

### 社交

- `POST /api/social/tweet` - 发布推文
- `POST /api/social/reply` - 回复推文

### 交易

- `GET /api/transactions` - 获取交易列表
- `POST /api/transactions` - 创建交易
- `PUT /api/transactions/:id` - 更新交易

### 用户

- `GET /api/users` - 获取用户列表
- `GET /api/users/:id` - 获取用户信息

## 环境变量

详见 `.env.example` 文件。

## 注意事项

- 当前使用内存存储，生产环境应替换为数据库（如 PostgreSQL、MongoDB）
- X API 和区块链功能需要配置相应的 API 密钥和私钥
- 建议使用 JWT 进行身份验证
- 生产环境应添加速率限制、请求验证等安全措施


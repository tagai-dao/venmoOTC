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

### 2. 设置数据库

#### 2.1 安装 PostgreSQL

确保你的系统已安装 PostgreSQL（建议版本 12+）。

#### 2.2 创建数据库

```bash
# 使用 psql 连接到 PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE venmootc;

# 退出
\q
```

#### 2.3 配置环境变量

复制 `.env.example` 到 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入数据库配置：

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=venmootc
DB_USER=postgres
DB_PASSWORD=your_password
```

### 3. 运行开发服务器

```bash
npm run dev
```

服务器启动时会自动：
- 测试数据库连接
- 初始化数据库表结构
- 导入初始种子数据（仅开发环境）

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

## 数据库

项目使用 PostgreSQL 作为数据库。数据库结构包括：

- **users** - 用户表
- **transactions** - 交易表
- **transaction_replies** - 交易回复表
- **wallet_balances** - 钱包余额表

数据库迁移脚本位于 `src/db/migrations/` 目录。

### 手动运行迁移

如果需要手动运行迁移：

```bash
# 连接到数据库
psql -U postgres -d venmootc

# 运行迁移脚本
\i src/db/migrations/001_initial_schema.sql
\i src/db/migrations/002_seed_data.sql
```

## 注意事项

- 确保 PostgreSQL 服务正在运行
- X API 和区块链功能需要配置相应的 API 密钥和私钥
- 建议使用 JWT 进行身份验证
- 生产环境应添加速率限制、请求验证等安全措施
- 生产环境建议使用连接池和数据库备份策略


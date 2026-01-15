# Cloudflare 完整部署方案（前端 Pages + 后端 Workers + 数据库 D1）

## 项目架构概览

本项目将完全部署到 Cloudflare：
- **前端**：React + Vite → Cloudflare Pages
- **后端**：Express.js → Cloudflare Workers
- **数据库**：MySQL → Cloudflare D1 (SQLite)

---

## 部署架构

```
┌─────────────────────────┐
│   Cloudflare Pages      │
│   前端静态应用           │
│   app.yourdomain.com    │
└────────────┬────────────┘
             │
             │ HTTPS API 调用
             │
┌────────────▼────────────┐
│  Cloudflare Workers     │
│  后端 API 服务器         │
│  api.yourdomain.com     │
└────────────┬────────────┘
             │
             │
┌────────────▼────────────┐
│   Cloudflare D1         │
│   SQLite 数据库         │
└─────────────────────────┘
```

---

## 第一步：准备工作

### 1.1 安装必要工具

```bash
# 安装 Wrangler CLI（Cloudflare 官方工具）
npm install -g wrangler

# 登录 Cloudflare
wrangler login
```

### 1.2 创建 Cloudflare D1 数据库

```bash
# 在项目根目录创建 D1 数据库
wrangler d1 create venmootc-db

# 记录输出的数据库 ID，稍后需要用到
# 输出示例：
# ✅ Successfully created DB 'venmootc-db'!
#    Created your database using D1's new storage backend. The new storage backend is not yet recommended for production workloads, but backs up your data via snapshots to R2.
#    [[d1_databases]]
#    binding = "DB"
#    database_name = "venmootc-db"
#    database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

## 第二步：迁移数据库到 D1

### 2.1 创建 D1 迁移脚本

在项目根目录创建 `wrangler.toml` 配置文件：

```toml
name = "venmootc-api"
main = "server/worker/src/index.ts"
compatibility_date = "2024-01-01"

# D1 数据库绑定
[[d1_databases]]
binding = "DB"
database_name = "venmootc-db"
database_id = "你的数据库ID"  # 从第一步获取

# 环境变量（通过 wrangler secret put 设置）
# 这些变量会在 Workers 运行时可用
```

### 2.2 转换 MySQL 迁移脚本为 D1 SQLite

D1 使用 SQLite，需要将 MySQL 语法转换为 SQLite 语法。主要差异：

1. **数据类型差异**：
   - MySQL: `TINYINT(1)` → SQLite: `INTEGER`
   - MySQL: `VARCHAR(n)` → SQLite: `TEXT` 或 `VARCHAR(n)`
   - MySQL: `DECIMAL(20, 8)` → SQLite: `REAL` 或 `TEXT`
   - MySQL: `TIMESTAMP` → SQLite: `INTEGER` (Unix timestamp) 或 `TEXT` (ISO 8601)

2. **语法差异**：
   - MySQL: `ENGINE=InnoDB` → SQLite: 不需要
   - MySQL: `ON UPDATE CURRENT_TIMESTAMP` → SQLite: 需要触发器
   - MySQL: `AUTO_INCREMENT` → SQLite: `AUTOINCREMENT`

创建 `server/d1-migrations/` 目录，并转换迁移脚本。

### 2.3 创建 D1 迁移脚本示例

创建 `server/d1-migrations/001_initial_schema.sql`：

```sql
-- VenmoOTC D1 数据库初始化脚本 (SQLite)

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    handle TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    wallet_address TEXT UNIQUE NOT NULL,
    is_verified INTEGER DEFAULT 0,
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    country TEXT,
    twitter_access_token TEXT,
    twitter_refresh_token TEXT,
    twitter_token_expires_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 交易表
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    from_user_id TEXT NOT NULL,
    to_user_id TEXT,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    note TEXT,
    sticker TEXT,
    timestamp INTEGER NOT NULL,
    privacy TEXT NOT NULL,
    type TEXT NOT NULL,
    x_post_id TEXT,
    is_otc INTEGER DEFAULT 0,
    otc_state TEXT DEFAULT 'NONE',
    otc_fiat_currency TEXT,
    otc_offer_amount REAL,
    otc_proof_image TEXT,
    payment_proof_url TEXT,
    related_transaction_id TEXT,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (related_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

-- 交易回复表
CREATE TABLE IF NOT EXISTS transaction_replies (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    proof TEXT,
    timestamp INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 钱包余额表
CREATE TABLE IF NOT EXISTS wallet_balances (
    wallet_address TEXT PRIMARY KEY,
    usdt_balance REAL DEFAULT 0,
    ngn_balance REAL DEFAULT 0,
    ves_balance REAL DEFAULT 0,
    usd_balance REAL DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    related_transaction_id TEXT,
    related_user_id TEXT,
    is_read INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
    FOREIGN KEY (related_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 社交互动表
CREATE TABLE IF NOT EXISTS social_interactions (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(transaction_id, user_id, type)
);

-- 出价表
CREATE TABLE IF NOT EXISTS bids (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    bidder_id TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (bidder_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 多签合约表
CREATE TABLE IF NOT EXISTS multisig_contracts (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    initiator_id TEXT NOT NULL,
    counterparty_id TEXT,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN',
    onchain_order_id INTEGER,
    initiator_choice INTEGER DEFAULT 0,
    counterparty_choice INTEGER DEFAULT 0,
    initiator_signed INTEGER DEFAULT 0,
    counterparty_signed INTEGER DEFAULT 0,
    payment_proof_url TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (initiator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (counterparty_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_transactions_from_user ON transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_user ON transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_otc_state ON transactions(otc_state);
CREATE INDEX IF NOT EXISTS idx_transactions_related ON transactions(related_transaction_id);
CREATE INDEX IF NOT EXISTS idx_replies_transaction ON transaction_replies(transaction_id);
CREATE INDEX IF NOT EXISTS idx_replies_user ON transaction_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_social_interactions_transaction ON social_interactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_bids_transaction ON bids(transaction_id);
CREATE INDEX IF NOT EXISTS idx_multisig_transaction ON multisig_contracts(transaction_id);

-- 创建触发器以自动更新 updated_at
CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
    AFTER UPDATE ON users
    FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_transactions_updated_at 
    AFTER UPDATE ON transactions
    FOR EACH ROW
BEGIN
    UPDATE transactions SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;
```

### 2.4 运行 D1 迁移

```bash
# 本地运行迁移（测试）
wrangler d1 execute venmootc-db --local --file=./server/d1-migrations/001_initial_schema.sql

# 生产环境运行迁移
wrangler d1 execute venmootc-db --file=./server/d1-migrations/001_initial_schema.sql
```

---

## 第三步：转换 Express 后端为 Cloudflare Workers

### 3.1 创建 Workers 项目结构

在 `server/` 目录下创建新的 Workers 结构：

```
server/
├── worker/
│   ├── src/
│   │   ├── index.ts          # Workers 入口文件
│   │   ├── routes/           # 路由处理
│   │   ├── controllers/      # 控制器（复用）
│   │   ├── services/         # 服务（复用）
│   │   ├── db/               # D1 数据库适配器
│   │   └── utils/            # 工具函数（复用）
│   ├── package.json
│   └── tsconfig.json
└── ...
```

### 3.2 安装 Workers 依赖

在 `server/worker/` 目录创建 `package.json`：

```json
{
  "name": "venmootc-worker",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@cloudflare/workers-types": "^4.20240101.0",
    "hono": "^3.12.0",
    "cors": "^2.8.5",
    "crypto-js": "^4.2.0",
    "ethers": "^6.9.0",
    "jsonwebtoken": "^9.0.3"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/jsonwebtoken": "^9.0.10",
    "typescript": "^5.3.3",
    "wrangler": "^3.0.0"
  }
}
```

### 3.3 创建 Workers 入口文件

创建 `server/worker/src/index.ts`：

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';

// 定义 Workers 环境类型
interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  PRIVY_APP_ID: string;
  PRIVY_APP_SECRET: string;
  BNB_CHAIN_RPC_URL: string;
  USDT_CONTRACT_ADDRESS: string;
  MULTISIG_CONTRACT_ADDRESS: string;
  PRIVATE_KEY: string;
  TWITTER_CLIENT_ID: string;
  TWITTER_CLIENT_SECRET: string;
  FRONTEND_URL: string;
  // ... 其他环境变量
}

// 创建 Hono 应用（类似 Express）
const app = new Hono<{ Bindings: Env }>();

// CORS 中间件
app.use('/*', cors({
  origin: (origin, c) => {
    const allowedOrigins = [
      c.env.FRONTEND_URL,
      'http://localhost:3000',
      'https://your-pages-domain.pages.dev',
    ];
    return allowedOrigins.includes(origin || '') ? origin : c.env.FRONTEND_URL;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposeHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// 健康检查
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由
app.route('/api/auth', authRoutes);
app.route('/api/blockchain', blockchainRoutes);
app.route('/api/social', socialRoutes);
app.route('/api/transactions', transactionRoutes);
app.route('/api/users', userRoutes);
app.route('/api/notifications', notificationRoutes);
app.route('/api/social-interactions', socialInteractionRoutes);
app.route('/api/bids', bidRoutes);
app.route('/api/multisig', multisigRoutes);

// 404 处理
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// 错误处理
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ 
    error: { 
      message: err.message || 'Internal Server Error' 
    } 
  }, 500);
});

export default app;
```

### 3.4 创建 D1 数据库适配器

创建 `server/worker/src/db/d1Adapter.ts`：

```typescript
import { D1Database } from '@cloudflare/workers-types';

/**
 * D1 数据库适配器
 * 将原来的 MySQL pool 调用转换为 D1 调用
 */
export class D1Adapter {
  constructor(private db: D1Database) {}

  async execute(query: string, params: any[] = []): Promise<D1Result> {
    // 转换 MySQL 占位符 ? 为 SQLite 的 ?
    // SQLite 和 MySQL 都使用 ?，所以可以直接使用
    const statement = this.db.prepare(query);
    return statement.bind(...params).run();
  }

  async query<T = any>(query: string, params: any[] = []): Promise<T[]> {
    const statement = this.db.prepare(query);
    const result = await statement.bind(...params).all<T>();
    return result.results || [];
  }

  async queryOne<T = any>(query: string, params: any[] = []): Promise<T | null> {
    const results = await this.query<T>(query, params);
    return results[0] || null;
  }

  // 兼容原来的 pool.execute 方法
  async getConnection() {
    return {
      execute: this.execute.bind(this),
      query: this.query.bind(this),
      queryOne: this.queryOne.bind(this),
      release: () => {}, // D1 不需要释放连接
    };
  }
}
```

### 3.5 更新 Repository 以使用 D1

修改 `server/worker/src/db/repositories/userRepository.ts`：

```typescript
import { D1Adapter } from '../d1Adapter.js';
import { User } from '../../types.js';

export class UserRepository {
  constructor(private db: D1Adapter) {}

  private static rowToUser(row: any): User {
    return {
      id: row.id,
      handle: row.handle,
      name: row.name,
      avatar: row.avatar,
      walletAddress: row.wallet_address,
      isVerified: Boolean(row.is_verified),
      fiatDetails: row.bank_name ? {
        bankName: row.bank_name,
        accountNumber: row.account_number,
        accountName: row.account_name,
        country: row.country || undefined,
      } : undefined,
    } as User;
  }

  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    const row = await this.db.queryOne(
      'SELECT * FROM users WHERE wallet_address = ?',
      [walletAddress]
    );
    return row ? UserRepository.rowToUser(row) : null;
  }

  async create(userData: any): Promise<User> {
    const query = `
      INSERT INTO users (
        id, handle, name, avatar, wallet_address, is_verified,
        bank_name, account_number, account_name, country,
        twitter_access_token, twitter_refresh_token, twitter_token_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.execute(query, [
      userData.id,
      userData.handle,
      userData.name,
      userData.avatar,
      userData.walletAddress,
      userData.isVerified ? 1 : 0,
      userData.fiatDetails?.bankName || null,
      userData.fiatDetails?.accountNumber || null,
      userData.fiatDetails?.accountName || null,
      userData.fiatDetails?.country || null,
      userData.twitterAccessToken || null,
      userData.twitterRefreshToken || null,
      userData.twitterTokenExpiresAt || null,
    ]);

    return this.findById(userData.id);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.db.queryOne('SELECT * FROM users WHERE id = ?', [id]);
    return row ? UserRepository.rowToUser(row) : null;
  }

  // ... 其他方法类似转换
}
```

### 3.6 转换路由为 Hono 格式

创建 `server/worker/src/routes/auth.ts`：

```typescript
import { Hono } from 'hono';
import { loginWithPrivy, logout } from '../controllers/authController.js';

const router = new Hono();

router.post('/privy', async (c) => {
  const body = await c.req.json();
  return loginWithPrivy(c, body);
});

router.post('/logout', logout);

export default router;
```

更新控制器以使用 Hono Context：

```typescript
import { Context } from 'hono';
import { D1Adapter } from '../db/d1Adapter.js';
import { UserRepository } from '../db/repositories/userRepository.js';

export const loginWithPrivy = async (c: Context, body: any) => {
  const db = new D1Adapter(c.env.DB);
  const userRepo = new UserRepository(db);
  
  // ... 登录逻辑
  return c.json(response);
};
```

---

## 第四步：配置 Wrangler

### 4.1 更新 wrangler.toml

```toml
name = "venmootc-api"
main = "server/worker/src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# D1 数据库绑定
[[d1_databases]]
binding = "DB"
database_name = "venmootc-db"
database_id = "你的数据库ID"

# 路由配置（可选，用于自定义域名）
routes = [
  { pattern = "api.yourdomain.com", zone_name = "yourdomain.com" }
]

# 环境变量（通过 wrangler secret put 设置，不在文件中硬编码）
# 这些变量会在 Workers 运行时通过 c.env 访问
```

### 4.2 设置环境变量（密钥）

```bash
# 设置敏感环境变量（这些不会出现在代码中）
wrangler secret put JWT_SECRET
wrangler secret put PRIVY_APP_SECRET
wrangler secret put PRIVATE_KEY
wrangler secret put TWITTER_CLIENT_SECRET
# ... 其他敏感变量

# 非敏感变量可以在 wrangler.toml 中设置
# 或在 Cloudflare Dashboard 中设置
```

### 4.3 在 wrangler.toml 中添加非敏感变量

```toml
[vars]
FRONTEND_URL = "https://your-pages-domain.pages.dev"
BNB_CHAIN_RPC_URL = "https://bsc-dataseed.binance.org/"
USDT_CONTRACT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955"
MULTISIG_CONTRACT_ADDRESS = "0x7989D4b7ABCA813cBA8c87688C3330eb345E3cf6"
PRIVY_APP_ID = "your_privy_app_id"
TWITTER_CLIENT_ID = "your_twitter_client_id"
```

---

## 第五步：部署 Workers

### 5.1 本地测试

```bash
cd server/worker

# 安装依赖
npm install

# 本地开发（使用本地 D1 数据库）
wrangler dev

# 本地开发（使用远程 D1 数据库）
wrangler dev --remote
```

### 5.2 部署到生产环境

```bash
# 构建 TypeScript
npm run type-check

# 部署 Workers
wrangler deploy

# 部署后，Workers 会获得一个 URL：
# https://venmootc-api.your-subdomain.workers.dev
```

---

## 第六步：部署前端到 Cloudflare Pages

### 6.1 配置前端环境变量

在 Cloudflare Pages 项目设置中添加：

```
VITE_API_URL=https://venmootc-api.your-subdomain.workers.dev
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_BLOCKCHAIN_RPC_URL=https://bsc-dataseed.binance.org
```

### 6.2 部署前端

按照之前的文档（`CLOUDFLARE_DEPLOYMENT.md`）部署前端到 Cloudflare Pages。

---

## 第七步：配置自定义域名

### 7.1 Workers 自定义域名

在 Cloudflare Dashboard：
1. 进入 Workers & Pages → 你的 Workers 项目
2. 进入 **Triggers** → **Custom Domains**
3. 添加自定义域名（如 `api.yourdomain.com`）

### 7.2 Pages 自定义域名

在 Cloudflare Pages 项目设置中：
1. 进入 **Custom domains**
2. 添加自定义域名（如 `app.yourdomain.com`）

### 7.3 更新 CORS 配置

更新 Workers 中的 CORS 配置，包含新的域名：

```typescript
const allowedOrigins = [
  'https://app.yourdomain.com',
  'https://your-pages-domain.pages.dev',
  'http://localhost:3000', // 开发环境
];
```

---

## 第八步：数据迁移（从 MySQL 到 D1）

### 8.1 导出 MySQL 数据

```bash
# 导出数据为 SQL 格式
mysqldump -u username -p database_name > backup.sql

# 或导出为 CSV
mysql -u username -p database_name -e "SELECT * FROM users" > users.csv
```

### 8.2 转换并导入到 D1

创建迁移脚本 `server/d1-migrations/import_data.ts`：

```typescript
import { D1Database } from '@cloudflare/workers-types';

async function importData(db: D1Database) {
  // 读取导出的数据
  const users = await readCSV('users.csv');
  
  // 批量插入
  const stmt = db.prepare(`
    INSERT INTO users (id, handle, name, avatar, wallet_address, ...)
    VALUES (?, ?, ?, ?, ?, ...)
  `);
  
  for (const user of users) {
    await stmt.bind(
      user.id,
      user.handle,
      user.name,
      // ...
    ).run();
  }
}
```

---

## 迁移检查清单

### 数据库迁移
- [ ] 创建 D1 数据库
- [ ] 转换所有 MySQL 迁移脚本为 SQLite
- [ ] 运行 D1 迁移脚本
- [ ] 验证表结构正确
- [ ] 迁移现有数据（如果有）

### 后端迁移
- [ ] 创建 Workers 项目结构
- [ ] 安装 Workers 依赖
- [ ] 创建 D1 适配器
- [ ] 转换所有 Repository 使用 D1
- [ ] 转换所有路由为 Hono 格式
- [ ] 更新控制器使用 Hono Context
- [ ] 测试所有 API 端点
- [ ] 配置环境变量
- [ ] 部署 Workers

### 前端部署
- [ ] 更新 API URL 指向 Workers
- [ ] 配置环境变量
- [ ] 部署到 Cloudflare Pages
- [ ] 测试前端功能

### 验证
- [ ] 所有 API 端点正常工作
- [ ] 数据库查询正常
- [ ] 用户认证流程正常
- [ ] 区块链交互正常
- [ ] CORS 配置正确
- [ ] 自定义域名配置正确

---

## 常见问题

### 1. SQLite 数据类型限制

**问题**：MySQL 的 `DECIMAL` 类型在 SQLite 中需要使用 `REAL` 或 `TEXT`

**解决方案**：
- 对于金额，使用 `REAL`（浮点数）
- 对于需要精确计算的金额，使用 `TEXT` 存储字符串，在应用层转换

### 2. 时间戳处理

**问题**：MySQL 的 `TIMESTAMP` 和 SQLite 的时间戳格式不同

**解决方案**：
- 使用 `INTEGER` 存储 Unix 时间戳
- 或使用 `TEXT` 存储 ISO 8601 格式
- 在应用层统一处理时间格式

### 3. 外键约束

**问题**：SQLite 默认不启用外键约束

**解决方案**：
- 在连接时启用：`PRAGMA foreign_keys = ON;`
- 在 D1 中，外键约束默认启用

### 4. Workers 执行时间限制

**问题**：Cloudflare Workers 有 CPU 时间限制（免费版 10ms，付费版 50ms）

**解决方案**：
- 优化数据库查询
- 使用批量操作
- 对于长时间运行的任务，使用 Durable Objects 或 Queue

### 5. D1 查询性能

**问题**：D1 是 SQLite，性能可能不如 MySQL

**解决方案**：
- 创建适当的索引
- 优化查询语句
- 使用批量操作
- 考虑使用 D1 的批量 API

---

## 性能优化建议

### 1. 数据库优化
- 创建适当的索引
- 使用批量查询
- 避免 N+1 查询问题
- 使用连接池（D1 自动管理）

### 2. Workers 优化
- 使用 Hono 的中间件缓存
- 实现响应缓存
- 优化 JSON 序列化
- 使用流式响应（如果适用）

### 3. 前端优化
- 使用 Cloudflare Pages 的自动 CDN
- 启用压缩
- 使用静态资源缓存

---

## 成本估算

### Cloudflare 免费计划
- **Pages**：无限请求，100,000 构建/月
- **Workers**：100,000 请求/天，10ms CPU 时间
- **D1**：5GB 存储，5M 读取/月，100K 写入/月

### 付费计划（如果需要）
- **Workers Paid**：$5/月，10M 请求，50ms CPU 时间
- **D1 Paid**：$5/月，25GB 存储，更多读写配额

---

## 参考资源

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Hono 框架文档](https://hono.dev/)
- [SQLite 与 MySQL 差异](https://www.sqlite.org/different.html)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)

---

## 下一步

1. ✅ 创建 D1 数据库
2. ✅ 转换数据库迁移脚本
3. ✅ 创建 Workers 项目结构
4. ✅ 转换后端代码
5. ✅ 测试本地开发
6. ✅ 部署 Workers
7. ✅ 部署前端
8. ✅ 配置自定义域名
9. ✅ 迁移数据
10. ✅ 测试和优化

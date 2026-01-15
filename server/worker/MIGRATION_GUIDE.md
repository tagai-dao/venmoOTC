# Express 到 Cloudflare Workers 迁移指南

## 主要变化

### 1. 框架从 Express 到 Hono

**Express:**
```typescript
import express from 'express';
const app = express();
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});
```

**Hono (Workers):**
```typescript
import { Hono } from 'hono';
const app = new Hono();
app.get('/api/users', (c) => {
  return c.json({ users: [] });
});
```

### 2. 请求和响应对象

**Express:**
```typescript
app.post('/api/auth', async (req: Request, res: Response) => {
  const body = req.body;
  const userId = req.params.id;
  res.json({ success: true });
});
```

**Hono:**
```typescript
app.post('/api/auth', async (c: Context) => {
  const body = await c.req.json();
  const userId = c.req.param('id');
  return c.json({ success: true });
});
```

### 3. 数据库连接

**Express (MySQL):**
```typescript
import { pool } from './db/config.js';
const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
```

**Workers (D1):**
```typescript
const stmt = c.env.DB.prepare('SELECT * FROM users WHERE id = ?');
const result = await stmt.bind(userId).first();
```

### 4. 环境变量

**Express:**
```typescript
const apiKey = process.env.API_KEY;
```

**Workers:**
```typescript
// 在 wrangler.toml 中定义
// 或通过 c.env 访问
const apiKey = c.env.API_KEY;
```

### 5. 中间件

**Express:**
```typescript
app.use(cors());
app.use(express.json());
app.use('/api', authenticateToken);
```

**Hono:**
```typescript
import { cors } from 'hono/cors';
app.use('/*', cors());
// Hono 自动解析 JSON
app.use('/api/*', authenticateToken);
```

## 迁移步骤

1. **创建 Workers 项目结构**
   - 在 `server/worker/` 目录创建新项目
   - 安装 Hono 和相关依赖

2. **转换路由**
   - 将 Express 路由转换为 Hono 路由
   - 更新请求/响应处理

3. **更新数据库访问**
   - 创建 D1 适配器
   - 更新所有 Repository 使用 D1

4. **更新控制器**
   - 将 `req, res` 参数改为 `c: Context`
   - 更新所有数据库调用

5. **配置环境变量**
   - 在 `wrangler.toml` 中设置非敏感变量
   - 使用 `wrangler secret put` 设置敏感变量

6. **测试和部署**
   - 本地测试：`wrangler dev`
   - 部署：`wrangler deploy`

## 注意事项

- Workers 有 CPU 时间限制，需要优化代码
- D1 是 SQLite，语法与 MySQL 有差异
- 某些 Node.js API 可能不可用，需要使用兼容层
- 文件系统操作需要使用外部存储（如 R2）

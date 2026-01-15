# CORS 配置修复完成

## 🐛 问题

访问 `https://pay.tagai.fun` 时，出现错误：
```
同步 Privy 用户失败: 无法连接到服务器。
当前 API URL: https://venmootc-api.donut33-social.workers.dev
```

## 🔍 问题原因

1. **FRONTEND_URL 配置错误** - `wrangler.toml` 中的 `FRONTEND_URL` 使用的是 `http://pay.tagai.fun`（HTTP），而实际域名是 `https://pay.tagai.fun`（HTTPS）
2. **CORS 配置不完整** - Workers 的 CORS 配置中没有包含所有可能的前端域名

## ✅ 已修复

### 1. 更新 `wrangler.toml`

```toml
FRONTEND_URL = "https://pay.tagai.fun"  # 从 http:// 改为 https://
```

### 2. 更新 Workers CORS 配置

在 `server/worker/src/index.ts` 中，更新了 `allowedOrigins` 数组：

```typescript
const allowedOrigins = [
  c.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'https://pay.tagai.fun',  // 新增
  'https://venmootc-frontend.pages.dev',  // 新增
  'https://f2f01c88.venmootc-frontend.pages.dev',  // 新增
  'https://b9a495ea.venmootc-frontend.pages.dev',  // 新增
];
```

### 3. 重新部署 Workers

Workers 已成功部署，新的 CORS 配置已生效。

## 🧪 验证

### 1. 测试 API 连接

在浏览器中访问 `https://pay.tagai.fun`，应该不再出现连接错误。

### 2. 检查浏览器控制台

打开浏览器开发者工具（F12）→ **Network** 标签：
- API 请求应该成功（状态码 200）
- 响应头中应该包含 `Access-Control-Allow-Origin: https://pay.tagai.fun`

### 3. 测试 Twitter 登录

1. 点击 Twitter 登录按钮
2. 完成授权
3. 应该能够成功同步 Privy 用户

## 📝 配置总结

### Workers 配置（`wrangler.toml`）

```toml
[vars]
FRONTEND_URL = "https://pay.tagai.fun"
```

### CORS 允许的域名

- `https://pay.tagai.fun`（生产环境）
- `https://venmootc-frontend.pages.dev`（Pages 生产 URL）
- `https://f2f01c88.venmootc-frontend.pages.dev`（部署 URL）
- `https://b9a495ea.venmootc-frontend.pages.dev`（最新部署 URL）
- `http://localhost:3000`（本地开发）

## ⚠️ 重要提示

1. **协议必须匹配** - `FRONTEND_URL` 必须使用与前端域名相同的协议（HTTP 或 HTTPS）
2. **所有域名都要配置** - 如果有多个前端域名，都需要在 CORS 配置中添加
3. **重新部署生效** - 修改 CORS 配置后，必须重新部署 Workers

## 🔗 相关资源

- [Cloudflare Workers CORS 文档](https://developers.cloudflare.com/workers/runtime-apis/request/#cors)
- [Hono CORS 中间件](https://hono.dev/middleware/builtin/cors)

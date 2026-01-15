# 启动服务器指南

## 方法 1：从项目根目录启动（推荐）

由于 `wrangler.toml` 在项目根目录，应该从根目录启动：

```bash
cd /Users/0xnought/Desktop/04\ mini\ Apps/venmoOTC/venmootc
wrangler dev
```

或者：

```bash
cd /Users/0xnought/Desktop/04\ mini\ Apps/venmoOTC/venmootc/server/worker
npm run dev
```

但需要确保 `wrangler.toml` 中的 `main` 路径正确。

## 方法 2：在 server/worker 目录创建独立的 wrangler.toml

如果你想在 `server/worker` 目录中独立运行，可以：

1. 复制 `wrangler.toml` 到 `server/worker/` 目录
2. 修改 `main` 路径为 `src/index.ts`

## 当前配置

- **wrangler.toml 位置**: 项目根目录
- **main 文件**: `server/worker/src/index.ts`
- **环境变量文件**: `server/worker/.dev.vars`

## 启动命令

从项目根目录：
```bash
wrangler dev
```

服务器将在 `http://localhost:8787` 启动。

## 验证服务器运行

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

## 故障排除

### 1. 端口被占用
```bash
lsof -ti:8787 | xargs kill -9
```

### 2. 数据库未初始化
```bash
wrangler d1 execute venmootc-db --local --file=./server/d1-migrations/001_initial_schema.sql
```

### 3. 环境变量未加载
确保 `.dev.vars` 文件在 `server/worker/` 目录中，或者使用 `--env` 参数指定。

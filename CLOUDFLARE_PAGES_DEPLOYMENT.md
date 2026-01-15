# Cloudflare Pages 部署指南

本指南将帮助你将前端应用部署到 Cloudflare Pages。

## 📋 前置要求

1. ✅ 已安装 Wrangler CLI（如果使用 CLI 部署）
2. ✅ 已登录 Cloudflare 账户
3. ✅ 项目已构建成功（`npm run build`）

## 🚀 部署方式

### 方式一：通过 Cloudflare Dashboard 部署（推荐，最简单）

这是最简单的方式，支持 Git 集成和自动部署。

#### 1. 准备 Git 仓库

确保你的代码已推送到 Git 仓库（GitHub、GitLab 或 Bitbucket）。

#### 2. 连接仓库

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Pages** → **Create a project**
3. 选择 **Connect to Git**
4. 授权 Cloudflare 访问你的 Git 仓库
5. 选择仓库：`venmootc`（或你的仓库名）
6. 选择分支：`main` 或 `master`

#### 3. 配置构建设置

在 **Build configuration** 中：

- **Framework preset**: `Vite`
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/`（项目根目录）

#### 4. 配置环境变量

在 **Environment variables** 中添加：

**Production**:
```
VITE_API_URL = https://venmootc-api.donut33-social.workers.dev
VITE_PRIVY_APP_ID = <你的 Privy App ID>
```

**Preview**（可选）:
```
VITE_API_URL = https://venmootc-api.donut33-social.workers.dev
VITE_PRIVY_APP_ID = <你的 Privy App ID>
```

#### 5. 保存并部署

点击 **Save and Deploy**，Cloudflare 会自动：
1. 克隆你的仓库
2. 安装依赖（`npm install`）
3. 执行构建（`npm run build`）
4. 部署 `dist` 目录

#### 6. 自动部署

之后每次推送到连接的 Git 分支，Cloudflare Pages 会自动触发新的部署。

---

### 方式二：通过 Wrangler CLI 部署（手动部署）

适用于需要手动控制部署流程的场景。

#### 1. 构建项目

```bash
cd /Users/0xnought/Desktop/04\ mini\ Apps/venmoOTC/venmootc
npm run build
```

构建完成后，会在 `dist` 目录生成静态文件。

#### 2. 创建 Pages 项目（通过 Dashboard）

由于 CLI 创建项目需要指定生产分支，建议先通过 Dashboard 创建：

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Pages** → **Create a project**
3. 选择 **Upload assets**（不上传，只是创建项目）
4. 输入项目名称：`venmootc-frontend`
5. 点击 **Create project**

#### 3. 部署到 Pages

```bash
# 部署 dist 目录到 Cloudflare Pages
wrangler pages deploy dist --project-name=venmootc-frontend --commit-dirty=true
```

#### 4. 配置环境变量

部署后，需要在 Cloudflare Dashboard 中配置环境变量（见方式一的步骤 4）。

#### 4. 配置环境变量

部署后，需要在 Cloudflare Dashboard 中配置环境变量：

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Pages** → **venmootc-frontend**
3. 点击 **Settings** → **Environment variables**
4. 添加以下环境变量：

**Production 环境变量**：
```
VITE_API_URL = https://venmootc-api.donut33-social.workers.dev
VITE_PRIVY_APP_ID = <你的 Privy App ID>
```

**Preview 环境变量**（可选，用于预览部署）：
```
VITE_API_URL = https://venmootc-api.donut33-social.workers.dev
VITE_PRIVY_APP_ID = <你的 Privy App ID>
```

5. 配置完成后，需要重新部署以应用环境变量：
   ```bash
   npm run build
   wrangler pages deploy dist --project-name=venmootc-frontend
   ```

---

### 方式二：通过 Cloudflare Dashboard 部署（Git 集成）

#### 1. 准备 Git 仓库

确保你的代码已推送到 Git 仓库（GitHub、GitLab 或 Bitbucket）。

#### 2. 连接仓库

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Pages** → **Create a project**
3. 选择 **Connect to Git**
4. 授权 Cloudflare 访问你的 Git 仓库
5. 选择仓库：`venmootc`（或你的仓库名）
6. 选择分支：`main` 或 `master`

#### 3. 配置构建设置

在 **Build configuration** 中：

- **Framework preset**: `Vite`
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/`（项目根目录）

#### 4. 配置环境变量

在 **Environment variables** 中添加：

**Production**:
```
VITE_API_URL = https://venmootc-api.donut33-social.workers.dev
VITE_PRIVY_APP_ID = <你的 Privy App ID>
```

**Preview**（可选）:
```
VITE_API_URL = https://venmootc-api.donut33-social.workers.dev
VITE_PRIVY_APP_ID = <你的 Privy App ID>
```

#### 5. 保存并部署

点击 **Save and Deploy**，Cloudflare 会自动：
1. 克隆你的仓库
2. 安装依赖（`npm install`）
3. 执行构建（`npm run build`）
4. 部署 `dist` 目录

#### 6. 自动部署

之后每次推送到连接的 Git 分支，Cloudflare Pages 会自动触发新的部署。

---

## 🔧 自定义域名配置（可选）

### 1. 添加自定义域名

1. 在 Cloudflare Dashboard 中进入你的 Pages 项目
2. 点击 **Custom domains** → **Set up a custom domain**
3. 输入你的域名（例如：`pay.tagai.fun`）
4. 按照提示配置 DNS 记录

### 2. 更新 Workers CORS 配置

如果你的前端使用自定义域名，需要更新 Workers 的 `FRONTEND_URL`：

1. 编辑 `wrangler.toml`：
   ```toml
   [vars]
   FRONTEND_URL = "https://pay.tagai.fun"  # 更新为你的自定义域名
   ```

2. 重新部署 Workers：
   ```bash
   wrangler deploy
   ```

---

## 📝 部署检查清单

### 部署前

- [ ] 本地构建成功（`npm run build`）
- [ ] 检查 `dist` 目录是否包含所有静态文件
- [ ] 确认环境变量值正确

### 部署后

- [ ] 访问部署的 URL（例如：`https://venmootc-frontend.pages.dev`）
- [ ] 打开浏览器开发者工具（F12）→ Network 标签
- [ ] 检查 API 请求是否指向正确的 Workers URL
- [ ] 测试登录功能
- [ ] 测试主要功能（查看用户、交易等）

---

## 🐛 常见问题

### 1. 环境变量未生效

**问题**：前端仍在使用旧的 API URL 或环境变量未加载。

**解决方案**：
- 确认环境变量在 Cloudflare Dashboard 中已正确配置
- 重新构建并部署（环境变量在构建时注入）
- 清除浏览器缓存并硬刷新（Ctrl+Shift+R 或 Cmd+Shift+R）

### 2. CORS 错误

**问题**：浏览器控制台显示 CORS 错误。

**解决方案**：
- 确认 Workers 的 `FRONTEND_URL` 配置为你的 Pages 域名
- 重新部署 Workers：`wrangler deploy`
- 检查 Pages 域名是否正确（包括 `https://` 协议）

### 3. 404 错误（刷新页面）

**问题**：直接访问子路径或刷新页面时返回 404。

**解决方案**：
- 虽然这个应用没有路由，但如果将来添加了路由，需要创建 `public/_redirects` 文件：
  ```
  /*    /index.html   200
  ```

### 4. 构建失败

**问题**：Cloudflare Pages 构建失败。

**解决方案**：
- 检查构建日志中的错误信息
- 确认 `package.json` 中的依赖版本兼容
- 在本地测试构建：`npm run build`
- 检查 Node.js 版本（Cloudflare Pages 默认使用 Node.js 18）

---

## 📊 部署状态

部署成功后，你可以在 Cloudflare Dashboard 中查看：
- **Deployments**：所有部署历史
- **Analytics**：访问统计
- **Functions**：如果使用了 Cloudflare Functions
- **Custom domains**：自定义域名配置

---

## 🔗 相关链接

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Wrangler Pages 命令](https://developers.cloudflare.com/workers/wrangler/commands/#pages)
- [环境变量配置](https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables)

---

## ✅ 部署完成后的下一步

1. ✅ 前端已部署到 Cloudflare Pages
2. ✅ 后端已部署到 Cloudflare Workers
3. ✅ 数据库已迁移到 Cloudflare D1
4. ⏳ 测试完整的前后端集成
5. ⏳ 配置自定义域名（如需要）
6. ⏳ 设置监控和告警（如需要）

---

**部署完成后，你的应用将可以通过 Cloudflare Pages 的 URL 访问！**

# Cloudflare Pages 部署流程指南（仅前端）

## 项目架构概览

本项目前端部分：
- **前端**：React + Vite 应用
- **后端**：已部署在其他平台（如 Railway、Render、Vercel 等）

## 部署方案

**方案：仅部署前端到 Cloudflare Pages**

适合场景：后端已部署在其他平台，只需将前端静态应用部署到 Cloudflare Pages。

---

## 第一步：准备前端部署

### 1.1 检查构建脚本

确保 `package.json` 中有构建脚本：
```json
{
  "scripts": {
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### 1.2 检查 Vite 配置

确保 `vite.config.ts` 中的构建输出目录正确：
```typescript
build: {
  outDir: 'dist',
  // ...
}
```

### 1.3 准备环境变量

确定需要配置的环境变量（这些将在 Cloudflare Pages 中设置）：

- `VITE_API_URL` - 后端 API 地址（必需）
- `VITE_PRIVY_APP_ID` - Privy 应用 ID（如果使用）
- `VITE_BLOCKCHAIN_RPC_URL` - 区块链 RPC URL（如果使用）
- 其他前端需要的环境变量

**注意**：环境变量名必须以 `VITE_` 开头才能在 Vite 中使用。

### 1.4 测试本地构建

在部署前，先测试本地构建是否成功：

```bash
# 安装依赖（如果还没有）
npm install

# 构建项目
npm run build

# 预览构建结果
npm run preview
```

确保构建成功且预览正常。

---

## 第二步：部署到 Cloudflare Pages

### 2.1 通过 Cloudflare Dashboard 部署（推荐）

#### 步骤 1：登录 Cloudflare Dashboard

1. 访问 https://dash.cloudflare.com
2. 登录你的 Cloudflare 账户
3. 如果没有账户，先注册一个免费账户

#### 步骤 2：创建 Pages 项目

1. 在左侧菜单中，点击 **Workers & Pages**
2. 点击 **Create application**
3. 选择 **Pages** 标签
4. 点击 **Connect to Git**
5. 选择你的 Git 提供商（GitHub、GitLab 或 Bitbucket）
6. 授权 Cloudflare 访问你的仓库
7. 选择包含前端代码的仓库

#### 步骤 3：配置构建设置

在项目设置页面配置以下内容：

- **Project name**: 输入项目名称（如 `venmootc-frontend`）
- **Production branch**: 选择主分支（通常是 `main` 或 `master`）
- **Framework preset**: 选择 **Vite**
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/`（项目根目录，如果前端代码在根目录）

#### 步骤 4：配置环境变量

在构建设置页面，找到 **Environment variables** 部分：

1. 点击 **Add variable**
2. 添加以下环境变量（根据你的实际需求）：

```
VITE_API_URL=https://your-backend-api.com
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_BLOCKCHAIN_RPC_URL=https://bsc-dataseed.binance.org
```

**重要提示**：
- 环境变量名必须以 `VITE_` 开头
- 可以分别为 Production、Preview 和 Development 环境设置不同的值
- 敏感信息（如 API 密钥）应该使用环境变量，不要硬编码

#### 步骤 5：保存并部署

1. 点击 **Save and Deploy**
2. Cloudflare 会自动：
   - 克隆你的仓库
   - 安装依赖（`npm install`）
   - 运行构建命令（`npm run build`）
   - 部署构建结果到 Cloudflare 的 CDN

3. 等待构建完成（通常需要 2-5 分钟）
4. 构建成功后，你会获得一个 Pages URL，格式为：
   ```
   https://your-project-name.pages.dev
   ```

### 2.2 通过 Wrangler CLI 部署（可选）

如果你更喜欢使用命令行工具：

```bash
# 1. 安装 Wrangler CLI
npm install -g wrangler

# 2. 登录 Cloudflare
wrangler login

# 3. 在项目根目录构建项目
npm run build

# 4. 部署到 Cloudflare Pages
wrangler pages deploy dist --project-name=your-project-name
```

---

## 第三步：配置自定义域名（可选）

### 3.1 添加自定义域名

1. 在 Cloudflare Pages 项目页面，点击 **Custom domains**
2. 点击 **Set up a custom domain**
3. 输入你的域名（如 `app.yourdomain.com`）
4. Cloudflare 会自动配置 DNS 记录

### 3.2 配置 DNS（如果域名不在 Cloudflare）

如果域名不在 Cloudflare 管理：

1. 在 Cloudflare Pages 设置中，你会看到需要添加的 DNS 记录
2. 在你的域名注册商或 DNS 提供商处添加 CNAME 记录：
   ```
   类型: CNAME
   名称: app（或你想要的子域名）
   值: your-project-name.pages.dev
   ```

---

## 第四步：配置后端 CORS（重要）

确保后端 API 允许来自 Cloudflare Pages 域名的请求。

### 更新后端 CORS 配置

在你的后端服务器代码中（例如 `server/src/index.ts`），更新 CORS 配置：

```typescript
app.use(cors({
  origin: [
    'https://your-project-name.pages.dev',  // Cloudflare Pages 默认域名
    'https://app.yourdomain.com',            // 自定义域名（如果有）
    'http://localhost:3000',                 // 本地开发（可选）
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));
```

**重要**：部署后端后，记得更新 CORS 配置并重启服务。

---

## 第五步：验证部署

### 5.1 检查前端部署

1. 访问你的 Cloudflare Pages URL
2. 检查页面是否正常加载
3. 打开浏览器开发者工具（F12），检查：
   - 控制台是否有错误
   - 网络请求是否正常
   - API 调用是否成功

### 5.2 测试功能

- [ ] 页面可以正常访问
- [ ] 前端可以连接到后端 API
- [ ] 用户认证流程正常（如果使用）
- [ ] 区块链交互正常（如果使用）
- [ ] 所有主要功能正常工作

### 5.3 检查环境变量

如果发现环境变量未生效：

1. 在 Cloudflare Pages 设置中检查环境变量是否正确配置
2. 确保环境变量名以 `VITE_` 开头
3. 重新部署项目以应用新的环境变量

---

## 部署检查清单

### 部署前检查
- [ ] `package.json` 中有 `build` 脚本
- [ ] `vite.config.ts` 配置正确
- [ ] 本地构建测试成功：`npm run build`
- [ ] 本地预览测试正常：`npm run preview`
- [ ] 已确定所有需要的环境变量
- [ ] 后端 API 地址已确认

### 部署时检查
- [ ] Git 仓库已连接到 Cloudflare Pages
- [ ] 构建设置正确（Framework preset: Vite）
- [ ] 构建命令：`npm run build`
- [ ] 输出目录：`dist`
- [ ] 所有环境变量已配置
- [ ] 环境变量名以 `VITE_` 开头

### 部署后检查
- [ ] 前端可以正常访问
- [ ] 页面样式正常显示
- [ ] 前端可以连接到后端 API
- [ ] 没有 CORS 错误
- [ ] 用户认证流程正常（如果使用）
- [ ] 区块链交互正常（如果使用）
- [ ] 自定义域名配置正确（如果使用）

---

## 常见问题

### 1. 构建失败

**问题**：Cloudflare Pages 构建失败

**解决方案**：
- 检查 Node.js 版本（Cloudflare Pages 默认使用 Node 18+）
- 在项目根目录创建 `.nvmrc` 文件指定 Node 版本：
  ```
  18
  ```
- 检查 `package.json` 中的依赖是否正确
- 查看 Cloudflare Pages 构建日志中的详细错误信息
- 确保所有依赖都可以正常安装

### 2. 环境变量未生效

**问题**：环境变量在部署后没有生效

**解决方案**：
- 确保环境变量名以 `VITE_` 开头
- 在代码中使用 `import.meta.env.VITE_*` 访问环境变量
- 检查环境变量是否在正确的环境（Production/Preview）中设置
- 重新部署项目以应用新的环境变量
- 清除浏览器缓存后重新加载

### 3. CORS 错误

**问题**：前端无法访问后端 API，出现 CORS 错误

**解决方案**：
- 检查后端 CORS 配置
- 确保 Cloudflare Pages 域名已添加到后端 CORS 允许列表
- 检查后端是否支持 `credentials: true`
- 确认后端 API 地址正确（`VITE_API_URL`）

### 4. 页面空白或 404 错误

**问题**：访问页面时显示空白或 404

**解决方案**：
- 检查构建输出目录是否正确（应该是 `dist`）
- 确保 `vite.config.ts` 中的 `base` 配置正确
- 如果是单页应用（SPA），在 Cloudflare Pages 设置中添加重写规则：
  - 在项目设置中找到 **Functions** → **Redirects**
  - 添加规则：`/* /index.html 200`

### 5. 资源加载失败

**问题**：CSS、JS 或其他资源文件无法加载

**解决方案**：
- 检查资源路径是否正确
- 确保 `vite.config.ts` 中的 `base` 配置正确
- 检查构建输出中是否包含所有资源文件
- 清除浏览器缓存

### 6. API 请求失败

**问题**：前端无法连接到后端 API

**解决方案**：
- 检查 `VITE_API_URL` 环境变量是否正确
- 确认后端 API 服务正在运行
- 检查网络请求的 URL 是否正确
- 查看浏览器控制台的错误信息
- 确认后端 CORS 配置允许前端域名

---

## 持续部署

### 自动部署

Cloudflare Pages 支持自动部署：

- **自动触发**：每次推送到连接的 Git 分支时，会自动触发构建和部署
- **预览部署**：推送到其他分支时，会创建预览部署
- **手动部署**：也可以在 Dashboard 中手动触发部署

### 部署历史

在 Cloudflare Pages 项目页面，你可以：
- 查看所有部署历史
- 回滚到之前的部署版本
- 查看每次部署的构建日志

---

## 推荐部署架构

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
│   后端 API 服务器        │
│   (Railway/Render/等)   │
│   api.yourdomain.com    │
└────────────┬────────────┘
             │
        ┌────┴────┐
        │         │
   ┌────▼───┐ ┌──▼────┐
   │ MySQL  │ │ BNB   │
   │ 数据库  │ │ Chain │
   └────────┘ └───────┘
```

---

## 下一步

1. ✅ 准备前端代码和配置
2. ✅ 测试本地构建
3. ✅ 部署到 Cloudflare Pages
4. ✅ 配置环境变量
5. ✅ 配置自定义域名（可选）
6. ✅ 更新后端 CORS 配置
7. ✅ 验证部署和功能
8. ✅ 监控和优化

---

## 参考资源

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Cloudflare Pages 快速开始](https://developers.cloudflare.com/pages/get-started/)
- [Vite 部署指南](https://vitejs.dev/guide/static-deploy.html)
- [Vite 环境变量](https://vitejs.dev/guide/env-and-mode.html)
- [Cloudflare Pages 环境变量](https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables)

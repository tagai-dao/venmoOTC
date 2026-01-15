# 前端部署准备就绪 ✅

## 📦 构建状态

✅ **构建成功** - `dist` 目录已生成，包含所有静态文件。

## 🚀 部署选项

### 选项 1：通过 Cloudflare Dashboard 部署（推荐）⭐

**优点**：
- 最简单，支持 Git 集成
- 自动部署（每次 push 自动触发）
- 可视化配置环境变量

**步骤**：

1. **访问 Cloudflare Dashboard**
   - 打开：https://dash.cloudflare.com/
   - 进入 **Pages** → **Create a project**

2. **连接 Git 仓库**
   - 选择 **Connect to Git**
   - 授权 Cloudflare 访问你的 Git 仓库
   - 选择仓库和分支（`main` 或 `master`）

3. **配置构建设置**
   ```
   Framework preset: Vite
   Build command: npm run build
   Build output directory: dist
   Root directory: /
   ```

4. **配置环境变量**（重要！）
   
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

5. **保存并部署**
   - 点击 **Save and Deploy**
   - Cloudflare 会自动构建并部署

6. **获取部署 URL**
   - 部署完成后，你会得到一个 URL，例如：
     `https://venmootc-frontend.pages.dev`
   - 或者如果你配置了自定义域名，使用你的自定义域名

---

### 选项 2：通过 Wrangler CLI 手动部署

**适用场景**：需要手动控制部署，不使用 Git 集成

**步骤**：

1. **先通过 Dashboard 创建项目**（必需）
   - 访问 https://dash.cloudflare.com/ → Pages
   - 点击 **Create a project** → **Upload assets**
   - 项目名称：`venmootc-frontend`
   - 点击 **Create project**（不需要实际上传文件）

2. **使用部署脚本**
   ```bash
   ./deploy-frontend.sh
   ```
   
   或者手动执行：
   ```bash
   npm run build
   wrangler pages deploy dist --project-name=venmootc-frontend --commit-dirty=true
   ```

3. **配置环境变量**（在 Dashboard 中）
   - 进入项目设置 → **Environment variables**
   - 添加 `VITE_API_URL` 和 `VITE_PRIVY_APP_ID`

---

## ⚙️ 环境变量配置

### 必需的环境变量

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VITE_API_URL` | `https://venmootc-api.donut33-social.workers.dev` | Workers API 地址 |
| `VITE_PRIVY_APP_ID` | `<你的 Privy App ID>` | Privy 应用 ID |

### 如何获取 Privy App ID

1. 访问 [Privy Dashboard](https://dashboard.privy.io/)
2. 选择你的应用
3. 在 **Settings** → **App ID** 中查看

---

## 🔍 部署后验证

部署完成后，请验证：

1. **访问部署的 URL**
   - 打开浏览器访问你的 Pages URL

2. **检查 API 连接**
   - 打开浏览器开发者工具（F12）→ **Network** 标签
   - 执行任何操作（如登录）
   - 检查请求 URL，应该显示：
     ```
     https://venmootc-api.donut33-social.workers.dev/api/...
     ```

3. **测试功能**
   - ✅ 登录功能
   - ✅ 查看用户列表
   - ✅ 查看交易
   - ✅ 其他核心功能

---

## 🔧 更新 Workers CORS 配置

如果你的前端部署到了新的域名，需要更新 Workers 的 `FRONTEND_URL`：

1. **编辑 `wrangler.toml`**：
   ```toml
   [vars]
   FRONTEND_URL = "https://venmootc-frontend.pages.dev"  # 或你的自定义域名
   ```

2. **重新部署 Workers**：
   ```bash
   wrangler deploy
   ```

---

## 📝 当前状态

- ✅ 前端代码已更新为使用环境变量
- ✅ 构建配置已修复（Solana 依赖问题）
- ✅ 构建成功，`dist` 目录已生成
- ✅ 部署脚本已创建（`deploy-frontend.sh`）
- ✅ 部署指南已创建（`CLOUDFLARE_PAGES_DEPLOYMENT.md`）
- ⏳ 等待部署到 Cloudflare Pages
- ⏳ 等待配置环境变量

---

## 🎯 下一步

1. **选择部署方式**（推荐使用 Dashboard 方式）
2. **执行部署**
3. **配置环境变量**
4. **验证部署**
5. **更新 Workers CORS**（如果需要）

---

## 📚 相关文档

- `CLOUDFLARE_PAGES_DEPLOYMENT.md` - 详细部署指南
- `PRODUCTION_API_URL.md` - API 端点列表
- `API_TEST_RESULTS.md` - API 测试结果

---

**准备好部署了吗？选择一种方式开始吧！** 🚀

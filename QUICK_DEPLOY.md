# 快速部署指南

## ⚠️ 当前状态

✅ **构建已完成** - `dist` 目录已准备好  
❌ **项目未创建** - 需要先在 Cloudflare Dashboard 创建 Pages 项目

## 🚀 快速部署步骤

### 步骤 1：创建 Pages 项目（必需）

1. **访问 Cloudflare Dashboard**
   - 打开：https://dash.cloudflare.com/
   - 进入 **Pages** → **Create a project**

2. **选择 "Upload assets"**
   - 点击 **Upload assets**（不需要实际上传文件，只是创建项目）
   - 项目名称输入：`venmootc-frontend`
   - 点击 **Create project**

3. **项目创建完成**
   - 你会看到一个空项目，这是正常的

### 步骤 2：部署前端

项目创建后，执行：

```bash
cd /Users/0xnought/Desktop/04\ mini\ Apps/venmoOTC/venmootc
wrangler pages deploy dist --project-name=venmootc-frontend --commit-dirty=true
```

### 步骤 3：配置环境变量（重要！）

部署完成后，在 Dashboard 中配置环境变量：

1. 进入项目：**Pages** → **venmootc-frontend** → **Settings**
2. 点击 **Environment variables**
3. 添加以下变量：

**Production**:
```
VITE_API_URL = https://venmootc-api.donut33-social.workers.dev
VITE_PRIVY_APP_ID = <你的 Privy App ID>
```

4. **重新部署**以应用环境变量：
   ```bash
   npm run build
   wrangler pages deploy dist --project-name=venmootc-frontend --commit-dirty=true
   ```

## ✅ 完成

部署完成后，你会得到一个 URL，例如：
- `https://venmootc-frontend.pages.dev`

访问该 URL 即可查看你的应用！

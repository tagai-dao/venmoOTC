# API URL 配置问题修复

## 🐛 问题描述

访问 `pay.tagai.fun` 时，Twitter 登录成功后出现错误：
```
同步 Privy 用户失败: 无法连接到服务器。请确保服务器正在运行在 http://localhost:3001
```

## 🔍 问题原因

前端代码仍在使用 `http://localhost:3001` 作为 API URL，说明环境变量 `VITE_API_URL` 在 Cloudflare Pages 中**未正确配置**或**未生效**。

## ✅ 解决步骤

### 步骤 1：检查 Cloudflare Pages 环境变量

1. **访问 Cloudflare Dashboard**
   - 打开：https://dash.cloudflare.com/
   - 进入 **Pages** → **venmootc-frontend** → **Settings** → **Environment variables**

2. **检查 Production 环境变量**

   确认以下变量已配置：
   ```
   VITE_API_URL = https://venmootc-api.donut33-social.workers.dev
   VITE_PRIVY_APP_ID = <你的 Privy App ID>
   ```

3. **检查变量值**
   - 确保 `VITE_API_URL` 的值是 `https://venmootc-api.donut33-social.workers.dev`
   - 确保没有多余的空格或引号
   - 确保变量名拼写正确（`VITE_API_URL`，不是 `API_URL` 或其他）

### 步骤 2：重新部署前端（如果修改了环境变量）

**重要**：如果修改了环境变量，必须重新构建并部署前端，因为 Vite 的环境变量在**构建时**注入。

```bash
cd /Users/0xnought/Desktop/04\ mini\ Apps/venmoOTC/venmootc
npm run build
wrangler pages deploy dist --project-name=venmootc-frontend --commit-dirty=true
```

### 步骤 3：验证配置

1. **打开部署的页面**：`https://pay.tagai.fun`
2. **打开浏览器开发者工具**（F12）→ **Console** 标签
3. **检查 API 请求**：
   - 查看 Network 标签中的 API 请求
   - 确认请求 URL 是 `https://venmootc-api.donut33-social.workers.dev/api/...`
   - 而不是 `http://localhost:3001/api/...`

4. **在控制台运行**：
   ```javascript
   console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
   ```
   
   应该显示：`https://venmootc-api.donut33-social.workers.dev`
   
   如果显示 `undefined`，说明环境变量未正确配置。

## 🔧 调试步骤

### 1. 检查环境变量是否生效

在浏览器控制台中运行：
```javascript
console.log('API URL:', import.meta.env.VITE_API_URL);
console.log('Privy App ID:', import.meta.env.VITE_PRIVY_APP_ID);
```

### 2. 检查构建时的环境变量

如果使用 Git 集成部署，检查构建日志：
- 进入 Cloudflare Dashboard → Pages → venmootc-frontend → **Deployments**
- 查看最新的部署日志
- 检查是否有环境变量相关的错误

### 3. 检查 Network 请求

在浏览器开发者工具的 **Network** 标签中：
- 查看失败的 API 请求
- 检查请求的 URL
- 如果 URL 是 `http://localhost:3001`，说明环境变量未生效

## 📝 环境变量配置清单

### Production 环境

```
VITE_API_URL = https://venmootc-api.donut33-social.workers.dev
VITE_PRIVY_APP_ID = <你的 Privy App ID>
```

### Preview 环境（可选）

```
VITE_API_URL = https://venmootc-api.donut33-social.workers.dev
VITE_PRIVY_APP_ID = <你的 Privy App ID>
```

## ⚠️ 重要提示

1. **环境变量在构建时注入** - Vite 的环境变量在构建时注入到代码中，修改后必须重新构建
2. **变量名必须以 `VITE_` 开头** - 只有以 `VITE_` 开头的环境变量才会暴露给前端代码
3. **不要使用引号** - 在 Cloudflare Pages 中配置环境变量时，值不需要加引号
4. **清除浏览器缓存** - 修改后清除浏览器缓存并硬刷新（Ctrl+Shift+R）

## 🔗 相关资源

- [Cloudflare Pages 环境变量文档](https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables)
- [Vite 环境变量文档](https://vitejs.dev/guide/env-and-mode.html)

## ✅ 验证清单

- [ ] `VITE_API_URL` 在 Cloudflare Pages 环境变量中已配置
- [ ] 变量值是 `https://venmootc-api.donut33-social.workers.dev`（没有引号）
- [ ] 如果修改了环境变量，已重新构建并部署
- [ ] 浏览器控制台显示正确的 API URL
- [ ] Network 标签中的请求指向正确的 API URL

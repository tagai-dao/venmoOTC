# Privy "Origin not allowed" 错误修复

## 🐛 错误信息

```
POST https://auth.privy.io/api/v1/oauth/init 403 (Forbidden)
Uncaught (in promise) f3: Origin not allowed
```

## 🔍 问题原因

Privy 需要在 Dashboard 中配置**允许的域名（Allowed Origins）**，否则会拒绝来自未授权域名的请求。

## ✅ 解决步骤

### 步骤 1：访问 Privy Dashboard

1. 打开：https://dashboard.privy.io/
2. 选择你的应用
3. 进入 **Settings** → **Security**

### 步骤 2：配置 Allowed Origins

在 **Allowed Origins** 部分，添加以下域名：

**生产环境**：
```
https://f2f01c88.venmootc-frontend.pages.dev
https://venmootc-frontend.pages.dev
```

**如果你有自定义域名**：
```
https://你的自定义域名.com
https://www.你的自定义域名.com
```

**开发环境（可选）**：
```
http://localhost:3000
http://127.0.0.1:3000
```

### 步骤 3：配置 Redirect URIs（如果还没有配置）

在 **OAuth Providers** → **Twitter** → **Redirect URIs** 中，确保已添加：

```
https://f2f01c88.venmootc-frontend.pages.dev
https://venmootc-frontend.pages.dev
```

### 步骤 4：保存配置

点击 **Save** 保存所有更改。

### 步骤 5：清除浏览器缓存并测试

1. 清除浏览器缓存（Ctrl+Shift+Delete 或 Cmd+Shift+Delete）
2. 硬刷新页面（Ctrl+Shift+R 或 Cmd+Shift+R）
3. 重新测试 Twitter 登录

## 📝 配置示例

### Allowed Origins 配置

```
https://f2f01c88.venmootc-frontend.pages.dev
https://venmootc-frontend.pages.dev
http://localhost:3000
```

### Redirect URIs 配置（Twitter OAuth）

```
https://f2f01c88.venmootc-frontend.pages.dev
https://venmootc-frontend.pages.dev
```

## ⚠️ 重要提示

1. **域名必须完全匹配** - 包括协议（https://）和路径
2. **不要添加尾部斜杠** - `https://example.com` 而不是 `https://example.com/`
3. **每个域名单独一行**
4. **保存后立即生效** - 不需要重新部署应用

## 🔍 验证配置

配置完成后，在浏览器控制台中应该不再看到 `Origin not allowed` 错误。

如果仍然有问题，检查：
1. 域名拼写是否正确
2. 是否包含了 `https://` 协议
3. 是否保存了配置
4. 是否清除了浏览器缓存

## 🔗 相关资源

- [Privy Dashboard](https://dashboard.privy.io/)
- [Privy Security Settings 文档](https://docs.privy.io/guide/dashboard/security)

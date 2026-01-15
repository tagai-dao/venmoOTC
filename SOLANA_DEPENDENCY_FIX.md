# Solana 依赖错误修复

## 🐛 问题描述

浏览器打开部署的前端应用时出现以下错误：

```
Uncaught TypeError: Failed to resolve module specifier "@solana/kit". 
Relative references must start with either "/", "./", or "../".
```

## 🔍 问题原因

Privy 的 React SDK (v3) 包含 Solana 相关的可选依赖：
- `@solana/kit`
- `@solana-program/memo`
- `@solana-program/system`
- `@solana-program/token`

这些依赖是可选的（仅在使用 Solana 钱包时需要），但 Privy 的代码中仍然会尝试动态导入它们。如果这些依赖不存在或未正确配置，会导致运行时错误。

## ✅ 解决方案

### 1. 创建空模块存根

创建了 `public/solana-stub.js` 文件，提供空模块来替换 Solana 依赖：

```javascript
// 空模块，用于替换 Solana 可选依赖
export default {};
export const getTransactionDecoder = () => {};
export const getBase64Decoder = () => {};
export const getBase58Encoder = () => {};
```

### 2. 更新 Vite 配置

在 `vite.config.ts` 中添加了 `resolve.alias` 配置，将 Solana 依赖指向空模块：

```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, '.'),
    // 为 Solana 可选依赖提供空模块，避免运行时错误
    '@solana/kit': path.resolve(__dirname, 'public/solana-stub.js'),
    '@solana-program/memo': path.resolve(__dirname, 'public/solana-stub.js'),
    '@solana-program/system': path.resolve(__dirname, 'public/solana-stub.js'),
    '@solana-program/token': path.resolve(__dirname, 'public/solana-stub.js'),
  },
  dedupe: ['ethers']
},
optimizeDeps: {
  include: ['ethers', '@privy-io/react-auth'],
  // 排除 Solana 可选依赖，避免预构建错误
  exclude: [
    '@solana/kit',
    '@solana-program/memo',
    '@solana-program/system',
    '@solana-program/token'
  ],
  esbuildOptions: {
    target: 'es2020'
  }
}
```

## 📦 部署状态

✅ **构建成功** - 已修复 Solana 依赖问题  
✅ **部署成功** - 新版本已部署

**新部署 URL**: https://2a10b252.venmootc-frontend.pages.dev

## 🧪 验证

请在浏览器中访问新的部署 URL，检查是否还有 Solana 相关的错误：

1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签
3. 确认没有 `@solana/kit` 相关的错误

## 📝 注意事项

- 如果你将来需要使用 Solana 钱包功能，需要：
  1. 安装 Solana 依赖：`npm install @solana/kit @solana-program/memo @solana-program/system @solana-program/token`
  2. 移除 `vite.config.ts` 中的 alias 配置
  3. 从 `optimizeDeps.exclude` 中移除这些包

- 当前配置适用于不使用 Solana 的场景，所有 Solana 相关的导入都会被替换为空模块

## 🔗 相关资源

- [Privy v3 迁移指南](https://docs.privy.io/basics/react/advanced/migrating-to-3.0)
- [Vite 配置文档](https://vitejs.dev/config/)

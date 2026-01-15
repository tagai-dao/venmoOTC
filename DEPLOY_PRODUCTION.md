# 生产环境部署指南

## ✅ 已完成

1. **生产环境数据库迁移** - 已成功执行
   - 32 个 SQL 命令执行成功
   - 创建了 8 个表
   - 数据库大小: 0.20 MB

## 📋 部署步骤

### 1. 设置敏感环境变量

使用 `wrangler secret put` 设置以下敏感变量：

```bash
# JWT 密钥
echo "dev_jwt_secret_key_change_in_production_12345" | wrangler secret put JWT_SECRET

# Privy 应用密钥
echo "privy_app_secret_LrrzEoizVFiBdptjUxtToauuLXkJtRvBsNAYwd5ppd9bvNkPFbpcK7e3pfZBUKnH9cBuge9CJz33JeqBQXdZDeQ" | wrangler secret put PRIVY_APP_SECRET

# Twitter 客户端密钥
echo "x21iWchb3WA3_gjMnr1Ns_sDZVs2sTBkV-V5LOmQLLzxnHgs8L" | wrangler secret put TWITTER_CLIENT_SECRET

# 私钥（如果有）
# echo "your_private_key" | wrangler secret put PRIVATE_KEY
```

### 2. 更新 wrangler.toml

已更新以下非敏感变量：
- `PRIVY_APP_ID` = cmdo1m1zt004ljl0kmspeb8rn
- `TWITTER_CLIENT_ID` = ZXRMRVpUV2ZKNFdVekZzNklPNU46MTpjaQ
- `FRONTEND_URL` = http://localhost:3000（需要更新为实际的前端 URL）

### 3. 部署 Workers

```bash
cd /Users/0xnought/Desktop/04\ mini\ Apps/venmoOTC/venmootc
wrangler deploy
```

### 4. 验证部署

部署成功后，Workers 会获得一个 URL：
```
https://venmootc-api.your-subdomain.workers.dev
```

测试健康检查：
```bash
curl https://venmootc-api.your-subdomain.workers.dev/health
```

## ⚠️ 重要提示

1. **更新 FRONTEND_URL**
   - 在 `wrangler.toml` 中更新 `FRONTEND_URL` 为实际的前端部署地址
   - 或在 Cloudflare Dashboard 中设置

2. **JWT_SECRET**
   - 生产环境应使用强随机密钥
   - 当前使用的是开发密钥，建议更换

3. **PRIVATE_KEY**
   - 如果需要进行区块链操作，需要设置 `PRIVATE_KEY`
   - 确保私钥安全，不要泄露

4. **自定义域名**
   - 可以在 Cloudflare Dashboard 中配置自定义域名
   - 或使用 `routes` 配置在 `wrangler.toml` 中

## 📝 部署后检查清单

- [ ] 所有敏感环境变量已设置
- [ ] FRONTEND_URL 已更新为实际地址
- [ ] Workers 部署成功
- [ ] 健康检查端点正常
- [ ] 测试主要 API 端点
- [ ] 配置自定义域名（可选）
- [ ] 更新前端 API URL

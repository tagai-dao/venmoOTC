#!/bin/bash

# Cloudflare Pages 前端部署脚本

set -e

echo "🚀 开始部署前端到 Cloudflare Pages..."

# 1. 构建项目
echo "📦 构建项目..."
npm run build

# 2. 检查构建结果
if [ ! -d "dist" ]; then
    echo "❌ 构建失败：dist 目录不存在"
    exit 1
fi

echo "✅ 构建成功！"

# 3. 部署到 Cloudflare Pages
echo "📤 部署到 Cloudflare Pages..."
wrangler pages deploy dist --project-name=venmootc-frontend --commit-dirty=true

echo "✅ 部署完成！"
echo ""
echo "📝 下一步："
echo "1. 访问 Cloudflare Dashboard 配置环境变量："
echo "   - VITE_API_URL = https://venmootc-api.donut33-social.workers.dev"
echo "   - VITE_PRIVY_APP_ID = <你的 Privy App ID>"
echo "2. 配置完成后，重新部署以应用环境变量"
echo ""
echo "🔗 查看部署：https://dash.cloudflare.com/ → Pages → venmootc-frontend"

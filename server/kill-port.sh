#!/bin/bash

# 查找并终止占用端口 3001 的进程

PORT=3001

echo "🔍 查找占用端口 $PORT 的进程..."

# 方法 1: 使用 lsof
PID=$(lsof -ti :$PORT)

if [ -z "$PID" ]; then
  echo "❌ 未找到占用端口 $PORT 的进程"
  echo "💡 尝试其他方法..."
  
  # 方法 2: 使用 netstat (macOS)
  PID=$(netstat -anv | grep ":$PORT" | grep LISTEN | awk '{print $9}' | head -1)
fi

if [ -n "$PID" ]; then
  echo "✅ 找到进程 PID: $PID"
  echo "🛑 正在终止进程..."
  kill -9 $PID
  sleep 1
  echo "✅ 进程已终止"
else
  echo "⚠️  未找到占用端口的进程，可能已经释放"
fi

echo ""
echo "🚀 现在可以启动服务器了："
echo "   cd server && npm run dev"

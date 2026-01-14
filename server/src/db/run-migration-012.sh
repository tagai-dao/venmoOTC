#!/bin/bash
# 手动运行迁移 012: 添加 country 字段到 users 表

echo "📜 Running migration 012: Add country column to users table..."

# 从 .env 文件读取数据库配置
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}
DB_NAME=${DB_NAME:-venmootc}
DB_USER=${DB_USER:-root}
DB_PASSWORD=${DB_PASSWORD:-}

# 执行 SQL
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" <<EOF
-- 添加 country 字段到 users 表
ALTER TABLE users 
ADD COLUMN country VARCHAR(100) NULL AFTER account_name;
EOF

if [ $? -eq 0 ]; then
  echo "✅ Migration 012 completed successfully!"
else
  echo "❌ Migration 012 failed. The column might already exist."
  echo "ℹ️  If the column already exists, you can ignore this error."
fi

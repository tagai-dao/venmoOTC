#!/bin/bash
# 手动执行迁移 009：添加 twitter_access_token 字段

# 从 .env 文件读取数据库配置
DB_HOST=$(grep DB_HOST .env | cut -d '=' -f2 | tr -d ' ' || echo 'localhost')
DB_PORT=$(grep DB_PORT .env | cut -d '=' -f2 | tr -d ' ' || echo '3306')
DB_NAME=$(grep DB_NAME .env | cut -d '=' -f2 | tr -d ' ' || echo 'venmootc')
DB_USER=$(grep DB_USER .env | cut -d '=' -f2 | tr -d ' ' || echo 'root')
DB_PASSWORD=$(grep DB_PASSWORD .env | cut -d '=' -f2 | tr -d ' ' || echo '')

echo "📜 Running migration 009: Add twitter_access_token column..."
echo "Database: $DB_NAME"
echo ""

# 如果密码存在，使用密码
if [ -z "$DB_PASSWORD" ]; then
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" < src/db/migrations/009_add_twitter_access_token.sql
else
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < src/db/migrations/009_add_twitter_access_token.sql
fi

if [ $? -eq 0 ]; then
    echo "✅ Migration 009 executed successfully!"
else
    echo "⚠️ Migration may have failed or column already exists."
    echo "Check the error message above for details."
fi

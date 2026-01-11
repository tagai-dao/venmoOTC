-- 添加 Twitter access token 字段到 users 表
-- 用于存储用户的 Twitter OAuth access token，以便后端帮助用户发推

-- 使用 IF NOT EXISTS 方式检查字段是否存在（MySQL 不支持直接使用 IF NOT EXISTS，所以使用存储过程或直接执行）
ALTER TABLE users ADD COLUMN twitter_access_token TEXT;

-- 创建索引（如果索引已存在，会报错，但会被 catch 块捕获）
CREATE INDEX idx_users_twitter_token ON users(twitter_access_token(50));

-- 添加 Twitter refresh token 和 token 过期时间字段到 users 表
-- 用于存储用户的 Twitter OAuth refresh token 和 token 过期时间，以便自动刷新 accessToken

-- 添加 refresh token 字段
ALTER TABLE users ADD COLUMN twitter_refresh_token TEXT;

-- 添加 token 过期时间字段（存储 token 过期的时间戳，单位：秒）
ALTER TABLE users ADD COLUMN twitter_token_expires_at BIGINT;

-- 创建索引
CREATE INDEX idx_users_twitter_refresh_token ON users(twitter_refresh_token(50));

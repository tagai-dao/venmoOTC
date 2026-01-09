-- 创建社交互动相关的表

-- 交易点赞表
CREATE TABLE IF NOT EXISTS transaction_likes (
    id VARCHAR(50) PRIMARY KEY,
    transaction_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    privacy VARCHAR(20) NOT NULL, -- 点赞的隐私设置：PUBLIC_X, PUBLIC, FRIENDS, PRIVATE
    x_like_id VARCHAR(100), -- 如果同步到 X，存储 X 的点赞 ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_transaction_like (transaction_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 更新交易回复表，添加隐私设置和 X 评论 ID
-- 注意：如果列已存在，会报错，但 init.ts 会处理这个错误
ALTER TABLE transaction_replies 
ADD COLUMN privacy VARCHAR(20) DEFAULT 'PUBLIC',
ADD COLUMN x_comment_id VARCHAR(100) NULL;

-- 创建索引
CREATE INDEX idx_likes_transaction ON transaction_likes(transaction_id);
CREATE INDEX idx_likes_user ON transaction_likes(user_id);
CREATE INDEX idx_replies_privacy ON transaction_replies(privacy);
CREATE INDEX idx_replies_x_comment ON transaction_replies(x_comment_id);

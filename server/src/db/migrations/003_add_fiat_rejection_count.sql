-- 添加 fiat_rejection_count 字段到 transactions 表
-- MySQL 不支持 IF NOT EXISTS，使用存储过程或直接执行（如果字段已存在会报错，但会被 init.ts 捕获）
ALTER TABLE transactions ADD COLUMN fiat_rejection_count INTEGER DEFAULT 0;



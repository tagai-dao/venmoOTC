-- 添加 country 字段到 users 表
ALTER TABLE users 
ADD COLUMN country VARCHAR(100) NULL AFTER account_name;

-- 更新用户头像为基于种子的固定头像
-- 使用 DiceBear API 生成基于种子的一致头像，确保同一用户在不同浏览器中显示相同的头像

UPDATE users SET avatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=u1&backgroundColor=b6e3f4' WHERE id = 'u1';
UPDATE users SET avatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=u2&backgroundColor=ffd5dc' WHERE id = 'u2';
UPDATE users SET avatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=u3&backgroundColor=c7d2fe' WHERE id = 'u3';
UPDATE users SET avatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=u4&backgroundColor=ffdfbf' WHERE id = 'u4';

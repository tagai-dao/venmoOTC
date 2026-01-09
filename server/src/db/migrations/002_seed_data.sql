-- 初始化种子数据（从 mock 数据导入）

-- 插入用户数据
-- 使用 DiceBear API 生成基于种子的一致头像，确保同一用户在不同浏览器中显示相同的头像
INSERT INTO users (id, handle, name, avatar, wallet_address, is_verified, bank_name, account_number, account_name)
VALUES 
    ('u1', '@crypto_native', 'Alex Rivera', 'https://api.dicebear.com/7.x/avataaars/svg?seed=u1&backgroundColor=b6e3f4', '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', 1, 'Monzo', '12345678', 'Alex Rivera'),
    ('u2', '@sarah_j', 'Sarah Jones', 'https://api.dicebear.com/7.x/avataaars/svg?seed=u2&backgroundColor=ffd5dc', '0xB2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1E1F1A1B1', 0, 'Chase', '88776655', 'Sarah Jones'),
    ('u3', '@mike_otc', 'Mike Chen', 'https://api.dicebear.com/7.x/avataaars/svg?seed=u3&backgroundColor=c7d2fe', '0xC3B2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1E1', 1, 'Zenith Bank', '0011223344', 'Michael Chen'),
    ('u4', '@bella_ciao', 'Bella', 'https://api.dicebear.com/7.x/avataaars/svg?seed=u4&backgroundColor=ffdfbf', '0xD4C3B2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1', 0, NULL, NULL, NULL)
ON DUPLICATE KEY UPDATE 
    avatar = VALUES(avatar),
    handle = VALUES(handle),
    name = VALUES(name),
    wallet_address = VALUES(wallet_address),
    is_verified = VALUES(is_verified),
    bank_name = VALUES(bank_name),
    account_number = VALUES(account_number),
    account_name = VALUES(account_name);

-- 插入钱包余额数据
INSERT INTO wallet_balances (wallet_address, usdt_balance, ngn_balance, ves_balance, usd_balance)
VALUES 
    ('0x71C7656EC7ab88b098defB751B7401B5f6d8976F', 1250.50, 50000, 0, 0),
    ('0xB2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1E1F1A1B1', 850.25, 30000, 0, 0),
    ('0xC3B2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1E1', 2100.75, 75000, 0, 0),
    ('0xD4C3B2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1', 500.00, 20000, 0, 0)
ON DUPLICATE KEY UPDATE wallet_address=wallet_address;


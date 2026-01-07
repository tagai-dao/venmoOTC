-- 初始化种子数据（从 mock 数据导入）

-- 插入用户数据
INSERT INTO users (id, handle, name, avatar, wallet_address, is_verified, bank_name, account_number, account_name)
VALUES 
    ('u1', '@crypto_native', 'Alex Rivera', 'https://picsum.photos/200/200?random=1', '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', TRUE, 'Monzo', '12345678', 'Alex Rivera'),
    ('u2', '@sarah_j', 'Sarah Jones', 'https://picsum.photos/200/200?random=2', '0xB2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1E1F1A1B1', FALSE, 'Chase', '88776655', 'Sarah Jones'),
    ('u3', '@mike_otc', 'Mike Chen', 'https://picsum.photos/200/200?random=3', '0xC3B2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1E1', TRUE, 'Zenith Bank', '0011223344', 'Michael Chen'),
    ('u4', '@bella_ciao', 'Bella', 'https://picsum.photos/200/200?random=4', '0xD4C3B2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1', FALSE, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 插入钱包余额数据
INSERT INTO wallet_balances (wallet_address, usdt_balance, ngn_balance, ves_balance, usd_balance)
VALUES 
    ('0x71C7656EC7ab88b098defB751B7401B5f6d8976F', 1250.50, 50000, 0, 0),
    ('0xB2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1E1F1A1B1', 850.25, 30000, 0, 0),
    ('0xC3B2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1E1', 2100.75, 75000, 0, 0),
    ('0xD4C3B2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1', 500.00, 20000, 0, 0)
ON CONFLICT (wallet_address) DO NOTHING;


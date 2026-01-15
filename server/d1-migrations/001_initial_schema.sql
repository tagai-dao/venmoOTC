-- VenmoOTC D1 数据库初始化脚本 (SQLite)
-- 合并所有 MySQL 迁移并转换为 SQLite 语法

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    handle TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    wallet_address TEXT UNIQUE NOT NULL,
    is_verified INTEGER DEFAULT 0,
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    country TEXT,
    twitter_access_token TEXT,
    twitter_refresh_token TEXT,
    twitter_token_expires_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 交易表
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    from_user_id TEXT NOT NULL,
    to_user_id TEXT,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    note TEXT,
    sticker TEXT,
    timestamp INTEGER NOT NULL,
    privacy TEXT NOT NULL,
    type TEXT NOT NULL,
    x_post_id TEXT,
    is_otc INTEGER DEFAULT 0,
    otc_state TEXT DEFAULT 'NONE',
    otc_fiat_currency TEXT,
    otc_offer_amount REAL,
    otc_proof_image TEXT,
    payment_proof_url TEXT,
    related_transaction_id TEXT,
    selected_trader_id TEXT,
    multisig_contract_address TEXT,
    usdt_in_escrow INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (related_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
    FOREIGN KEY (selected_trader_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 交易回复表
CREATE TABLE IF NOT EXISTS transaction_replies (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    proof TEXT,
    privacy TEXT DEFAULT 'PUBLIC',
    x_comment_id TEXT,
    timestamp INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 钱包余额表
CREATE TABLE IF NOT EXISTS wallet_balances (
    wallet_address TEXT PRIMARY KEY,
    usdt_balance REAL DEFAULT 0,
    ngn_balance REAL DEFAULT 0,
    ves_balance REAL DEFAULT 0,
    usd_balance REAL DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    transaction_id TEXT,
    related_user_id TEXT,
    is_read INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
    FOREIGN KEY (related_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 社交互动表（点赞）
CREATE TABLE IF NOT EXISTS transaction_likes (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    privacy TEXT NOT NULL,
    x_like_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(transaction_id, user_id)
);

-- 出价表（抢单）
CREATE TABLE IF NOT EXISTS transaction_bids (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    message TEXT,
    timestamp INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(transaction_id, user_id)
);

-- 多签合约表
CREATE TABLE IF NOT EXISTS multisig_contracts (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    requester_address TEXT NOT NULL,
    trader_address TEXT NOT NULL,
    usdt_amount REAL NOT NULL,
    is_activated INTEGER DEFAULT 0,
    activated_at INTEGER,
    onchain_order_id INTEGER,
    initiator_choice INTEGER DEFAULT 0,
    counterparty_choice INTEGER DEFAULT 0,
    initiator_signed INTEGER DEFAULT 0,
    counterparty_signed INTEGER DEFAULT 0,
    trader_signed INTEGER DEFAULT 0,
    requester_signed INTEGER DEFAULT 0,
    trader_signed_at INTEGER,
    requester_signed_at INTEGER,
    payment_proof_url TEXT,
    status TEXT DEFAULT 'OPEN',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    UNIQUE(transaction_id)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_transactions_from_user ON transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_user ON transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_otc_state ON transactions(otc_state);
CREATE INDEX IF NOT EXISTS idx_transactions_related ON transactions(related_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_selected_trader ON transactions(selected_trader_id);
CREATE INDEX IF NOT EXISTS idx_replies_transaction ON transaction_replies(transaction_id);
CREATE INDEX IF NOT EXISTS idx_replies_user ON transaction_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_replies_privacy ON transaction_replies(privacy);
CREATE INDEX IF NOT EXISTS idx_replies_x_comment ON transaction_replies(x_comment_id);
CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_transaction ON transaction_likes(transaction_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON transaction_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_bids_transaction ON transaction_bids(transaction_id);
CREATE INDEX IF NOT EXISTS idx_bids_user ON transaction_bids(user_id);
CREATE INDEX IF NOT EXISTS idx_multisig_transaction ON multisig_contracts(transaction_id);

-- 创建触发器以自动更新 updated_at
CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
    AFTER UPDATE ON users
    FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_transactions_updated_at 
    AFTER UPDATE ON transactions
    FOR EACH ROW
BEGIN
    UPDATE transactions SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_wallet_balances_updated_at 
    AFTER UPDATE ON wallet_balances
    FOR EACH ROW
BEGIN
    UPDATE wallet_balances SET updated_at = strftime('%s', 'now') WHERE wallet_address = NEW.wallet_address;
END;

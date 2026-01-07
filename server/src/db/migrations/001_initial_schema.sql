-- VenmoOTC 数据库初始化脚本

-- 创建扩展（如果需要）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    handle VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar TEXT,
    wallet_address VARCHAR(255) UNIQUE NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    bank_name VARCHAR(255),
    account_number VARCHAR(100),
    account_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 交易表
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(50) PRIMARY KEY,
    from_user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    note TEXT,
    sticker VARCHAR(10),
    timestamp BIGINT NOT NULL,
    privacy VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    x_post_id VARCHAR(100),
    is_otc BOOLEAN DEFAULT FALSE,
    otc_state VARCHAR(30) DEFAULT 'NONE',
    otc_fiat_currency VARCHAR(10),
    otc_offer_amount DECIMAL(20, 8),
    otc_proof_image TEXT,
    related_transaction_id VARCHAR(50) REFERENCES transactions(id) ON DELETE SET NULL,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 交易回复表
CREATE TABLE IF NOT EXISTS transaction_replies (
    id VARCHAR(50) PRIMARY KEY,
    transaction_id VARCHAR(50) NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    proof TEXT,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 钱包余额表
CREATE TABLE IF NOT EXISTS wallet_balances (
    wallet_address VARCHAR(255) PRIMARY KEY,
    usdt_balance DECIMAL(20, 8) DEFAULT 0,
    ngn_balance DECIMAL(20, 8) DEFAULT 0,
    ves_balance DECIMAL(20, 8) DEFAULT 0,
    usd_balance DECIMAL(20, 8) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_transactions_from_user ON transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_user ON transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_otc_state ON transactions(otc_state);
CREATE INDEX IF NOT EXISTS idx_transactions_related ON transactions(related_transaction_id);
CREATE INDEX IF NOT EXISTS idx_replies_transaction ON transaction_replies(transaction_id);
CREATE INDEX IF NOT EXISTS idx_replies_user ON transaction_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);


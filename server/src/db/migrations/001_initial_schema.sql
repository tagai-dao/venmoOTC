-- VenmoOTC 数据库初始化脚本 (MySQL)

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    handle VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar TEXT,
    wallet_address VARCHAR(255) UNIQUE NOT NULL,
    is_verified TINYINT(1) DEFAULT 0,
    bank_name VARCHAR(255),
    account_number VARCHAR(100),
    account_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 交易表
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(50) PRIMARY KEY,
    from_user_id VARCHAR(50) NOT NULL,
    to_user_id VARCHAR(50),
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    note TEXT,
    sticker VARCHAR(10),
    timestamp BIGINT NOT NULL,
    privacy VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    x_post_id VARCHAR(100),
    is_otc TINYINT(1) DEFAULT 0,
    otc_state VARCHAR(30) DEFAULT 'NONE',
    otc_fiat_currency VARCHAR(10),
    otc_offer_amount DECIMAL(20, 8),
    otc_proof_image TEXT,
    related_transaction_id VARCHAR(50),
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (related_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 交易回复表
CREATE TABLE IF NOT EXISTS transaction_replies (
    id VARCHAR(50) PRIMARY KEY,
    transaction_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    text TEXT NOT NULL,
    proof TEXT,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 钱包余额表
CREATE TABLE IF NOT EXISTS wallet_balances (
    wallet_address VARCHAR(255) PRIMARY KEY,
    usdt_balance DECIMAL(20, 8) DEFAULT 0,
    ngn_balance DECIMAL(20, 8) DEFAULT 0,
    ves_balance DECIMAL(20, 8) DEFAULT 0,
    usd_balance DECIMAL(20, 8) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建索引以提高查询性能
CREATE INDEX idx_transactions_from_user ON transactions(from_user_id);
CREATE INDEX idx_transactions_to_user ON transactions(to_user_id);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_otc_state ON transactions(otc_state);
CREATE INDEX idx_transactions_related ON transactions(related_transaction_id);
CREATE INDEX idx_replies_transaction ON transaction_replies(transaction_id);
CREATE INDEX idx_replies_user ON transaction_replies(user_id);
CREATE INDEX idx_users_handle ON users(handle);
CREATE INDEX idx_users_wallet ON users(wallet_address);


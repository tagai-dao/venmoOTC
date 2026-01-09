-- 添加抢单和多签合约支持

-- 抢单表
CREATE TABLE IF NOT EXISTS transaction_bids (
    id VARCHAR(50) PRIMARY KEY,
    transaction_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    message TEXT,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_transaction_bid (transaction_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 多签合约表
CREATE TABLE IF NOT EXISTS multisig_contracts (
    id VARCHAR(50) PRIMARY KEY,
    transaction_id VARCHAR(50) NOT NULL,
    contract_address VARCHAR(255) NOT NULL,
    requester_address VARCHAR(255) NOT NULL,
    trader_address VARCHAR(255) NOT NULL,
    usdt_amount DECIMAL(20, 8) NOT NULL,
    is_activated TINYINT(1) DEFAULT 0,
    activated_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_transaction_contract (transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 更新 transactions 表，添加新字段
ALTER TABLE transactions ADD COLUMN selected_trader_id VARCHAR(50) NULL;
ALTER TABLE transactions ADD COLUMN multisig_contract_address VARCHAR(255) NULL;
ALTER TABLE transactions ADD COLUMN usdt_in_escrow TINYINT(1) DEFAULT 0;

-- 创建索引
CREATE INDEX idx_bids_transaction ON transaction_bids(transaction_id);
CREATE INDEX idx_bids_user ON transaction_bids(user_id);
CREATE INDEX idx_multisig_transaction ON multisig_contracts(transaction_id);
CREATE INDEX idx_transactions_selected_trader ON transactions(selected_trader_id);

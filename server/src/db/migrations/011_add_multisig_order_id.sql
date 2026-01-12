-- 在 multisig_contracts 表中添加链上 orderId 和签名状态字段
ALTER TABLE multisig_contracts ADD COLUMN onchain_order_id BIGINT NULL;
ALTER TABLE multisig_contracts ADD COLUMN initiator_choice INT DEFAULT 0; -- 0: NONE, 1: INITIATOR, 2: COUNTERPARTY
ALTER TABLE multisig_contracts ADD COLUMN counterparty_choice INT DEFAULT 0;
ALTER TABLE multisig_contracts ADD COLUMN initiator_signed TINYINT(1) DEFAULT 0;
ALTER TABLE multisig_contracts ADD COLUMN counterparty_signed TINYINT(1) DEFAULT 0;
ALTER TABLE multisig_contracts ADD COLUMN payment_proof_url TEXT NULL; -- 存储支付凭证图片或链接
ALTER TABLE multisig_contracts ADD COLUMN status VARCHAR(20) DEFAULT 'OPEN'; -- OPEN, EXECUTED, CANCELLED

-- 在 transactions 表中添加支付凭证字段（冗余存储以便快速显示）
ALTER TABLE transactions ADD COLUMN payment_proof_url TEXT NULL;

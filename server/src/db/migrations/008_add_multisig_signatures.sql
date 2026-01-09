-- 添加多签合约签名字段
ALTER TABLE multisig_contracts 
ADD COLUMN trader_signed TINYINT(1) DEFAULT 0,
ADD COLUMN requester_signed TINYINT(1) DEFAULT 0,
ADD COLUMN trader_signed_at TIMESTAMP NULL,
ADD COLUMN requester_signed_at TIMESTAMP NULL;

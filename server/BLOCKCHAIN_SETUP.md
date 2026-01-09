# BNB Chain 集成设置指南

本应用已集成真实的 BNB Chain (Binance Smart Chain) 服务，支持查询真实的 USDT 余额和执行链上转账。

## 功能特性

- ✅ **真实余额查询**: 从 BNB Chain 链上查询 USDT 余额
- ✅ **链上转账**: 执行真实的 USDT 转账交易
- ✅ **余额同步**: 自动同步链上余额到数据库
- ✅ **The Graph 集成**: 查询历史交易记录（可选）

## 环境变量配置

在 `server/.env` 文件中添加以下配置：

```env
# BNB Chain 配置
BNB_CHAIN_RPC_URL=https://bsc-dataseed.binance.org/
USDT_CONTRACT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
PRIVATE_KEY=your_private_key_here

# The Graph 配置（可选）
THE_GRAPH_ENDPOINT=https://api.thegraph.com/subgraphs/name/your-subgraph-name
```

### 配置说明

1. **BNB_CHAIN_RPC_URL**: BNB Chain RPC 节点地址
   - 公共节点: `https://bsc-dataseed.binance.org/`
   - 备用节点: `https://bsc-dataseed1.defibit.io/`
   - 或使用 Infura/Alchemy 等服务的节点

2. **USDT_CONTRACT_ADDRESS**: USDT 在 BSC 上的合约地址
   - 主网: `0x55d398326f99059fF775485246999027B3197955`
   - 测试网: 使用测试网 USDT 地址

3. **PRIVATE_KEY**: 用于发送交易的私钥（可选）
   - 仅在需要执行链上转账时配置
   - ⚠️ **安全警告**: 不要将私钥提交到代码仓库
   - 建议使用环境变量或密钥管理服务

4. **THE_GRAPH_ENDPOINT**: The Graph 子图端点（可选）
   - 用于查询历史交易记录
   - 需要先部署自己的子图

## API 端点

### 获取余额

```bash
GET /api/blockchain/balance/:address/:currency
```

**示例:**
```bash
curl http://localhost:3001/api/blockchain/balance/0x123.../USDT
```

**响应:**
```json
{
  "balance": 100.5,
  "currency": "USDT",
  "address": "0x123...",
  "timestamp": 1234567890,
  "source": "blockchain"
}
```

### 发送 USDT

```bash
POST /api/blockchain/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromAddress": "0x123...",
  "toAddress": "0x456...",
  "amount": 10.5
}
```

**响应:**
```json
{
  "txHash": "0x789...",
  "toAddress": "0x456...",
  "amount": 10.5,
  "fromAddress": "0x123...",
  "status": "confirmed",
  "blockNumber": 12345678,
  "timestamp": 1234567890
}
```

### 获取交易详情

```bash
GET /api/blockchain/transaction/:txHash
```

### 批量获取余额

```bash
POST /api/blockchain/balances
Content-Type: application/json

{
  "addresses": ["0x123...", "0x456..."]
}
```

## 余额同步

应用会自动定期同步链上余额到数据库：

- **开发环境**: 每 10 分钟同步一次
- **生产环境**: 每 5 分钟同步一次

同步服务会在服务器启动时自动启动。

## 注意事项

1. **Gas 费用**: 发送 USDT 需要消耗 BNB 作为 gas 费用
2. **网络延迟**: 链上查询可能有延迟，建议使用缓存
3. **RPC 限制**: 公共 RPC 节点可能有速率限制，建议使用自己的节点
4. **私钥安全**: 生产环境务必使用安全的密钥管理方案

## 故障排除

### 余额查询失败

- 检查 RPC 节点是否可访问
- 验证地址格式是否正确
- 查看服务器日志获取详细错误信息

### 转账失败

- 确认私钥已正确配置
- 检查发送地址是否有足够的 USDT
- 确认有足够的 BNB 支付 gas 费用
- 验证接收地址格式正确

### The Graph 查询失败

- 确认子图端点已正确配置
- 检查子图是否已同步到最新区块
- 查看 The Graph 服务状态

## 测试

使用测试网进行测试：

```env
BNB_CHAIN_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
USDT_CONTRACT_ADDRESS=<测试网 USDT 地址>
```

## 相关文档

- [BNB Chain 文档](https://docs.bnbchain.org/)
- [Ethers.js 文档](https://docs.ethers.org/)
- [The Graph 文档](https://thegraph.com/docs/)

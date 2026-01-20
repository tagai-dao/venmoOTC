# 抢单状态更新问题修复

## 🐛 问题描述

点击"我要抢单"按钮后：
1. 操作成功了
2. 但是按钮的状态没有发生变化（应该从"我要抢单"变成"已抢单"）
3. Request 发起者的 Request 动态的状态也没有发生变化（应该从 OPEN_REQUEST 变为 BIDDING）

## 🔍 问题原因

1. **TransactionRepository 缺少 bids 字段** - `rowToTransaction` 方法获取了 bids 数据，但在返回的 Transaction 对象中没有包含 `bids` 字段
2. **前端状态更新问题** - `refreshFeed()` 可能没有正确获取到包含 bids 的交易数据

## ✅ 已修复

### 1. 修复 TransactionRepository

在 `server/worker/src/db/repositories/transactionRepository.ts` 的 `rowToTransaction` 方法中，添加了 `bids` 字段：

```typescript
return {
  // ... 其他字段
  bids: bids.length > 0 ? bids : undefined,
};
```

### 2. 简化 handleBid 逻辑

在 `components/FeedItem.tsx` 中，简化了 `handleBid` 方法，直接使用 `refreshFeed()` 来更新状态：

```typescript
const handleBid = async () => {
  // ...
  const response = await Services.bids.createBid(transaction.id);
  // 刷新 feed 以获取最新的交易数据（包括 bids 和更新后的 otcState）
  await refreshFeed();
  // ...
};
```

### 3. 后端状态更新

在 `server/worker/src/controllers/bidController.ts` 中，抢单成功后会：
- 创建 bid 记录
- 如果交易状态是 `OPEN_REQUEST`，自动更新为 `BIDDING`

## 🧪 测试步骤

1. **刷新页面** - 确保使用最新的代码
2. **点击"我要抢单"按钮**
3. **验证按钮状态** - 应该从"我要抢单"变为"已抢单"（灰色，禁用状态）
4. **验证交易状态** - Request 的状态应该从 `OPEN_REQUEST` 变为 `BIDDING`
5. **验证抢单列表** - 点击"查看抢单列表"按钮，应该能看到新创建的 bid

## 📝 状态变化

### 抢单前
- 按钮：绿色 "我要抢单"
- 交易状态：`OPEN_REQUEST`
- bids：空数组或 undefined

### 抢单后
- 按钮：灰色 "已抢单"（禁用）
- 交易状态：`BIDDING`
- bids：包含当前用户的 bid

## ⚠️ 注意事项

1. **状态更新是异步的** - `refreshFeed()` 会重新获取所有交易数据，可能需要一点时间
2. **如果状态没有更新** - 检查浏览器控制台是否有错误，或者手动刷新页面
3. **bids 数据** - 确保数据库中的 `transaction_bids` 表有正确的数据

## 🔗 相关文件

- `server/worker/src/db/repositories/transactionRepository.ts` - 修复了 bids 字段
- `server/worker/src/controllers/bidController.ts` - 处理状态更新
- `components/FeedItem.tsx` - 前端抢单逻辑

## ✅ 部署状态

- ✅ 代码已更新
- ✅ 类型检查通过
- ✅ Workers 已重新部署

请在浏览器中测试抢单功能，确认状态更新正常。

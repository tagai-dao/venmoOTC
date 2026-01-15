# D1 数据库迁移说明

## 使用方法

### 本地测试迁移

```bash
# 在项目根目录执行
wrangler d1 execute venmootc-db --local --file=./server/d1-migrations/001_initial_schema.sql
```

### 生产环境迁移

```bash
# 在项目根目录执行
wrangler d1 execute venmootc-db --file=./server/d1-migrations/001_initial_schema.sql
```

## 迁移顺序

按照文件编号顺序执行：

1. `001_initial_schema.sql` - 初始表结构（已合并所有迁移）

## 注意事项

- SQLite 语法与 MySQL 有差异，已在本迁移脚本中转换
- 时间戳使用 Unix 时间戳（INTEGER）存储
- 布尔值使用 INTEGER (0/1) 存储
- 外键约束在 D1 中默认启用
- 所有 MySQL 迁移已合并到 001_initial_schema.sql 中

## 数据库信息

- 数据库名称：`venmootc-db`
- 数据库 ID：`b30c6c46-88d7-4e6b-80c1-4df1079c4642`
- 区域：WNAM

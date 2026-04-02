# DB Batch Dead Export Cleanup 设计

**日期**: 2026-04-02

## 目标

收缩 `functions/lib/db/batch.js` 的公共导出面，仅保留仍被真实消费者使用的 `chunkArray` 与 `executeBatchChunks`。

本批删除的死导出：

- `D1_MAX_BATCH_SIZE`
- `batchInsert`
- `batchUpdate`
- `batchDelete`
- `batchUpsert`
- `transaction`

## 本批范围

仅处理：

- `functions/lib/db/batch.js`
- 一条静态 dead-export audit test
- 现有 `functions/lib/db/__tests__/batch.test.js`
- 现有 `functions/repositories/__tests__/batch-safety-repositories.test.js`

## 现状

全仓搜索结果显示：

- `chunkArray` 与 `executeBatchChunks` 仍被大量 service / repository / route 代码真实导入
- `functions/lib/db/__tests__/batch.test.js` 也只覆盖这两个活接口
- `D1_MAX_BATCH_SIZE`、`batchInsert`、`batchUpdate`、`batchDelete`、`batchUpsert`、`transaction` 没有真实 import

## 方案比较

### 方案 A: 整块删除 `batch.js`

优点:
- 一次性去掉全部历史包袱

缺点:
- `chunkArray` 与 `executeBatchChunks` 仍是高频公共底座
- 需要同步改动大量消费者
- 风险与改动面都明显偏高

### 方案 B: 保留文件，只收缩导出面

优点:
- 保留活着的公共能力
- 一次清掉 6 个零使用接口
- 改动面小，风险低

缺点:
- 文件仍然存在，不是“整块下线”

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定 6 个死导出不再存在
2. 先跑红灯确认当前导出仍在
3. 删除无用导出和对应死函数，只保留 `chunkArray` 与 `executeBatchChunks`
4. 运行现有 db batch helper 测试与 repository batch safety 测试，确认真实批处理路径不变

## 不处理内容

本批不处理：

- `chunkArray`
- `executeBatchChunks`
- 任何活跃消费者的导入路径
- 更大范围的 D1 批处理设计重构

## 风险与控制

- 风险: 删除时误伤活接口默认分块行为
  控制: 运行 `functions/lib/db/__tests__/batch.test.js`

- 风险: 间接影响使用 `executeBatchChunks` 的仓储批量写路径
  控制: 运行 `functions/repositories/__tests__/batch-safety-repositories.test.js`

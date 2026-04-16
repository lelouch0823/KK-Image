# 2026-04-16 后端性能问题审计记录

## 当前状态

- 本轮后端性能审查与安全批次实施已完成。
- 实施计划文档：[docs/plans/2026-04-16-backend-performance-hardening-implementation-plan.md](/home/bjw/Code/KK-Image/docs/plans/2026-04-16-backend-performance-hardening-implementation-plan.md)
- 本轮新增迁移：[migrations/0071_backend_performance_indexes.sql](/home/bjw/Code/KK-Image/migrations/0071_backend_performance_indexes.sql)
- 本轮验证结果：聚焦后端相关 `99` 项测试通过，迁移前缀校验通过。
- 记录口径：本文件同时记录“已在本轮落地的问题”和“超出本次安全批次、已确认但暂未落地的问题”。

## 审查范围

- D1 / SQLite schema、migration、bootstrap schema 对齐
- `functions/repositories/` 热读查询
- `functions/services/` 热写路径与批处理路径
- outbox / webhook 异步投递链路
- 订单 / 采购 / 缺货总览相关读模型与聚合路径

## 状态说明

- `implemented`：已在本轮代码中落地，并有聚焦测试或脚本验证
- `deferred`：问题真实存在，但因改动范围、回归风险或架构切面过大，未纳入本次安全批次

## 问题清单

### 01. `files` / `folders` bootstrap schema 与 recycle-bin migration 漂移
- 状态：`implemented`
- 严重级别：高
- 位置：
  - [migrations/0032_recycle_bin.sql](/home/bjw/Code/KK-Image/migrations/0032_recycle_bin.sql)
  - [scripts/init-database.sql](/home/bjw/Code/KK-Image/scripts/init-database.sql)
- 问题描述：增量迁移已引入 `is_deleted` / `deleted_at`，但 bootstrap schema 长时间未同步，导致新库与升级库执行计划和行为不一致。
- 本轮处理：
  - 在 [scripts/init-database.sql](/home/bjw/Code/KK-Image/scripts/init-database.sql) 正式补齐 `files` / `folders` 软删除列
  - 在 [scripts/__tests__/init-database-bootstrap-consistency.test.js](/home/bjw/Code/KK-Image/scripts/__tests__/init-database-bootstrap-consistency.test.js) 增加一致性断言

### 02. 文件库 / 文件夹热路径缺少命中查询模式的复合索引
- 状态：`implemented`
- 严重级别：高
- 位置：
  - [functions/repositories/FileRepository.js](/home/bjw/Code/KK-Image/functions/repositories/FileRepository.js)
  - [functions/repositories/FolderRepository.js](/home/bjw/Code/KK-Image/functions/repositories/FolderRepository.js)
  - [migrations/0071_backend_performance_indexes.sql](/home/bjw/Code/KK-Image/migrations/0071_backend_performance_indexes.sql)
- 问题描述：高频路径依赖 `folder_id + is_deleted + created_at`、`original_hash + is_deleted`、`parent_id + is_deleted` 等组合过滤，但 schema 只有单列或不匹配索引。
- 本轮处理：
  - 新增 `idx_files_folder_deleted_created`
  - 新增 `idx_files_original_hash_deleted`
  - 新增 `idx_folders_parent_deleted_created`
  - 新增 `idx_folders_deleted_name`

### 03. `ProductRepository.search` 重复扫描聚合并复用重型 count 子查询
- 状态：`implemented`
- 严重级别：高
- 位置：
  - [functions/repositories/ProductRepository.js](/home/bjw/Code/KK-Image/functions/repositories/ProductRepository.js)
  - [functions/lib/hono/routes/sales/products.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/products.js)
  - [functions/lib/hono/routes/manage/products/export.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/products/export.js)
- 问题描述：商品列表在默认路径上重复加载 facet/filter 元数据，且 count 查询包裹完整重型列表 SQL，导致同一请求反复扫描 `variant_agg`。
- 本轮处理：
  - 支持 `includeFilters = false` 跳过不必要 facet 查询
  - 将 count 路径改成更轻的过滤复用实现
  - 对仅需要列表数据的调用点改为禁用 filters

### 04. `InventoryService.applyBatch` 名义批量、实际串行写库
- 状态：`implemented`
- 严重级别：高
- 位置：
  - [functions/services/InventoryService.js](/home/bjw/Code/KK-Image/functions/services/InventoryService.js)
- 问题描述：库存 mutation 原实现对每条变更逐条 `run()`，在采购、收货、修正链路中形成明显写放大和往返叠加。
- 本轮处理：
  - 使用 `executeBatchChunks` 改为真正分块批量提交
  - 保留非 DB fallback 行为

### 05. API Key 鉴权通过全表加载再做匹配
- 状态：`implemented`
- 严重级别：中
- 位置：
  - [functions/api/utils/auth.js](/home/bjw/Code/KK-Image/functions/api/utils/auth.js)
- 问题描述：API Key 认证原路径读取整表再匹配 `key_value`，对热点鉴权接口造成不必要的全表扫描。
- 本轮处理：
  - 改为按 `key_value` 精确查找
  - 保持 fallback 逻辑与测试覆盖稳定

### 06. outbox poller 对同一 consumer 的 job 完全串行处理
- 状态：`implemented`
- 严重级别：高
- 位置：
  - [functions/api/cron/outbox.js](/home/bjw/Code/KK-Image/functions/api/cron/outbox.js)
  - [functions/lib/async/runConcurrent.js](/home/bjw/Code/KK-Image/functions/lib/async/runConcurrent.js)
- 问题描述：同一 consumer 被 claim 到的 job 逐条串行执行，单个慢 job 会拖住整个 consumer 批次吞吐。
- 本轮处理：
  - 新增通用受控并发执行器
  - 对 consumer 内的 job 改为受控并发
  - 继续保持 `markPublished` / `markFailed` 语义不变

### 07. webhook endpoint 投递完全串行
- 状态：`implemented`
- 严重级别：高
- 位置：
  - [functions/services/WebhookDeliveryService.js](/home/bjw/Code/KK-Image/functions/services/WebhookDeliveryService.js)
- 问题描述：同一事件的 endpoint 逐个执行 `hasSuccessfulDelivery -> getLatestAttempt -> HTTP -> logAttempt`，任一慢端点都会放大整体延迟。
- 本轮处理：
  - 将 endpoint 投递改为受控并发
  - 保留 `already_delivered`、`retryable`、`terminal` 分类与投递日志语义

### 08. `PurchaseOrderService.createFromOrders` 对 `order_lines` 做未收窄的全表聚合
- 状态：`implemented`
- 严重级别：高
- 位置：
  - [functions/services/PurchaseOrderService.js](/home/bjw/Code/KK-Image/functions/services/PurchaseOrderService.js)
- 问题描述：订单转采购单时，为提取 snapshot 而在子查询中按全表 `order_lines` 聚合；外层虽只查当前订单集，内层却未按当前 chunk 限定。
- 本轮处理：
  - 将 snapshot 子查询收窄到当前 `order_id` chunk
  - 同步把 chunk 大小调整到双倍绑定参数下的 D1 安全范围

### 09. 管理端订单 count 查询无条件拼重型订单行聚合
- 状态：`implemented`
- 严重级别：高
- 位置：
  - [functions/repositories/order/queries.js](/home/bjw/Code/KK-Image/functions/repositories/order/queries.js)
- 问题描述：`listForAdmin` 的 count 路径无条件拼接 `ORDER_LINE_STATUS_AGGREGATE_JOIN` 与 `ORDER_LINE_PRIMARY_SNAPSHOT_JOIN`，即使没有进度/配送/搜索筛选也照样重扫 `order_lines`。
- 本轮处理：
  - 改成按需拼接 count join
  - 只有 `procurementStatus` / `deliveryStatus` / `search` 需要时才挂对应重型 join

### 10. 销售端 / 管理端订单列表主查询仍依赖实时订单行聚合
- 状态：`deferred`
- 严重级别：高
- 位置：
  - [functions/repositories/order/queries.js](/home/bjw/Code/KK-Image/functions/repositories/order/queries.js)
  - [functions/repositories/order/sql.js](/home/bjw/Code/KK-Image/functions/repositories/order/sql.js)
- 问题描述：虽然 count 路径已减重，但主列表 query 仍实时依赖 `ORDER_LINE_STATUS_AGGREGATE_JOIN` 与 `ORDER_LINE_PRIMARY_SNAPSHOT_JOIN`。订单量继续增长后，列表主查询仍会成为热点瓶颈。
- 建议后续：
  - 为订单维护订单级 summary / projection
  - 将 `display_status`、首行快照、配送派生态从运行时聚合改为增量维护读模型

### 11. `orders` 热表内联大块 JSON，读路径持续搬运 `current_data` / `original_data`
- 状态：`deferred`
- 严重级别：高
- 位置：
  - [scripts/init-database.sql](/home/bjw/Code/KK-Image/scripts/init-database.sql)
  - [functions/repositories/order/queries.js](/home/bjw/Code/KK-Image/functions/repositories/order/queries.js)
- 问题描述：订单列表、统计、提醒等热路径反复读取热表中的大 JSON 字段，导致 I/O、反序列化和网络载荷持续偏大。
- 建议后续：
  - 将大 JSON 拆到 payload 副表
  - 主表只保留筛选、排序、列表展示所需结构化字段与轻量摘要列

### 12. 采购收货 / 冲销 / 待收关闭链路存在多阶段写入与补偿回滚
- 状态：`deferred`
- 严重级别：高
- 位置：
  - [functions/services/OrderProcurementDomainService.js](/home/bjw/Code/KK-Image/functions/services/OrderProcurementDomainService.js)
  - [functions/services/PurchaseOrderShortageClosureService.js](/home/bjw/Code/KK-Image/functions/services/PurchaseOrderShortageClosureService.js)
  - [functions/services/OrderProcurementReceiptReversalService.js](/home/bjw/Code/KK-Image/functions/services/OrderProcurementReceiptReversalService.js)
- 问题描述：当前采购域写路径存在“预检真实写入 -> 主批次写入 -> 出错回滚”的多阶段模型，写放大和锁占用时间都偏高。
- 建议后续：
  - 收敛为单次 CAS 最终写入模型
  - 将幂等 finalize、投影更新、outbox 插入统一进同一批次

### 13. 订单状态流转与订单变更路径反复扫描 `order_lines`
- 状态：`deferred`
- 严重级别：高
- 位置：
  - [functions/repositories/order/mutations.js](/home/bjw/Code/KK-Image/functions/repositories/order/mutations.js)
- 问题描述：状态更新、批量更新、兼容投影更新过程中，对同一订单反复做 `SUM/COUNT/LIMIT 1` 聚合，批量场景下复杂度会快速上升。
- 建议后续：
  - 预取 `order_id -> totals / primary_line / line_count`
  - 在内存计算下一状态与派生态，再统一提交更新

### 14. 缺货总览 / 需求服务 / 采购建议重复扫描活动订单行
- 状态：`deferred`
- 严重级别：高
- 位置：
  - [functions/repositories/GoodsOverviewRepository.js](/home/bjw/Code/KK-Image/functions/repositories/GoodsOverviewRepository.js)
  - [functions/services/DemandService.js](/home/bjw/Code/KK-Image/functions/services/DemandService.js)
  - [functions/services/PurchaseOrderService.js](/home/bjw/Code/KK-Image/functions/services/PurchaseOrderService.js)
- 问题描述：缺口汇总、需求汇总、采购建议都在独立重复扫描 `order_lines + orders + inventory_balances`，同类聚合缺少共享投影。
- 建议后续：
  - 建立 variant 级 demand / shortage projection
  - 订单行变化时增量维护，读接口直接查询投影

### 15. 商品批量导入仍缺少 preload + bulk upsert 模型
- 状态：`deferred`
- 严重级别：中
- 位置：
  - [functions/services/product-catalog/batch-execution.js](/home/bjw/Code/KK-Image/functions/services/product-catalog/batch-execution.js)
  - [functions/repositories/ProductRepository.js](/home/bjw/Code/KK-Image/functions/repositories/ProductRepository.js)
  - [functions/repositories/ProductVariantRepository.js](/home/bjw/Code/KK-Image/functions/repositories/ProductVariantRepository.js)
- 问题描述：批量导入仍偏向按商品逐个读取、逐个同步、逐个回滚，已有商品越多，重复查询越多。
- 建议后续：
  - 导入前按 SPU / variant 维度 preload 现有数据
  - 分块 bulk upsert，避免每个商品单独走一遍全链路

### 16. 慢查询观测层未真正接入 repository / service 热路径
- 状态：`deferred`
- 严重级别：中
- 位置：
  - [functions/lib/db/query.js](/home/bjw/Code/KK-Image/functions/lib/db/query.js)
- 问题描述：仓库内已有查询封装和慢查询度量入口，但多数热点 repository / service 并未统一接入，导致性能治理难以持续闭环。
- 建议后续：
  - 将热路径查询统一纳入 query wrapper
  - 记录 `duration`、`rows_read`、SQL label 与 chunk 级批处理耗时

### 17. 部分 schema 仍保留冗余索引，增加写放大
- 状态：`deferred`
- 严重级别：低
- 位置：
  - [scripts/init-database.sql](/home/bjw/Code/KK-Image/scripts/init-database.sql)
- 问题描述：部分唯一索引与普通索引重复覆盖同一列前缀，虽然不一定是当前主瓶颈，但会增加迁移、写入和存储维护成本。
- 建议后续：
  - 对唯一列、完全覆盖的单列索引做一次系统性清理
  - 保留与真实查询模式对应的最小索引集合

## 本轮落地文件

- [migrations/0071_backend_performance_indexes.sql](/home/bjw/Code/KK-Image/migrations/0071_backend_performance_indexes.sql)
- [scripts/init-database.sql](/home/bjw/Code/KK-Image/scripts/init-database.sql)
- [functions/api/utils/auth.js](/home/bjw/Code/KK-Image/functions/api/utils/auth.js)
- [functions/repositories/ProductRepository.js](/home/bjw/Code/KK-Image/functions/repositories/ProductRepository.js)
- [functions/services/InventoryService.js](/home/bjw/Code/KK-Image/functions/services/InventoryService.js)
- [functions/api/cron/outbox.js](/home/bjw/Code/KK-Image/functions/api/cron/outbox.js)
- [functions/services/WebhookDeliveryService.js](/home/bjw/Code/KK-Image/functions/services/WebhookDeliveryService.js)
- [functions/services/PurchaseOrderService.js](/home/bjw/Code/KK-Image/functions/services/PurchaseOrderService.js)
- [functions/repositories/order/queries.js](/home/bjw/Code/KK-Image/functions/repositories/order/queries.js)

## 本轮验证快照

```bash
pnpm test:unit:run \
  scripts/__tests__/init-database-bootstrap-consistency.test.js \
  scripts/__tests__/check-migration-prefixes.test.js \
  functions/services/__tests__/InventoryService.test.js \
  functions/repositories/__tests__/product-spu.test.js \
  functions/api/utils/__tests__/auth.test.js \
  functions/api/cron/__tests__/outbox.test.js \
  functions/services/__tests__/WebhookDeliveryService.test.js \
  functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js \
  functions/repositories/__tests__/order-queries.display-model.test.js

node scripts/check-migration-prefixes.mjs
```

验证结果：

- `9` 个测试文件、`99` 项测试通过
- 迁移前缀校验通过
- `auth.test.js` 中与 DB fallback / Turnstile fallback 相关 stderr 为预期测试输出，不构成失败

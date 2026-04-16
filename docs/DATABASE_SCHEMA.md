# Database Schema

> Last reviewed against repository state: 2026-04-16

本文档只保留当前数据库结构的高层说明，避免把会随迁移快速变化的字段细节硬编码成第二份“伪真相”。

## 真正的结构来源

当前数据库结构以以下内容为准：

1. `migrations/`
2. `scripts/init-database.sql`
3. 读写这些表的 Repository / Route / Service 实现

如果本文档与以上三者冲突，以它们为准。

## 当前表分组

### 文件与公开分享

- `files`
- `blobs`
- `folders`
- `albums`
- `spaces`
- `space_files`
- `space_access_logs`
- `space_salesperson_shares`

说明：

- 文件元数据与物理对象分离，`blobs` 用于 CAS 去重。
- 公开空间和公开相册仍然存在，访问入口分别是 `/api/space/:token` 与 `/api/gallery/:token`。

### 用户、权限与访问

- `users`
- `salespersons`
- `customers`
- `api_keys`
- 与权限 / 审计 / 登录失败相关的辅助表

说明：

- 管理端和销售端是两套不同的访问链路。
- 销售端仍以 `access_token + sales JWT` 为主。

### 订单域

- `orders`
- `order_lines`
- `order_files`
- `order_timeline`
- `order_comments`
- `order_line_allocations`

说明：

- 当前订单真实模型是 `orders + order_lines`，不是旧文档里的单表订单模型。
- 履约与采购进度优先来自 `order_lines` 聚合，而不是单靠 `orders.procurement_status`。

### 商品、采购与库存

- `products`
- `product_variants`
- `product_dimensions`
- `product_dimension_values`
- `variant_images`
- `purchase_orders`
- `purchase_order_items`
- `purchase_receipts`
- `purchase_receipt_reversals`
- `inventory_ledger`
- `inventory_balances`
- `inventory_events`

说明：

- 采购收货和冲销是不可变事实，分别记录在 `purchase_receipts` 与 `purchase_receipt_reversals`。
- 库存既有事实层，也有投影/汇总层。

### Durable Outbox 与运维

- `domain_outbox`
- `outbox_consumer_jobs`
- `outbox_replay_runs`
- 与通知、Webhook、补充审计相关的业务表

说明：

- 订单、采购、通知、Webhook、缓存失效和 replay 已经围绕 durable outbox 运转。

## 当前建模重点

### 订单

- `orders` 保存头信息、归属关系和兼容性聚合字段。
- `order_lines` 才是采购、履约、预留、出货等动作的核心粒度。

### 采购

- `purchase_orders` / `purchase_order_items` 是采购单主模型。
- `purchase_receipts` / `purchase_receipt_reversals` 记录实际到货与冲销事实。

### 库存

- `inventory_ledger` / `inventory_events` 记录事实。
- `inventory_balances` 提供读模型和快速查询能力。

## 使用建议

- 不要把本文档当作字段级 source of truth。
- 需要确认字段、索引、默认值、非空约束时，直接读 `migrations/`。
- 需要确认某个字段当前是否仍被业务依赖时，直接查对应 Repository / Service / Route。

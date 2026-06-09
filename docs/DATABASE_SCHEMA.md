# Database Schema

> Last reviewed against repository state: 2026-06-09

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
- `album_files`
- `spaces`
- `space_files`
- `space_access_logs`
- `space_salesperson_shares`
- `tags`
- `file_tags`

说明：

- 文件元数据与物理对象分离，`blobs` 用于 CAS 去重。
- 公开空间和公开相册仍然存在，访问入口分别是 `/api/space/:token` 与 `/api/gallery/:token`。

### 用户、权限与访问

- `users`
- `salespersons`
- `customers`
- `customer_tags`
- `customer_communications`
- `api_keys`
- `audit_logs`
- 与权限 / 登录失败相关的辅助表

说明：

- 管理端和销售端是两套不同的访问链路。
- 销售端仍以 `access_token + sales JWT` 为主。
- 客户标签、沟通记录和客户 FTS 索引已从旧的单一客户表说明中拆出。

### 订单域

- `orders`
- `order_lines`
- `order_files`
- `order_timeline`
- `order_line_allocations`
- `order_payloads`
- `order_shipments`
- `order_returns`
- `order_summary_projection`

说明：

- 当前订单真实模型是 `orders + order_lines`，不是旧文档里的单表订单模型。
- 履约与采购进度优先来自 `order_lines` 聚合，而不是单靠 `orders.procurement_status`。
- 订单留言 / 备注属于 `order_timeline.comment`，不是独立 `order_comments` 表。
- 订单 payload sidecar、出货、退货和订单汇总投影是当前订单读写模型的一部分。

### 商品、采购与库存

- `products`
- `product_variants`
- `product_dimensions`
- `product_dimension_values`
- `product_dimension_aliases`
- `variant_images`
- `variant_audit_logs`
- `categories`
- `product_categories`
- `price_rules`
- `product_projection`
- `variant_demand_projection`
- `variant_snapshot_projection`
- `purchase_orders`
- `purchase_order_items`
- `purchase_receipts`
- `purchase_receipt_reversals`
- `inventory_ledger`
- `inventory_balances`
- `inventory_events`
- `stocktakes`
- `stocktake_items`

说明：

- 采购收货和冲销是不可变事实，分别记录在 `purchase_receipts` 与 `purchase_receipt_reversals`。
- 库存既有事实层，也有投影/汇总层。
- 商品分类、价格规则和盘点单都已经是当前商品/库存模型的一部分。
- 商品投影、规格需求投影和规格快照投影用于管理端列表、订货总览和统计查询。

### AI 与运行观测

- `ai_action_sessions`
- `ai_request_traces`
- `ai_request_spans`
- `ai_request_usage_daily`
- `system_stats_projection`

说明：

- AI action session 用于跟踪多步 AI 操作。
- AI request trace/span/usage 表用于观测模型调用、延迟和日用量。
- 系统统计投影服务管理端统计与仪表盘查询。

### 财务、ERP 与 OAuth

- `payments`
- `erp_connections`
- `erp_sync_logs`
- `erp_entity_mappings`
- `oauth_clients`
- `oauth_authorization_codes`
- `oauth_tokens`

说明：

- 应收账款来自订单付款记录与订单金额的差额。
- ERP 连接、同步日志和实体映射属于可选集成能力。
- OAuth 表支撑 `/api/manage/oauth/*` 的客户端、授权码和 token 流程。

### Durable Outbox 与运维

- `domain_outbox`
- `command_idempotency`
- `outbox_consumer_jobs`
- `outbox_replay_runs`
- `outbox_runtime_state`
- `SystemSettings`
- `notifications`
- `webhooks`
- `webhook_logs`
- `webhook_event_subscriptions`
- `storage_mirrors`

说明：

- 订单、采购、通知、Webhook、缓存失效和 replay 已经围绕 durable outbox 运转。
- `command_idempotency` 负责命令幂等，避免行级履约、采购收货等命令重复落账。
- `SystemSettings` 是当前设置表名，同时承载系统设置、AI 配置和 feature flag 类配置。
- `storage_mirrors` 记录多存储镜像状态。

### 搜索与归档辅助

- `products_fts`
- `orders_fts`
- `customers_fts`
- `files_fts`
- `files.is_deleted`
- `folders.is_deleted`
- `orders.archived_at`
- `orders.archived_by`

说明：

- FTS 表用于当前搜索/筛选性能优化。
- 文件、文件夹采用统一 `is_deleted = 0` 口径过滤未删除数据。
- 订单归档不是硬删除，常规读模型应排除 `archived_at` 非空的订单。

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
- `stocktakes` / `stocktake_items` 记录盘点单和盘点明细，盘点调整继续落库存事实。

### 应收

- `payments` 是订单收款事实。
- 应收看板按订单金额、已收款金额和未收余额聚合，不单独维护第二份应收事实表。

### ERP / OAuth

- `erp_connections` 存连接配置，`erp_sync_logs` 存同步过程，`erp_entity_mappings` 存本地实体与远端实体映射。
- `oauth_clients`、`oauth_authorization_codes`、`oauth_tokens` 支撑 OAuth 应用管理、授权码和刷新 token。

## 使用建议

- 不要把本文档当作字段级 source of truth。
- 需要确认字段、索引、默认值、非空约束时，直接读 `migrations/`。
- 需要确认某个字段当前是否仍被业务依赖时，直接查对应 Repository / Service / Route。

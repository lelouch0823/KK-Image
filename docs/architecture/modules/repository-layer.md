# Repository 层设计文档

本文档说明当前仓储层的职责边界，以及订单、采购和 outbox 相关仓储已经演进到什么程度。

## 1. 整体结构

```text
Hono Routes
    ↓
Domain Services
    ↓
Repositories
    ↓
D1 / R2
```

仓储层只做两件事：

- 组织数据访问
- 返回稳定读模型或写模型结果

它不负责：

- 权限判断
- 路由级参数解析
- 通知 / Webhook / 缓存副作用执行

这些职责分别属于中间件、路由层和 outbox 消费者。

## 2. 当前核心设计原则

1. 单一职责
   - 每个 Repository 聚焦一个实体或一组紧密相关的读模型
2. Facade + 拆分子模块
   - 复杂模块如订单，使用 facade 暴露统一入口，内部再拆 `queries` / `mutations` / `helpers`
3. 参数化 SQL
   - 全部使用 `prepare().bind()`
4. 批量写保护
   - Cloudflare D1 批量写超过上限时，必须走 chunked batch helper
5. 事实层与读模型分离
   - 收货、冲销、库存等行为优先写事实，再由读模型映射消费

## 3. Repository 清单

| Repository | 职责描述 |
| --- | --- |
| `ActionSessionRepository` | 操作会话管理 |
| `AlbumRepository` | 相册管理 |
| `AuditLogRepository` | 审计日志 |
| `BlobRepository` | 二进制对象元数据 |
| `CategoryRepository` | 商品分类 |
| `CommandIdempotencyRepository` | 命令幂等性 |
| `CustomerRepository` | 客户管理 |
| `DomainOutboxRepository` | 领域事件发布 |
| `ErpSyncRepository` | ERP 同步 |
| `FileRepository` | 文件 CRUD、回收站、哈希复用 |
| `FolderRepository` | 文件夹层级 |
| `GoodsOverviewRepository` | 订货总览缺口、在途 |
| `InventoryDashboardRepository` | 库存仪表盘 |
| `InventoryEventRepository` | 库存事件 |
| `InventoryRepository` | 库存余额 |
| `NotificationRepository` | 站内通知 |
| `OAuthRepository` | OAuth 应用 |
| `OrderLineAllocationRepository` | 订单行分配 |
| `OrderLineRepository` | 订单行读写 |
| `OrderRepository` | 订单门面（orders + order_lines + order_files + order_timeline） |
| `OrderStatsRepository` | 订单统计 |
| `OrderTimelineRepository` | 订单时间轴 |
| `OutboxReplayRepository` | outbox 查询与 replay |
| `OutboxRuntimeStateRepository` | outbox 运行时状态 |
| `PaymentRepository` | 支付记录 |
| `PriceRuleRepository` | 价格规则 |
| `ProductDimensionRepository` | 商品规格维度 |
| `ProductProjectionRepository` | 商品投影刷新 |
| `ProductRepository` | 商品主数据与聚合读模型 |
| `ProductVariantRepository` | 商品变体 |
| `ProfitRepository` | 利润分析 |
| `PurchaseOrderRepository` | 采购单主读写 |
| `PurchaseReceiptRepository` | 收货事实写入 |
| `PurchaseSuggestionRepository` | 采购建议 |
| `SalespersonRepository` | 销售员、登录、token |
| `SearchRepository` | 全局搜索 |
| `SettingsRepository` | 系统设置 |
| `SpaceRepository` | 空间管理 |
| `StatsRepository` | 统计分析 |
| `StocktakeRepository` | 库存盘点 |
| `StorageMirrorRepository` | 存储镜像 |
| `SystemStatsProjectionRepository` | 系统统计投影 |
| `SystemStatsRepository` | 系统统计 |
| `TagRepository` | 标签管理 |
| `UserRepository` | 用户管理 |
| `VariantAuditRepository` | 变体审计 |
| `VariantDemandProjectionRepository` | 变体需求投影 |
| `VariantImageRepository` | 变体图片 |
| `VariantSnapshotProjectionRepository` | 变体快照投影 |
| `WebhookRepository` | Webhook 管理 |

采购单子模块（`functions/repositories/` 下）：

| 文件 | 职责 |
| --- | --- |
| `purchase-order-item-mutations.js` | 采购单明细写入 |
| `purchase-order-item-snapshots.js` | 采购单明细快照 |
| `purchase-order-links.js` | 采购单关联 |
| `purchase-order-numbering.js` | 采购单编号 |
| `purchase-order-queries.js` | 采购单查询 |
| `purchase-order-read-model.js` | 采购单读模型 |
| `purchase-order-snapshot.js` | 采购单快照 |

## 4. 订单仓储

### 4.1 Facade 结构

`OrderRepository` 当前是 facade：

```text
OrderRepository
├── order/queries.js
├── order/mutations.js
└── order/helpers.js
```

### 4.2 当前真实模型

订单仓储不再只围绕 `orders` 表工作。

当前创建一笔兼容性单行订单时，写入包括：

- `orders`
- `order_lines`
- `order_files`
- `order_timeline`

当前查询订单详情时，读模型会包含：

- 订单头字段
- `lines`
- 文件
- 时间轴

### 4.3 状态与进度

当前订单列表和详情已经区分：

- `orders.status`
  - 审批 / 交付主状态
- `orders.procurement_status`
  - 兼容性采购聚合字段
- `order_lines.display_status`
  - 行级真实展示状态

管理端筛选优先使用订单行聚合表达式，而不是只看头字段。

## 5. 采购仓储

### 5.1 PurchaseOrderRepository

`PurchaseOrderRepository` 负责：

- 创建采购单头
- 维护采购单明细
- 查询采购单列表
- 查询采购单详情读模型

当前采购单详情读模型默认返回：

- `items`
- `receipts`
- 聚合数量字段，如 `ordered_qty`、`received_qty`
- `display_status`

### 5.2 收货与冲销不是简单状态修改

采购链路已经演进为：

- 采购单头和明细由 `PurchaseOrderRepository` 管理
- 收货事实由 `PurchaseReceiptRepository` / 领域服务写入
- 冲销事实通过 `purchase_receipt_reversals` 保留历史

因此：

- “收货”不是单纯 `PATCH purchase order status`
- “冲销”不是删掉历史记录

## 6. 订货总览仓储

`GoodsOverviewRepository` 当前已经按订单行剩余需求建模。

核心特点：

- 基于 `order_lines` 计算缺口
- 结合 `orders.status` 判断活跃需求
- 结合 `inventory_balances` 计算现货、预留和可用量
- 可输出筛选项、概览和列表

这意味着订货总览不再依赖订单头数量做粗粒度统计。

## 7. 商品投影仓储

商品列表不再通过每次请求对所有变体做全表聚合。当前路径是：

- `ProductRepository` 读取 `product_projection`
- `ProductProjectionRepository` 负责按 product id 或 variant id 刷新投影
- 商品 status、价格、库存和库存筛选来自 active variant 聚合结果

开发要求：

- 不要把 `products.status` 当作商品列表和销售可见性的唯一事实源
- 变体状态、库存或需求变化后，必须通过 `ProductProjectionRefreshService` 刷新受影响商品
- 批量状态变更需要先解析 variant id 对应的 product id，再发布携带 `product_ids` 的缓存事件

## 8. Outbox / Replay 仓储

### 8.1 Outbox 数据

当前 outbox 相关仓储主要围绕三张表：

- `domain_outbox`
- `outbox_consumer_jobs`
- `outbox_replay_runs`

### 8.2 OutboxReplayRepository

`OutboxReplayRepository` 当前负责：

- 列出 outbox 事件
- 查看单个事件详情
- 附加 consumer job 和 webhook attempt 状态
- 按 `scopeType=event|command` 查找可 replay 事件
- 创建 / 完成 replay run 记录

它是运维排障的重要支撑，而不是仅供测试使用的内部仓储。

## 9. 与 Service 层的边界

以下逻辑应该放在 Service 层，而不是 Repository：

- 收货命令幂等
- 订单行与订单头的采购进度投影
- 库存断言
- outbox 事件编排
- replay 消费者执行

典型示例：

- `OrderProcurementDomainService`
- `OrderProcurementReceiptReversalService`
- `PurchaseOrderService`
- `OutboxReplayService`

## 10. 常见读写模式

### 10.1 单条查询

```javascript
await db.prepare('SELECT * FROM table WHERE id = ?').bind(id).first();
```

### 10.2 列表查询

```javascript
await db
  .prepare('SELECT * FROM table WHERE status = ? ORDER BY created_at DESC')
  .bind(status)
  .all();
```

### 10.3 批量写入

```javascript
const statements = rows.map((row) => db.prepare('INSERT ...').bind(...row));
await executeBatchChunks(db, statements);
```

当前项目中，大量订单、采购或 outbox 写入时应优先使用 chunked batch helper，而不是默认一次性 `db.batch(...)`。

## 11. 对开发者的要求

- 订单相关需求先确认是否应该读写 `order_lines`
- 采购详情相关需求先确认是否需要读 `receipts`
- 新的运维观测能力优先复用 `OutboxReplayRepository`
- 不要在 Repository 里直接做通知、Webhook、缓存失效等副作用

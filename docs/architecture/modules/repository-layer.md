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

| Repository                  | 文件                                                  | 职责描述                               | 主要表                                                                                       |
| --------------------------- | ----------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `FileRepository`            | `functions/repositories/FileRepository.js`            | 文件 CRUD、回收站、哈希复用            | `files`, `blobs`                                                                             |
| `FolderRepository`          | `functions/repositories/FolderRepository.js`          | 文件夹层级                             | `folders`                                                                                    |
| `OrderRepository`           | `functions/repositories/OrderRepository.js`           | 订单门面，统一暴露读写                 | `orders`, `order_lines`, `order_files`, `order_timeline`                                     |
| `OrderStatsRepository`      | `functions/repositories/OrderStatsRepository.js`      | 订单统计                               | `orders` 及聚合                                                                              |
| `PurchaseOrderRepository`   | `functions/repositories/PurchaseOrderRepository.js`   | 采购单主读写、采购单详情读模型         | `purchase_orders`, `purchase_order_items`, `purchase_receipts`, `purchase_receipt_reversals` |
| `PurchaseReceiptRepository` | `functions/repositories/PurchaseReceiptRepository.js` | 收货事实写入与查询辅助                 | `purchase_receipts`                                                                          |
| `GoodsOverviewRepository`   | `functions/repositories/GoodsOverviewRepository.js`   | 订货总览缺口、在途、筛选项             | `order_lines`, `orders`, `product_variants`, `inventory_balances`                            |
| `NotificationRepository`    | `functions/repositories/NotificationRepository.js`    | 站内通知读写                           | `notifications`                                                                              |
| `OutboxReplayRepository`    | `functions/repositories/OutboxReplayRepository.js`    | outbox 查询、事件详情、replay run 管理 | `domain_outbox`, `outbox_consumer_jobs`, `outbox_replay_runs`, `webhook_logs`                |
| `SalespersonRepository`     | `functions/repositories/SalespersonRepository.js`     | 销售员、登录、token 重置               | `salespersons`                                                                               |

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

## 7. Outbox / Replay 仓储

### 7.1 Outbox 数据

当前 outbox 相关仓储主要围绕三张表：

- `domain_outbox`
- `outbox_consumer_jobs`
- `outbox_replay_runs`

### 7.2 OutboxReplayRepository

`OutboxReplayRepository` 当前负责：

- 列出 outbox 事件
- 查看单个事件详情
- 附加 consumer job 和 webhook attempt 状态
- 按 `scopeType=event|command` 查找可 replay 事件
- 创建 / 完成 replay run 记录

它是运维排障的重要支撑，而不是仅供测试使用的内部仓储。

## 8. 与 Service 层的边界

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

## 9. 常见读写模式

### 9.1 单条查询

```javascript
await db.prepare('SELECT * FROM table WHERE id = ?').bind(id).first();
```

### 9.2 列表查询

```javascript
await db
  .prepare('SELECT * FROM table WHERE status = ? ORDER BY created_at DESC')
  .bind(status)
  .all();
```

### 9.3 批量写入

```javascript
const statements = rows.map((row) => db.prepare('INSERT ...').bind(...row));
await executeBatchChunks(db, statements);
```

当前项目中，大量订单、采购或 outbox 写入时应优先使用 chunked batch helper，而不是默认一次性 `db.batch(...)`。

## 10. 对开发者的要求

- 订单相关需求先确认是否应该读写 `order_lines`
- 采购详情相关需求先确认是否需要读 `receipts`
- 新的运维观测能力优先复用 `OutboxReplayRepository`
- 不要在 Repository 里直接做通知、Webhook、缓存失效等副作用

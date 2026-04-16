# 采购单命令读取与守卫 Helper 去重设计

**日期**: 2026-04-02

## 目标

收敛采购单收货、收货冲销、关闭待收三条命令链路中重复的采购单读取/状态守卫、采购单明细读取/归属校验、库存余额读取，以及 `purchase_order_items` 更新与回滚 statement 壳。

## 现状

以下三个 service 仍保留高相似度实现：

- `functions/services/OrderProcurementDomainService.js`
- `functions/services/OrderProcurementReceiptReversalService.js`
- `functions/services/PurchaseOrderShortageClosureService.js`

重复主要集中在：

1. 读取 `purchase_orders` 并校验允许状态
2. 读取 `purchase_order_items` 并校验归属采购单
3. 读取 `inventory_balances` 并做非负数归一
4. 构造 `purchase_order_items` 的 forward/revert update statement

## 方案比较

### 方案 A: 保持各 service 局部实现

优点:
- 没有新的抽象

缺点:
- 守卫错误文案、字段选择和 SQL 条件容易再次漂移
- 后续修改采购单命令链路时要同时检查多处

### 方案 B: 继续扩展 `order-procurement-shared.js`

优点:
- 延续当前采购单命令共享文件，不新增概念
- 可同时收敛读取守卫与 statement builder
- 对三个 service 的改动最小

缺点:
- shared 文件会继续增长

### 方案 C: 单独新建 `purchase-order-command-guards.js`

优点:
- 文件命名更直观

缺点:
- 读取守卫和命令共享壳分裂到两个 helper 文件
- 当前批次收益有限，不值得引入新边界

## 采用方案

采用方案 B。

## 设计

在 `functions/services/order-procurement-shared.js` 中补充窄边界 helper：

- `requirePurchaseOrder(db, poId, options)`
  - 支持必填校验
  - 查询 `purchase_orders`
  - 可传允许状态与状态错误文案

- `requirePurchaseOrderItemForPo(db, poId, purchaseOrderItemId, options)`
  - 支持必填校验
  - 查询 `purchase_order_items`
  - 校验 `po_id` 归属
  - 支持自定义选择字段，兼容收货与关闭待收差异

- `queryInventoryBalance(db, variantId)`
  - 统一读取 `inventory_balances`
  - 统一 `toNonNegativeInt` 归一
  - `variantId` 为空时返回 `null`

- `buildPurchaseOrderItemUpdateStatement(db, poId, poItem, nextValues, whereGuards)`
  - 统一 `purchase_order_items` 的更新 statement 构造
  - 允许调用方声明 `received_qty` / `cancelled_qty` / `display_status` 等 guard

- `buildPurchaseOrderItemRevertStatement(db, poId, poItem, revertValues, whereGuards)`
  - 统一回滚 statement 构造
  - 保持各 service 现有乐观并发条件

## 调整边界

共享 helper 只做以下收敛：

- 数据读取与存在性/归属性校验
- 非负整型归一
- `purchase_order_items` 更新壳

以下内容仍保留在各 service：

- 业务规则判断，例如可收/可冲销/可关闭待收
- preflight 编排
- `order_lines` 投影与回滚
- outbox 事件拼装
- 采购单状态切换与批处理时序

## 受影响文件

- `functions/services/order-procurement-shared.js`
- `functions/services/OrderProcurementDomainService.js`
- `functions/services/OrderProcurementReceiptReversalService.js`
- `functions/services/PurchaseOrderShortageClosureService.js`
- `functions/services/__tests__/order-procurement-shared.test.js`
- `functions/services/__tests__/OrderProcurementDomainService.test.js`
- `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
- `functions/services/__tests__/PurchaseOrderShortageClosureService.test.js`

## 风险与控制

- 风险: 共享 SQL builder 后 where guard 丢失，导致回滚放宽
  控制: 先写 helper 级失败测试，再跑 3 个 service 回归

- 风险: `queryInventoryBalance` 返回形态变化影响收货/冲销
  控制: 保持字段名和默认值完全一致，只移动实现位置

- 风险: `requirePurchaseOrderItemForPo` 选择字段不一致
  控制: helper 支持自定义 `SELECT` 字段列表，避免为抽象而抽象

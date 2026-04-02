# 采购单命令 Order Line Statement Shell 去重设计

**日期**: 2026-04-02

## 目标

收敛采购单收货与收货冲销命令中重复的 `order_lines` 更新/回滚 SQL 壳，以及兼容订单 `procurement_status` 写入 statement 壳，减少相同乐观并发条件在多个 service 中重复平铺。

## 现状

当前重复主要分布在：

- `functions/services/OrderProcurementDomainService.js`
- `functions/services/OrderProcurementReceiptReversalService.js`

重复形态包括：

1. `order_lines` 的 `UPDATE` statement builder
2. `order_lines` 回滚 statement builder
3. `orders.procurement_status` 的写入 statement builder

这些 builder 的差异主要体现在：

- 是否要求 `display_status` guard
- 是否要求兼容订单避开 `delivered` / `void`
- 是否要求新旧 `procurement_status` 不相等

## 方案比较

### 方案 A: 维持两个 service 各自局部 builder

优点:
- 无需新增 helper

缺点:
- 相同字段顺序和并发 guard 继续分散
- 以后修改 SQL guard 时容易只改一半

### 方案 B: 在 `order-procurement-shared.js` 增加可配置 statement builder

优点:
- 与现有采购单命令 shared helper 保持同一边界
- 可复用又不强迫统一业务语义
- 风险最低

缺点:
- helper 参数会比上一批更长

### 方案 C: 做一个通用 SQL DSL

优点:
- 理论上可覆盖更多写入场景

缺点:
- 过度抽象
- 不符合当前“采购单域窄边界 helper”策略

## 采用方案

采用方案 B。

## 设计

在 `functions/services/order-procurement-shared.js` 中补充：

- `buildOrderLineProjectionStatement(db, orderLine, nextOrderLine, timestamp, options)`
  - 统一 `order_lines` 写入字段顺序
  - 默认保留现有 received/cancelled/ordered/procured/reserved/shipped guard
  - 可选追加 `display_status` guard

- `buildCompatibilityOrderProcurementStatusStatement(db, orderId, procurementStatus, timestamp, options)`
  - 统一 `orders.procurement_status` 写入
  - 可选启用：
    - 跳过终态订单 guard
    - 仅在状态变化时写入 guard

## 调整边界

本批只收敛 statement builder，不处理：

- `purchase_orders.status` 的状态迁移 statement
- 采购单聚合查询
- `order_lines` 读取与状态投影算法
- outbox 事件拼装

## 受影响文件

- `functions/services/order-procurement-shared.js`
- `functions/services/OrderProcurementDomainService.js`
- `functions/services/OrderProcurementReceiptReversalService.js`
- `functions/services/__tests__/order-procurement-shared.test.js`
- 相关 service 测试文件

## 风险与控制

- 风险: `order_lines` guard 顺序漂移导致测试假绿
  控制: 先补 helper 级参数断言，再跑 service 回归

- 风险: `procurement_status` 写入条件被意外统一，改变冲销链语义
  控制: helper 只抽 SQL 壳，条件通过 options 显式传入

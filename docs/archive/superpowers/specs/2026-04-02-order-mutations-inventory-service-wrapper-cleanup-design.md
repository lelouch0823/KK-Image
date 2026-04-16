# Order Mutations Inventory Service Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/repositories/order/mutations.js` 内部的局部 `resolveInventoryService` helper，直接在调用点使用 `options.inventoryService || new InventoryService(db)`。

## 本批范围

仅处理：

- `functions/repositories/order/mutations.js` 的 `resolveInventoryService`

## 现状

当前 helper 只是：

- 接收 `db` 与 `options`
- 返回 `options.inventoryService || new InventoryService(db)`

它只在同文件 `updateStatus` 与 `batchUpdateStatus` 中被调用，没有额外逻辑。

## 方案比较

### 方案 A: 保留 helper

优点:
- 调用点更短

缺点:
- 保留一层无业务语义的本地工厂壳
- 阅读时需要额外跳转

### 方案 B: 直接在调用点内联 fallback

优点:
- 删除局部薄包装
- 依赖注入 fallback 逻辑就地可见
- 改动点只有两个

缺点:
- 表达式会重复两次

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增一个静态 audit test，锁定 `resolveInventoryService` 不再存在
2. 先跑红灯，确认 wrapper 仍在
3. 删除 helper，并在 `updateStatus` / `batchUpdateStatus` 两处直接内联 fallback
4. 复跑 `order-inventory-flow.test.js` 与 `order-mutations.test.js`

## 不处理内容

本批不处理：

- `InventoryService` 自身实现
- 订单库存变更语义
- 其它数量/状态 helper

## 风险与控制

- 风险: 漏掉 `options.inventoryService` 注入通路
  控制: 保持原 fallback 表达式不变，并跑现有库存流测试

- 风险: 只改到一个调用点
  控制: 先用 `rg` 锁定两个 `resolveInventoryService(...)` 调用点

# Sales Order Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `sales/orders.js` 中只透传到 `requireEntity` 的局部 `requireSalesOrder` helper，继续压缩 route 层重复定义。

## 本批范围

仅处理：

- `functions/lib/hono/routes/sales/orders.js` 的 `requireSalesOrder`

## 现状

这个 helper 当前只做一件事：

- 调用 `orderRepo.findByIdAndSalesperson(orderId, salespersonId)`
- 立即转发给 `requireEntity(...)`
- 缺失时抛 `MSG.ORDER.NOT_FOUND`

它没有额外权限判断、状态约束或缓存语义，只是局部薄壳。

## 方案比较

### 方案 A: 保留 helper

优点:
- 调用点更短

缺点:
- 继续保留重复定义
- 实际读取语义被藏在局部 helper 里

### 方案 B: 内联 `requireEntity`

优点:
- 路由层读取语义更直接
- 与前面几批 route cleanup 保持一致
- 改动点少，验证成本低

缺点:
- 调用点会变长

## 采用方案

采用方案 B。

## 设计

顺序保持一致：

1. 扩展已有 route thin-wrapper audit test，把 `sales/orders.js` 纳入
2. 先跑 test，确认当前因 `requireSalesOrder` 仍存在而失败
3. 删除 helper，并在原调用点直接写 `requireEntity(...)`
4. 复跑 `sales-routes-resilience.test.js`

## 不处理内容

本批不处理：

- `sales/files.js`
- `sales/products.js`
- 销售端其它状态判断逻辑

## 风险与控制

- 风险: 丢失“只允许当前 salesperson 读取”的 not-found 语义
  控制: 保持 `findByIdAndSalesperson(...)` 不变，只替换外层 helper

- 风险: 漏掉某个调用点
  控制: 先用 `rg` 锁定全部 `requireSalesOrder(...)` 引用，再做机械替换

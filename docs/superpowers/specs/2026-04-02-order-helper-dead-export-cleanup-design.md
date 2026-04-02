# Order Helper Dead Export Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/repositories/order/helpers.js` 中仅在同文件内部使用的 `mapOrderLine` 与 `aggregateOrderDisplayStatus` 导出。

## 本批范围

仅处理：

- `functions/repositories/order/helpers.js`
- 一条静态 dead-export audit test
- 现有 `order-helpers.procurement-status.test.js`
- 现有 `order-queries.display-model.test.js`

## 现状

仓内搜索结果显示：

- `mapOrderLine` 只在 `mapOrderDetail` 内部被调用
- `aggregateOrderDisplayStatus` 只在 `mapOrderDetail` 内部被调用
- 外部真实依赖面仍是 `mapOrderListItem` 与 `mapOrderDetail`

## 方案比较

### 方案 A: 保留死导出

优点:
- 未来如果要外部复用，可以直接 import

缺点:
- 当前无外部调用
- 增大仓储 helper 模块导出面
- 给重复定义清理和静态审查增加噪音

### 方案 B: 降为局部函数

优点:
- 收缩导出面
- 不改变现有查询仓储边界
- 风险低，收益直接

缺点:
- 未来若要复用，需要重新导出

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定 `mapOrderLine` 与 `aggregateOrderDisplayStatus` 不再以导出函数形式存在
2. 先跑红灯确认当前导出仍在
3. 将这两个 helper 改为局部函数
4. 跑现有 helper 与 query 测试，确认详情映射和 `displayStatus` 聚合行为不变

## 不处理内容

本批不处理：

- `mapOrderListItem`
- `mapOrderDetail`
- 查询 SQL 结构
- `OrderStatusProjectionService` 语义

## 风险与控制

- 风险: 误改详情映射时破坏 order line 字段投影
  控制: 运行 `order-queries.display-model.test.js`

- 风险: 误伤列表/详情采购状态兼容逻辑
  控制: 运行 `order-helpers.procurement-status.test.js`

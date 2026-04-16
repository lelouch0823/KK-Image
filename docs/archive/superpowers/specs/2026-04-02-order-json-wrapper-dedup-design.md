# Order JSON Wrapper 去重设计

**日期**: 2026-04-02

## 目标

移除订单仓储辅助模块里对 `parseJsonObject` 的薄包装，直接复用现有 JSON utility，减少一层无业务价值的 `parseJson` wrapper。

## 现状

当前 `functions/repositories/order/helpers.js` 里定义了：

- `parseJson(jsonStr)`

其实现只是：

- `return parseJsonObject(jsonStr, {})`

并被以下位置使用：

- `order/helpers.js` 内部的 `mapOrderListItem`
- `order/helpers.js` 内部的 `mapOrderDetail`
- `functions/repositories/OrderStatsRepository.js`

## 方案比较

### 方案 A: 保留 `parseJson` 包装

优点:
- 名字更短

缺点:
- 只是单行透传，没有独立语义
- 与之前收掉的 thin wrapper 模式一致，属于重复抽象

### 方案 B: 直接复用 `parseJsonObject`

优点:
- 已有共享工具，语义明确
- 改动面小
- 可以继续统一 JSON fallback 规则

缺点:
- 调用点名字稍长

### 方案 C: 再新建订单 JSON util

优点:
- 无实际收益

缺点:
- 新增抽象，违背当前目标

## 采用方案

采用方案 B。

## 设计

调整方式：

1. 删除 `order/helpers.js` 中的 `parseJson`
2. 在 `mapOrderListItem` / `mapOrderDetail` 中直接调用 `parseJsonObject(..., {})`
3. 让 `OrderStatsRepository` 直接从 JSON utility 导入 `parseJsonObject`

## 调整边界

本批只处理这层薄 JSON wrapper，不处理：

- 订单 helper 里的其它映射函数
- 其它仓储模块的 JSON 逻辑
- `safeJsonParse` / `parseJsonArray` / `parseJsonObject` 本身

## 受影响文件

- `functions/repositories/order/helpers.js`
- `functions/repositories/OrderStatsRepository.js`
- `functions/repositories/__tests__/order-helpers.procurement-status.test.js`
- 新增一份 order json wrapper audit test
- 新增 `OrderStatsRepository` 测试文件

## 风险与控制

- 风险: invalid JSON fallback 形态发生变化
  控制: 先补测试锁住 `{}` 回退和空名称结果，再改实现

- 风险: wrapper 被删后其他模块继续导入
  控制: 增加 audit test，直接约束 `parseJson` 不再保留、`OrderStatsRepository` 不再导入它

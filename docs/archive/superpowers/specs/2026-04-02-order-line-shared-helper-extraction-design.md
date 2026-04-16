# Order Line Shared Helper 抽取设计

**日期**: 2026-04-02

## 目标

把已同时出现在采购命令链与订单履约链中的通用 helper 抽到独立文件，避免继续把通用逻辑堆进 `order-procurement-shared.js`，并收敛重复定义。

## 现状

当前至少有两类 helper 同时出现在两个范围：

1. `queryInventoryBalance(db, variantId)`
   - 采购命令共享 helper 中已有
   - `OrderLineFulfillmentService` 里又有一份独立实现

2. `order_lines` full-projection update statement builder
   - 采购命令共享 helper 中已有
   - `OrderLineFulfillmentService` 里也有一份局部实现

这些逻辑都不真正依赖 procurement 语义，但目前名称归属仍在 `order-procurement-shared.js`。

## 方案比较

### 方案 A: 直接让 `OrderLineFulfillmentService` 依赖 `order-procurement-shared.js`

优点:
- 改动最少

缺点:
- 文件名与职责不符
- 继续放大 procurement helper 的语义范围

### 方案 B: 抽出 `order-line-shared.js`

优点:
- 通用 helper 回到更准确的边界
- procurement 与 fulfillment 都能复用
- 后续如果还有订单行命令链可继续复用

缺点:
- 需要多一个 shared 文件

### 方案 C: 暂不处理跨域重复

优点:
- 零抽象成本

缺点:
- 重复定义继续保留
- 后续更难判断 helper 归属

## 采用方案

采用方案 B。

## 设计

新增 `functions/services/order-line-shared.js`，承载：

- `queryInventoryBalance(db, variantId)`
- `buildOrderLineProjectionStatement(db, nextOrderLine, expectedOrderLine, timestamp, options)`

保留在 `functions/services/order-procurement-shared.js` 中的能力：

- reservation / replay / finalize / cleanup
- purchase-order 读取与 statement builder
- compatibility-order procurement-status builder
- procurement 域自己的 `requireOrderLine` 和 aggregate 查询

迁移策略：

1. 新文件提供通用实现
2. `order-procurement-shared.js` 改为从新文件复用并继续导出，避免立即放大 procurement service 改动面
3. `OrderLineFulfillmentService.js` 直接依赖新文件

## 受影响文件

- `functions/services/order-line-shared.js`
- `functions/services/order-procurement-shared.js`
- `functions/services/OrderLineFulfillmentService.js`
- `functions/services/__tests__/order-line-shared.test.js`
- `functions/services/__tests__/OrderLineFulfillmentService.test.js`
- 可能受影响的 procurement service 回归测试

## 风险与控制

- 风险: helper 抽出后导出路径变化引发 procurement 回归
  控制: `order-procurement-shared.js` 继续保留导出壳，本批不改 procurement service import 路径

- 风险: `OrderLineFulfillmentService` 的 SQL 形状与 procurement 变体混淆
  控制: 新 helper 仅复用 full-projection 模式，不复用 procurement 的 received-only 变体

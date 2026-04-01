# 采购单投影公式去重设计

**日期**: 2026-04-02

## 目标

把采购单 `ordered/received/cancelled/outstanding/display_status` 这组重复公式收敛到清晰边界内，避免仓储层、服务层和前端入口各自维护一套近似实现。

## 现状

- 后端投影基础函数位于 `functions/services/purchase-order-projection.js`，但只覆盖采购单明细和兼容订单采购状态。
- `functions/repositories/PurchaseOrderRepository.js` 自己维护了采购单头部的数量归一化和 `display_status` 推导。
- `functions/services/PurchaseOrderService.js` 自己维护了到货门禁与取消门禁所需的 `outstanding_qty`、`received_qty` 计算。
- 前端入口 `src/utils/purchase-order-progress.js` 也维护了同类数量 helper，供 `src/views/PurchaseOrders.vue` 使用。

## 方案

### 方案 A: 只改前端

优点:
- 变更最小

缺点:
- 后端仍保留两套头部投影逻辑
- 不能解决服务门禁和仓储读模型的未来漂移

### 方案 B: 后端统一投影，前端保持独立入口

优点:
- 后端把业务事实计算集中到 `purchase-order-projection.js`
- 前端继续保留 `src/utils/purchase-order-progress.js`，不做跨 runtime 共享
- 边界清晰，风险可控

缺点:
- 前后端仍是两套入口，但语义会更一致

### 方案 C: 前后端共用一套 helper

优点:
- 理论上重复最少

缺点:
- 会混淆 server/client 边界
- 后续容易把展示逻辑和领域投影缠在一起

## 采用方案

采用方案 B。

## 设计

### 后端

在 `functions/services/purchase-order-projection.js` 新增采购单头部投影函数:

- `getPurchaseOrderOrderedQty`
- `getPurchaseOrderCancelledQty`
- `getPurchaseOrderReceivedQty`
- `getPurchaseOrderOutstandingQty`
- `projectPurchaseOrderDisplayStatus`

这些函数要兼容两类输入:

- 采购单头记录: 直接使用 `ordered_qty/received_qty/cancelled_qty/outstanding_qty`
- 包含 `items` 的头记录: 缺字段时从明细汇总

`PurchaseOrderRepository` 和 `PurchaseOrderService` 统一复用这些函数，不再各自维护头部进度公式。

### 前端

保留 `src/utils/purchase-order-progress.js` 作为 UI 侧入口，但补齐与后端语义对齐的 `cancelled_qty` 读取能力，避免 `PurchaseOrders.vue` 再直接手写数量兜底。

`PurchaseOrders.vue` 只通过前端 progress helper 读取 ordered/received/cancelled/outstanding。

## 非目标

- 不处理采购单命令幂等骨架去重
- 不处理 SQL 聚合查询本身的抽象
- 不做前后端共享模块

## 风险与控制

- 风险: 头记录和 items 记录的字段优先级变化导致状态门禁变化
  控制: 先补 helper 单测，再跑服务/仓储/视图回归

- 风险: 仓储层读模型原本对 `display_status` 的兜底逻辑被改坏
  控制: 保留现有 `display_status` 字段优先级，只收敛兜底公式

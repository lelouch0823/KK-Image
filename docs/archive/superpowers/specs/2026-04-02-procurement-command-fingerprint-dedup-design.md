# Procurement Command Fingerprint 去重设计

**日期**: 2026-04-02

## 目标

收敛采购命令服务里的 request fingerprint 构造逻辑，复用 `functions/services/order-procurement-shared.js`，避免 3 个服务各自维护一套局部 fingerprint helper。

## 现状

当前以下服务仍各自定义本地 fingerprint helper：

- `functions/services/OrderProcurementDomainService.js`
  - `buildReceiptRequestFingerprint`
- `functions/services/OrderProcurementReceiptReversalService.js`
  - `buildReversalFingerprint`
- `functions/services/PurchaseOrderShortageClosureService.js`
  - `buildClosureRequestFingerprint`

这些 helper 的共同职责都是：

- 把采购命令请求规整成稳定 JSON 结构
- 作为命令幂等表 `request_fingerprint` 的比较依据
- 由服务在 reserve/replay 幂等流程里直接调用

## 方案比较

### 方案 A: 保留各服务局部 helper

优点:
- 单文件内自解释

缺点:
- 相同职责分散在 3 处
- 后续幂等请求归一化规则难以统一维护

### 方案 B: 提取到 `order-procurement-shared.js`

优点:
- 与现有 `replayReservedCommand` / `cleanupReservedCommand` 等幂等共享逻辑同域
- 变更边界小
- 方便单测直接覆盖 fingerprint 规则

缺点:
- 需要给 shared 模块补 1 组更明确的测试

### 方案 C: 新增独立 fingerprint util 模块

优点:
- 无明显额外收益

缺点:
- 新增模块和概念，超出当前批次需要

## 采用方案

采用方案 B。

## 设计

在 `order-procurement-shared.js` 中新增共享 fingerprint builder：

- `buildReceiptRequestFingerprint(poId, payload)`
- `buildReversalRequestFingerprint(poId, receiptId, payload)`
- `buildShortageClosureRequestFingerprint(poId, payload)`

实现原则：

1. 保持现有 fingerprint 语义完全不变
2. item 型 fingerprint 继续做稳定排序
3. 仅移动共享逻辑，不调整服务对外 API 和错误消息

## 调整边界

本批只处理采购命令 fingerprint helper，不处理：

- 其他数值归一化 helper，如 `toNumber` / `normalizeQuantity`
- 非采购域的 idempotency helper
- 命令执行主流程和 SQL 语句

## 受影响文件

- `functions/services/order-procurement-shared.js`
- `functions/services/OrderProcurementDomainService.js`
- `functions/services/OrderProcurementReceiptReversalService.js`
- `functions/services/PurchaseOrderShortageClosureService.js`
- `functions/services/__tests__/order-procurement-shared.test.js`
- 新增一份 procurement fingerprint audit test
- 相关服务测试文件

## 风险与控制

- 风险: fingerprint 细节变化会影响已存在的幂等 replay 行为
  控制: 先补 shared helper 单测，锁住排序和字段归一化规则，再改实现

- 风险: 去重后服务仍残留本地 helper
  控制: 增加 audit test，直接约束这 3 个服务不再定义局部 fingerprint helper

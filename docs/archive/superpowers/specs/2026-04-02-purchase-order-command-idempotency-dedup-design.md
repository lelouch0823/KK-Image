# 采购单命令幂等骨架去重设计

**日期**: 2026-04-02

## 目标

收敛采购单收货、收货冲销、关闭待收三条命令链路中重复的幂等处理骨架，减少相同外壳逻辑在多个 service 中平铺复制。

## 现状

以下三个 service 都维护了近似相同的命令生命周期：

- `functions/services/OrderProcurementDomainService.js`
- `functions/services/OrderProcurementReceiptReversalService.js`
- `functions/services/PurchaseOrderShortageClosureService.js`

共同步骤包括：

1. 保留命令 reservation
2. 校验 `request_fingerprint`
3. 已提交则 replay 原响应
4. 未提交则报 in-flight
5. 成功后写入 `response_json`
6. 出错时在拥有 reservation 的前提下删除命令记录

## 方案比较

### 方案 A: 继续维持三份局部实现

优点:
- 没有抽象成本

缺点:
- 修改错误文案、reservation 语义或 finalize 流程时要改三处
- 更容易出现一条命令链忘记 cleanup 或 replay 规则漂移

### 方案 B: 抽取窄边界 shared helper

优点:
- 只收敛公共骨架，不碰业务写入细节
- service 仍保留各自 preflight、outbox、回滚步骤
- 风险可控

缺点:
- 仍有部分 try/catch 结构留在各 service 中

### 方案 C: 把三条命令链包装成统一 command runner

优点:
- 重复最少

缺点:
- 抽象层过深
- preflight、chunked write、revert 语义差异较大，容易把逻辑硬揉在一起

## 采用方案

采用方案 B。

## 设计

在 `functions/services/order-procurement-shared.js` 中补充以下共享 helper：

- `resolveReservationOwnership(reservation)`
  - 统一 `ownsReservation ?? Boolean(insertStatement)` 语义

- `replayReservedCommand(reservation, requestFingerprint, messages)`
  - 统一 existing reservation 的三路分支
  - 指纹不匹配直接抛错
  - 已提交且 `response_json` 可解析则 replay
  - 否则抛 in-flight 错误

- `buildFinalizeCommandStatements(...)`
  - 统一组装 `UPDATE purchase_orders SET updated_at = ?` 与 `buildFinalizeStatement(...)`
  - 允许附加额外 statements

- `cleanupReservedCommand(...)`
  - 统一在拥有 reservation 时删除 `command_idempotency`

## 调整边界

共享 helper 只处理命令外壳，不处理以下内容：

- 业务前置校验
- preflight statement 生成
- 业务回滚语义
- outbox event 构造
- SQL 批量执行策略

这些仍留在原 service 中。

## 受影响文件

- `functions/services/order-procurement-shared.js`
- `functions/services/OrderProcurementDomainService.js`
- `functions/services/OrderProcurementReceiptReversalService.js`
- `functions/services/PurchaseOrderShortageClosureService.js`
- `functions/services/__tests__/order-procurement-shared.test.js`
- 相关 service 测试文件

## 风险与控制

- 风险: 统一 helper 后错误文案或 replay 语义变化
  控制: 先给 shared helper 写独立测试，再跑三条 service 现有幂等回归

- 风险: finalize 语句组装顺序变化影响现有测试
  控制: 保持 statement 顺序不变，只把重复构造收敛到 helper

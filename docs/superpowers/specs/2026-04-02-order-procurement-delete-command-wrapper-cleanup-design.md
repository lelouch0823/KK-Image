# Order Procurement Delete Command Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/services/order-procurement-shared.js` 中的 `buildDeleteCommandStatement` 薄包装，直接在 `cleanupReservedCommand` 里构造 fallback 删除语句。

## 本批范围

仅处理：

- `functions/services/order-procurement-shared.js` 的 `buildDeleteCommandStatement`
- `functions/services/__tests__/order-procurement-shared.test.js` 对该 helper 的直接测试

## 现状

当前 helper 只做一件事：

- `return db.prepare('DELETE FROM command_idempotency WHERE command_id = ?').bind(commandId)`

仓内调用面只有：

- `cleanupReservedCommand` 内部 fallback 路径
- 一个直接单元测试

## 方案比较

### 方案 A: 保留 wrapper

优点:
- 删除 SQL 语句有一个名字

缺点:
- 继续保留零逻辑包装
- 真实语义已经被 `cleanupReservedCommand` 函数名覆盖
- 对外导出但没有真实复用价值

### 方案 B: 在 fallback 处直接内联语句

优点:
- 删除一层薄壳
- 更贴近唯一使用点
- 风险低，测试面集中

缺点:
- 删除 SQL 文本不再有单独命名 helper

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定 `buildDeleteCommandStatement` 不再存在
2. 先跑红灯确认 wrapper 仍在
3. 删除导出函数
4. 在 `cleanupReservedCommand` fallback 路径直接内联 `db.prepare(...).bind(commandId)`
5. 将原 helper 单测改成验证 fallback cleanup 路径仍会构造正确的删除语句

## 不处理内容

本批不处理：

- `commandIdempotencyRepo.buildDeleteStatement` 的接口
- `buildFinalizeCommandStatements`
- 采购指纹、库存或行项目相关 helper

## 风险与控制

- 风险: fallback 删除 SQL 被改错
  控制: 用更新后的共享测试断言 `prepare` 和 `bind` 参数

- 风险: 误伤 repo 自带删除语句分支
  控制: 保留现有 repo-path 测试并继续断言 `db.prepare` 不被调用

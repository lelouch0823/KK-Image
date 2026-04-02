# Audit Failure Recorded Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/lib/hono/_shared/audit-helpers.js` 中的 `hasAuditFailureRecorded` 薄包装，直接在 `errorHandler.js` 中读取 `c.get('auditFailureRecorded')`。

## 本批范围

仅处理：

- `functions/lib/hono/_shared/audit-helpers.js` 的 `hasAuditFailureRecorded`
- `functions/lib/hono/middleware/errorHandler.js` 的唯一调用点

## 现状

当前 helper 只做一件事：

- `return Boolean(c.get('auditFailureRecorded'))`

仓内唯一调用点：

- `functions/lib/hono/middleware/errorHandler.js`

## 方案比较

### 方案 A: 保留 wrapper

优点:
- `errorHandler` 里读起来更像业务语义

缺点:
- 继续保留单点使用的零逻辑包装
- 阅读时需要跳转到 helper 才能看到真实判断

### 方案 B: 在 `errorHandler` 直接读取 context flag

优点:
- 删除一层薄壳
- 唯一调用点更直接
- 改动面很小

缺点:
- `errorHandler` 里会出现一段 `Boolean(c.get(...))`

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定 `hasAuditFailureRecorded` 不再存在
2. 先跑红灯确认 wrapper 仍在
3. 删除导出函数
4. 在 `errorHandler.js` 中直接用 `Boolean(c.get('auditFailureRecorded'))`
5. 跑全局错误处理相关运行时测试，确认失败审计仍正常记录

## 不处理内容

本批不处理：

- `setAuditFailureRecorded`
- 审计事件写入逻辑
- 其它 route/runtime audit helper

## 风险与控制

- 风险: 直接读取 flag 后全局错误处理不再记录失败审计
  控制: 运行 `audit-runtime-alignment.test.js`

- 风险: `errorHandler` import 清理不完整
  控制: 跑 `eslint`

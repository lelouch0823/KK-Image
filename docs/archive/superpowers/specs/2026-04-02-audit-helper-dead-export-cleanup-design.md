# Audit Helper Dead Export Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/lib/hono/_shared/audit-helpers.js` 中仓内无真实使用的 `recordAuditEvents` 导出。

## 本批范围

仅处理：

- `functions/lib/hono/_shared/audit-helpers.js`
- 一条静态 dead-export audit test
- 现有 `auth-helpers.audit.test.js`
- 现有 `audit-runtime-alignment.test.js`

## 现状

全仓搜索结果显示：

- `recordAuditEvents` 只出现在 `audit-helpers.js` 定义处
- 同模块中的 `recordAuditEvent`、`buildAuditEvent`、`scheduleAuditEvent` 仍被真实代码与测试使用

## 方案比较

### 方案 A: 保留死导出

优点:
- 保留一个批量写审计日志的潜在入口

缺点:
- 当前无真实调用方
- 扩大共享审计 helper 模块表面积
- 容易让后续审查误判为仍被支持的公共接口

### 方案 B: 删除死导出

优点:
- 收缩共享模块导出面
- 不影响现有单条审计事件写入路径
- 风险低

缺点:
- 未来如果需要批量写入，要重新定义接口

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定 `recordAuditEvents` 不再被导出
2. 先跑红灯确认当前导出仍在
3. 删除 `recordAuditEvents`
4. 跑现有 auth helper 与 audit runtime 对齐测试，确认共享审计模块真实使用链路不变

## 不处理内容

本批不处理：

- `recordAuditEvent`
- `buildAuditEvent`
- `scheduleAuditEvent`
- 审计路由声明或运行时契约

## 风险与控制

- 风险: 删除时误伤共享审计模块结构
  控制: 运行 `audit-runtime-alignment.test.js`

- 风险: 间接影响登录锁定/失败审计调用
  控制: 运行 `auth-helpers.audit.test.js`

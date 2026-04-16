# Backend JSON Parse Helper 去重设计

**日期**: 2026-04-02

## 目标

复用现有 `functions/api/utils/json.js` 里的 `safeJsonParse`，收敛后端多个模块各自实现的“JSON.parse + fallback” 小 helper。

## 现状

当前至少有以下重复实现：

- `functions/repositories/OutboxReplayRepository.js` 的 `parseSummaryJson`
- `functions/services/DomainOutboxConsumers.js` 的 `parsePayload`
- `functions/services/WebhookDeliveryService.js` 的 `parsePayload`
- `functions/lib/hono/routes/manage/audit-logs.js` 的 `parseJsonField`

这些 helper 的共同点：

- 输入通常是字符串 JSON 或已解析对象
- 解析失败时回退到固定默认值
- 与现有 `safeJsonParse(value, fallback)` 的职责高度重合

## 方案比较

### 方案 A: 保留各模块局部 helper

优点:
- 每个文件自解释

缺点:
- 重复定义继续存在
- fallback 行为要在多处同步

### 方案 B: 统一复用 `safeJsonParse`

优点:
- 已有现成工具，无需新增抽象
- 变更面小
- 行为更一致

缺点:
- 个别模块仍需保留一层很薄的语义包装，或者直接内联调用

### 方案 C: 新增另一套 parse helper

优点:
- 无实际优势

缺点:
- 新增概念，违背当前目标

## 采用方案

采用方案 B。

## 设计

迁移策略：

1. 对于纯 fallback parse 场景，直接调用 `safeJsonParse`
2. 对于需要保持 `!value` 先回退的场景，显式传入 `value || null`
3. 不修改模块对外 API，只改内部 parse helper 实现或调用点

## 调整边界

本批只处理后端重复 parse helper，不处理：

- 前端组件中的 `JSON.parse`
- 测试代码里的请求体断言 `JSON.parse`
- 需要 `parseJsonArray` / `parseJsonObject` 的类型专用场景

## 受影响文件

- `functions/api/utils/json.js`
- `functions/repositories/OutboxReplayRepository.js`
- `functions/services/DomainOutboxConsumers.js`
- `functions/services/WebhookDeliveryService.js`
- `functions/lib/hono/routes/manage/audit-logs.js`
- 相关测试文件

## 风险与控制

- 风险: `safeJsonParse` 与局部 helper 在 falsy 值上的语义有细微差异
  控制: 通过 `value || null` 显式保留原有回退规则

- 风险: 审计日志或 webhook payload 解析失败时默认值变化
  控制: 先补测试锁住 `{}` / `null` 回退形态，再改实现

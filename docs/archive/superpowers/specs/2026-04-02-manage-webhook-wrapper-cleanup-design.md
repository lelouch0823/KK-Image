# Manage Webhook Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `manage/webhooks.js` 中局部 `requireWebhook` helper，直接在调用点使用共享 `requireEntity`。

## 本批范围

仅处理：

- `functions/lib/hono/routes/manage/webhooks.js` 的 `requireWebhook`

## 现状

当前 helper 只做三件事：

- 调用 `repo.getById(id)`
- 判空后抛 `MSG.WEBHOOK.NOT_FOUND`
- 返回 webhook

这是 route 内部的一层薄包装，没有额外业务语义。

## 方案比较

### 方案 A: 保留 helper

优点:
- 调用点更短

缺点:
- 继续保留局部重复定义
- 与前面几批 route cleanup 不一致

### 方案 B: 直接用 `requireEntity(repo.getById(id), ...)`

优点:
- 统一 not-found guard 写法
- 删除局部壳函数
- 改动很小

缺点:
- 调用表达式更长

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 扩展已有 route thin-wrapper audit test，把 `manage/webhooks.js` 纳入
2. 先跑红灯，确认当前 wrapper 仍存在
3. 删除 `requireWebhook`
4. 在 `GET/PUT/DELETE/POST test` 调用点直接用 `requireEntity(repo.getById(...), ...)`
5. 跑现有 manage webhook route tests

## 不处理内容

本批不处理：

- `v1/webhooks.js`
- webhook payload 结构
- 事件 catalog 筛选逻辑

## 风险与控制

- 风险: 忘记补 `requireEntity` import
  控制: 跑 fresh `eslint`

- 风险: delete/test 路径漏改
  控制: 用 `rg` 锁定全部 `requireWebhook(...)` 调用点后再替换

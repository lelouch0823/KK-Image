# V1 Webhook Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `v1/webhooks.js` 中局部 `requireWebhookById` helper，直接在调用点使用 `requireEntity` 包住对应 SQL 查询。

## 本批范围

仅处理：

- `functions/lib/hono/routes/v1/webhooks.js` 的 `requireWebhookById`

## 现状

这个 helper 当前只负责：

- 拼 `SELECT ${columns} FROM webhooks WHERE id = ?`
- 执行查询
- 缺失时抛 `MSG.WEBHOOK.NOT_FOUND`

它没有额外业务规则，只是把两种查询形态包成一层局部壳。

## 方案比较

### 方案 A: 保留 helper

优点:
- 调用更短

缺点:
- 继续保留局部重复壳
- `columns` 参数让调用点真实查询不够直观

### 方案 B: 直接在调用点内联查询 + `requireEntity`

优点:
- 查询列与 not-found 语义就地可见
- 去掉最后一个 webhook route 局部壳
- 改动仍然很小

缺点:
- `SELECT *` / `SELECT id` 查询会在文件里重复几次

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 扩展已有 route thin-wrapper audit test，把 `v1/webhooks.js` 纳入
2. 先跑红灯，确认当前 wrapper 仍存在
3. 删除 `requireWebhookById`
4. 在 `GET/PUT/DELETE/POST test` 调用点直接写对应查询
5. 跑现有 `v1/webhooks-routes.test.js`

## 不处理内容

本批不处理：

- webhook log 写入逻辑
- webhook payload / 签名逻辑
- `manage/webhooks.js` 以外的其它 webhook 结构

## 风险与控制

- 风险: `PUT/DELETE` 误把只需要 `id` 的查询改成整行查询或写错 SQL
  控制: 保持原 `SELECT id FROM webhooks WHERE id = ?` 语义不变

- 风险: `GET/test` 路径漏了 `rowToWebhook` 所需字段
  控制: 保持 `SELECT * FROM webhooks WHERE id = ?`

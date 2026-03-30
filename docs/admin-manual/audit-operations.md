# 审计与 Outbox 运维手册

本文档说明如何在 kk-life 中查看审计日志、检查 outbox 事件，以及在必要时执行 replay 排障。

## 1. 适用范围

- 管理端审计中心
- `audit:read` / `audit:export` 权限持有者
- 运维、合规、事故响应人员

## 2. 审计入口与权限

- 审计列表：`GET /api/manage/audit-logs`
- 审计导出：`GET /api/manage/audit-logs/export`

权限要求：

- 查看日志：`audit:read`
- 导出日志：`audit:export`

## 3. Outbox 运维入口

除了审计日志，当前还提供管理端页面和接口两组 outbox 运维入口：

- 页面：`/admin/outbox-ops`

- outbox 事件列表：`GET /api/manage/outbox`
- outbox 事件详情：`GET /api/manage/outbox/:eventId`
- replay 预演：`POST /api/manage/audit-replay/dry-run`
- replay 执行：`POST /api/manage/audit-replay/execute`

这些接口用于排查“主业务成功，但通知 / Webhook / 缓存等副作用缺失”的问题。

### 3.1 `/admin/outbox-ops` 页面能力

页面当前提供：

- 事件列表筛选：`eventType` / `consumerName` / `status`
- 事件详情查看：原始 outbox 事件、consumer jobs、Webhook 尝试记录
- replay 预演：先看命中范围，不真正执行
- replay 执行：确认后按事件或 command 重驱动副作用

推荐做法：

1. 先在页面里筛到具体事件
2. 打开详情确认失败 consumer
3. 先 dry-run，再 execute

## 4. 审计筛选建议

常用筛选项：

- `actorId`
- `actorType`
- `domain`
- `action`
- `result`
- `severity`
- `targetType`
- `targetId`
- `start`
- `end`

排查顺序：

1. 先按 `domain` 缩小业务域
2. 再按 `result=denied|failed` 看异常
3. 最后结合 `actorId` / `targetId` 追溯具体操作和实体

## 5. 审计导出

JSON 导出：

```bash
GET /api/manage/audit-logs/export?format=json&domain=orders&start=...
```

CSV 导出：

```bash
GET /api/manage/audit-logs/export?format=csv&domain=orders&severity=high
```

说明：

- 导出始终是过滤后导出
- 不提供整表裸导出
- 导出动作本身会写入审计事件 `audit.export`
- CSV 导出会对危险公式前缀做安全转义

## 6. Outbox 列表与详情

### 6.1 列表接口

`GET /api/manage/outbox`

常用筛选：

- `eventType`
- `consumerName`
- `status`

适用场景：

- 查某类事件是否已经成功写入 outbox
- 查某个 consumer 是否有挂起或失败任务
- 查收货、冲销、通知、Webhook 是否真的发过事件

### 6.2 详情接口

`GET /api/manage/outbox/:eventId`

详情一般用于查看：

- outbox 原始事件
- `outbox_consumer_jobs`
- Webhook 投递尝试记录

对排查很有用的字段：

- `event_type`
- `aggregate_type`
- `aggregate_id`
- `command_id`
- `consumerJobs`
- `webhookAttempts`

## 7. Replay 使用方式

### 7.1 Dry Run

`POST /api/manage/audit-replay/dry-run`

Body：

```json
{
  "scopeType": "event",
  "scopeId": "evt_xxx",
  "consumerName": "notification"
}
```

或：

```json
{
  "scopeType": "command",
  "scopeId": "cmd_xxx"
}
```

作用：

- 只预演本次会命中哪些事件
- 返回会重放哪些 consumer
- 不真正执行 consumer

推荐在所有正式 replay 前先执行一次。

### 7.2 Execute

`POST /api/manage/audit-replay/execute`

和 dry-run 使用同样的 `scopeType` / `scopeId` / `consumerName` 参数。

当前支持的 replay consumer：

- `audit`
- `cache`
- `notification`
- `webhook`

限制：

- `execute` 属于高风险操作
- 仅管理员可执行
- 它用于重驱动副作用，不用于重写主业务事实

## 8. 典型排障场景

### 8.1 订单创建成功，但管理员没有收到通知

排查顺序：

1. 查审计里是否有 `order.create`
2. 查 `/api/manage/outbox` 是否存在 `order_created_by_sales` 或 `order_created_by_admin`
3. 查该事件详情里的 `notification` consumer job 状态
4. 如事件存在但消费者未成功，先做 dry-run，再按需 replay `notification`

### 8.2 采购收货成功，但前端列表没刷新

排查顺序：

1. 查是否存在 `purchase_receipt_recorded`
2. 查是否存在 `order_procurement_progressed`
3. 查对应 `cache` consumer job
4. 必要时 replay `cache`

### 8.3 Webhook 漏发

排查顺序：

1. 查 outbox 事件详情
2. 查 `webhookAttempts`
3. 判断是未入队、未消费还是消费失败
4. 先 dry-run，再 replay `webhook`

如果只是验证订阅地址是否可达，可先用：

- `POST /api/manage/webhooks/:id/test`

它会直接发送 `webhook.test`，不依赖业务事件触发。

## 9. 失败写操作与权限拒绝

### 权限拒绝

重点关注：

- `result=denied`
- `severity=high`
- 高频重复的 `actorId`

### 失败写操作

重点关注：

- `result=failed`
- 同一 `action` 短时间内重复出现
- `metadata_json` / `changes_json` 的状态或约束线索

常见根因：

- 权限问题
- 状态机冲突
- 库存不足
- 幂等键重复
- 外部副作用消费者失败

## 10. 来源可信度与访问留痕

- `source_app` 仅从服务端认证上下文推断
- `ip_address` 默认使用 `CF-Connecting-IP`
- `request_id` 默认使用 `CF-Ray`

访问留痕：

- `GET /api/manage/audit-logs` 会写 `audit.read`
- `GET /api/manage/audit-logs/actions` 会写 `audit.actions.read`
- `GET /api/manage/audit-logs/export` 会写 `audit.export`
- replay 动作会写 `outbox.replay.dry_run` / `outbox.replay.execute`

## 11. 标准本地回归

对 outbox / Webhook / 通知整体链路做本地验收时，推荐直接跑：

```bash
pnpm dev:all
pnpm test:real-api:full-chain
```

这套命令会覆盖：

- outbox 驱动的通知物化
- 采购收货与冲销后的 Webhook 投递
- 订单行履约命令触发的缓存刷新链路
- 文件、商品、订单、采购、通知、Webhook 的真实串联

## 12. 与排除路由的关系

部分非变更型 POST 接口不进入主操作审计台账，例如：

- AI chat / stream / report
- hash 预检查
- 影响预览类接口

排除项统一登记在：

- `functions/lib/hono/_shared/audit-route-exclusions.js`

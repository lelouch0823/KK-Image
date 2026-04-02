# Outbox 运维页面教程

- 页面路由：`/admin/outbox-ops`
- 典型权限：查看 `audit:read`，执行 replay 还需要管理员身份

![Outbox 运维](../../assets/admin-manual/13-outbox-ops.png)

## 页面用途

Outbox 运维页用于排查副作用链路，而不是重写主业务事实。

当前页面分两块：

- 左侧事件列表
- 右侧重放工作台

## 页面里可以做什么

- 按事件类型过滤
- 按消费者名称过滤
- 按状态过滤
- 选择某条 outbox 事件查看详情
- 只对指定 consumer 做 dry-run
- 执行 replay
- 查看最近一次 replay 结果

## 推荐使用顺序

1. 先筛到具体事件。
2. 点选事件进入右侧工作台。
3. 先做 `Dry Run`。
4. 确认命中范围正确后，再决定是否 `执行 Replay`。

## 常见排查

### 主业务成功，但通知没发

先在这里找对应事件和 `notification` consumer，再决定是否 replay。

### Webhook 漏发

先选中事件查看详情，再确认是否只重放 `webhook` consumer。

### 按了执行但权限不足

当前 `execute` 不只是 `audit:read`，还要求管理员身份。

## 深入阅读

- [审计与 Outbox 运维手册](../audit-operations.md)
- [审计日志](audit-logs.md)

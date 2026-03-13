# 审计告警与升级钩子

本文档定义统一操作审计在高风险场景下的告警建议，作为后续自动化告警实现的基线。

## 告警目标

审计系统不只用于回看，还应尽早暴露高风险模式：

- 重复权限拒绝
- 高频失败写操作
- 高风险批量删除
- 关键配置或权限模型变更
- 审计导出

## 推荐告警事件

### 权限拒绝洪峰

匹配条件：

- `result = denied`
- 同一 `actorId`
- 10 分钟内超过阈值

建议阈值：

- `high`：10 次
- `critical`：30 次

### 失败写操作洪峰

匹配条件：

- `result = failed`
- 同一 `action`
- 同一 `targetType` 或同一业务域

建议阈值：

- 5 分钟内 5 次以上

### 批量删除与清空类操作

匹配条件：

- `action` 包含 `batch_delete` / `delete` / `empty`
- `severity = high | critical`

建议：

- 默认立即记录告警事件
- 可附加目标数量、操作者、业务域摘要

### 审计导出

匹配条件：

- `action = audit.export`

建议：

- 默认记录到审计运维频道
- 导出条数较大时提升等级

## 推荐落地点

- Sentry breadcrumb / event
- Telegram / 企业 IM 机器人
- 后续外部告警系统或 SIEM

## 最小实现建议

1. 先从 `audit.export` 和 `critical delete` 做同步告警
2. 再为 `denied` / `failed` 做滑窗聚合告警
3. 最后再接外部平台

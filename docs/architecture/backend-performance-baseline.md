# 后端性能基线

更新时间：2026-04-17

本文用于固定当前后端性能优化的观测口径。它不是压测报告，也不替代 Cloudflare Analytics、D1 `EXPLAIN QUERY PLAN` 或线上真实流量采样。

## 目标

- 固定热点路径与查询 label，避免后续优化前后口径漂移
- 为 stats / dashboard / goods overview / outbox / webhook / reminders 建立统一采样模板
- 让后续继续优化时，可以直接复用同一组命令与记录格式

## 基线采集脚本

```bash
node scripts/perf/collect-backend-baseline.mjs
```

脚本会输出：

- 当前热点文件中显式声明的查询 label
- 推荐的采样命令
- 统一的基线记录模板

## 推荐采样命令

```bash
pnpm test:unit:run functions/lib/db/__tests__/query-observability.test.js
pnpm test:unit:run functions/lib/hono/routes/manage/__tests__/stats-routes.test.js functions/lib/hono/routes/manage/__tests__/dashboard-routes.test.js functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js
pnpm test:unit:run functions/api/cron/__tests__/outbox.test.js functions/api/cron/__tests__/reminders.test.js functions/services/__tests__/WebhookDeliveryService.test.js
pnpm build
```

如果要补真实链路基线，再在本地 Worker 健康启动后运行：

```bash
pnpm test:real-api
```

## 建议记录字段

### 管理端统计

- `/api/manage/stats`
- `/api/manage/dashboard/overview`
- 记录：duration、rowsRead、rowsWritten、cache hit/miss、投影更新时间

### Goods Overview

- `/api/manage/goods-overview`
- `/api/manage/goods-overview/summary`
- 记录：duration、rowsRead、返回条数、筛选条件、是否命中 snapshot projection

### Outbox

- `/api/cron/outbox`
- 记录：claimed、published、failed、backlog、rounds、consumer 分布、invalidated URL 数

### Webhook

- `WebhookDeliveryService.deliverDomainEvent()`
- 记录：endpoint 数、批量 delivery state 查询次数、成功数、retryable 数、terminal 数

### Reminders

- `/api/cron/reminders`
- 记录：pending 数、approaching deadline 数、生成事件数、命中幂等 key 数

## 当前关注热点

- 管理端统计与仪表盘：已切到投影读取，需要继续观察投影刷新频率与响应稳定性
- goods overview：已切到 `variant_snapshot_projection`，后续主要看筛选/导出链路是否还存在额外回扫
- outbox：当前已有 runtime lease 和按需调度，后续主要看 cache invalidation fan-out 规模
- public share：本轮已把 gallery 文件 URL 改为分享级短期 token，后续看是否需要继续分页或首屏裁剪
- `withCache()`：默认不再做 body-hash，后续只在少数小响应上按需开启

## 使用约束

- 采样时必须记录具体 commit 与命令
- 默认优先使用 `pnpm test` 证明回归稳定，再补针对性基线命令
- 如果是 public / webhook / uploads 这类带外部 I/O 的路径，不要把本地空载测试当成真实容量结论

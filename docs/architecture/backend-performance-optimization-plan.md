# Backend Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变当前业务语义的前提下，系统性降低管理端统计聚合、goods overview、outbox 副作用和 public 分享路径的后端性能成本。

**Architecture:** 方案以“请求时重聚合”迁移到“投影读模型 + 批处理副作用 + 更窄缓存失效”为核心。优先把高频读接口和后台 fan-out 路径中的重复 D1 计算移出在线请求，再逐步优化 Webhook、public 分享与通用缓存策略。

**Tech Stack:** Cloudflare Pages Functions、Hono、Cloudflare D1、R2、Cache API、durable outbox、Vitest

---

## 输入文档

- 审查结论：`docs/architecture/backend-performance-optimization-review.md`

## 分阶段策略

- Phase 1：补基线观测与低风险结构铺垫
- Phase 2：统计与 goods overview 投影化
- Phase 3：outbox / cache / webhook 背景负载优化
- Phase 4：public 分享与缓存细节优化

## 文件规划

预计会创建或修改的关键文件如下：

- Create: `migrations/0076_system_stats_projection.sql`
- Create: `migrations/0077_variant_snapshot_projection.sql`
- Create: `migrations/0078_webhook_event_subscriptions.sql`
- Create: `functions/repositories/SystemStatsProjectionRepository.js`
- Create: `functions/repositories/VariantSnapshotProjectionRepository.js`
- Create: `functions/services/SystemStatsProjectionRefreshService.js`
- Create: `functions/services/VariantSnapshotProjectionRefreshService.js`
- Create: `functions/services/WebhookSubscriptionService.js`
- Create: `functions/services/__tests__/SystemStatsProjectionRefreshService.test.js`
- Create: `functions/services/__tests__/VariantSnapshotProjectionRefreshService.test.js`
- Create: `functions/services/__tests__/WebhookSubscriptionService.test.js`
- Modify: `functions/repositories/StatsRepository.js`
- Modify: `functions/repositories/OrderStatsRepository.js`
- Modify: `functions/repositories/GoodsOverviewRepository.js`
- Modify: `functions/repositories/WebhookRepository.js`
- Modify: `functions/services/DomainOutboxConsumers.js`
- Modify: `functions/services/WebhookDeliveryService.js`
- Modify: `functions/api/cron/outbox.js`
- Modify: `functions/api/cron/reminders.js`
- Modify: `functions/lib/hono/_shared/domain-outbox.js`
- Modify: `functions/lib/hono/_shared/route-helpers.js`
- Modify: `functions/lib/hono/middleware/cache.js`
- Modify: `functions/api/gallery/[token].js`
- Modify: `functions/lib/hono/routes/manage/stats.js`
- Modify: `functions/lib/hono/routes/manage/dashboard.js`
- Modify: `functions/lib/hono/routes/manage/goods-overview.js`
- Test: `functions/repositories/__tests__/*`
- Test: `functions/services/__tests__/*`
- Test: `functions/lib/hono/routes/manage/__tests__/*`

### Task 1: 建立性能基线与观测口径

**Files:**

- Modify: `functions/lib/db/query.js`
- Modify: `functions/api/cron/outbox.js`
- Create: `scripts/perf/collect-backend-baseline.mjs`
- Create: `docs/architecture/backend-performance-baseline.md`
- Test: `functions/lib/db/__tests__/query-observability.test.js`

- [ ] **Step 1: 为热点查询补统一标签和性能采样输出**

目标：

- 保证统计、goods overview、outbox、webhook 路径都能输出稳定 label
- 让后续优化有可对比基线

- [ ] **Step 2: 新增基线采集脚本**

Run:

```bash
node scripts/perf/collect-backend-baseline.mjs
```

Expected:

- 输出热点接口与后台任务的采样结果模板

- [ ] **Step 3: 补充观测测试**

Run:

```bash
pnpm test:unit:run functions/lib/db/__tests__/query-observability.test.js
```

Expected:

- PASS

### Task 2: 将系统统计与仪表盘迁移到投影读模型

**Files:**

- Create: `migrations/0076_system_stats_projection.sql`
- Create: `functions/repositories/SystemStatsProjectionRepository.js`
- Create: `functions/services/SystemStatsProjectionRefreshService.js`
- Create: `functions/services/__tests__/SystemStatsProjectionRefreshService.test.js`
- Modify: `functions/repositories/StatsRepository.js`
- Modify: `functions/repositories/OrderStatsRepository.js`
- Modify: `functions/lib/hono/routes/manage/stats.js`
- Modify: `functions/lib/hono/routes/manage/dashboard.js`
- Modify: `functions/services/DomainOutboxConsumers.js`

- [ ] **Step 1: 设计系统统计投影表**

表建议包含：

- 全局文件数、总容量、今日上传数
- 文件状态分布、类型分布
- 订单今日/本周/本月计数
- 仪表盘趋势快照更新时间

- [ ] **Step 2: 先写刷新服务测试**

Run:

```bash
pnpm test:unit:run functions/services/__tests__/SystemStatsProjectionRefreshService.test.js
```

Expected:

- FAIL，提示刷新服务或字段尚未实现

- [ ] **Step 3: 实现投影刷新服务与仓储**

要求：

- 支持全量初始化
- 支持按事件类型增量刷新
- 输出统一 `updated_at`

- [ ] **Step 4: 将 stats/dashboard 路由切到投影读取**

要求：

- 保持响应结构不变
- 查询不再直接依赖多组 `COUNT/GROUP BY`

- [ ] **Step 5: 运行针对性测试**

Run:

```bash
pnpm test:unit:run functions/services/__tests__/SystemStatsProjectionRefreshService.test.js functions/lib/hono/routes/manage/__tests__/order-list-routes.test.js
```

Expected:

- PASS

### Task 3: 将 goods overview 的快照维度物化

**Files:**

- Create: `migrations/0077_variant_snapshot_projection.sql`
- Create: `functions/repositories/VariantSnapshotProjectionRepository.js`
- Create: `functions/services/VariantSnapshotProjectionRefreshService.js`
- Create: `functions/services/__tests__/VariantSnapshotProjectionRefreshService.test.js`
- Modify: `functions/repositories/GoodsOverviewRepository.js`
- Modify: `functions/lib/hono/routes/manage/goods-overview.js`
- Modify: `functions/services/DomainOutboxConsumers.js`

- [ ] **Step 1: 为变体快照维度设计投影表**

表建议包含：

- `variant_id`
- `product_id`
- `snapshot_name`
- `snapshot_sku`
- `snapshot_brand`
- `snapshot_category`
- `snapshot_specs`
- `snapshot_image`
- `updated_at`

- [ ] **Step 2: 先写 failing test 覆盖品牌/分类/快照回填**

Run:

```bash
pnpm test:unit:run functions/services/__tests__/VariantSnapshotProjectionRefreshService.test.js
```

Expected:

- FAIL

- [ ] **Step 3: 实现刷新服务，并在 goods overview 改读投影**

要求：

- `GoodsOverviewRepository.getList()`
- `GoodsOverviewRepository.getAvailableFilters()`
- `GoodsOverviewRepository.getSummary()`

都不再回扫 `orders + order_lines + json_extract(...)`

- [ ] **Step 4: 跑 goods overview 测试**

Run:

```bash
pnpm test:unit:run functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js functions/lib/hono/routes/manage/__tests__/goods-overview-routes.test.js
```

Expected:

- PASS

### Task 4: 优化 outbox 缓存失效链路

**Files:**

- Modify: `functions/services/DomainOutboxConsumers.js`
- Modify: `functions/lib/hono/_shared/route-helpers.js`
- Modify: `functions/api/cron/outbox.js`
- Test: `functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js`
- Test: `functions/services/__tests__/DomainOutboxDispatchService.test.js`

- [ ] **Step 1: 在单次 poller 生命周期内加入 token 查询 memoization**

要求：

- 同一批事件内避免重复查询全部销售 token
- 单 sales token 查询按 salespersonId 去重

- [ ] **Step 2: 聚合 cache invalidation URL**

要求：

- 同一批事件合并重复 URL
- 减少 `cache.delete` 次数

- [ ] **Step 3: 为 outbox poller 增加批次统计**

输出项建议：

- claim 数
- published 数
- failed 数
- invalidated URL 数

- [ ] **Step 4: 跑 consumer 与 dispatch 测试**

Run:

```bash
pnpm test:unit:run functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js functions/services/__tests__/DomainOutboxDispatchService.test.js
```

Expected:

- PASS

### Task 5: 重构 Webhook 订阅与投递前置查询

**Files:**

- Create: `migrations/0078_webhook_event_subscriptions.sql`
- Create: `functions/services/WebhookSubscriptionService.js`
- Create: `functions/services/__tests__/WebhookSubscriptionService.test.js`
- Modify: `functions/repositories/WebhookRepository.js`
- Modify: `functions/services/WebhookDeliveryService.js`
- Test: `functions/services/__tests__/WebhookDeliveryService.test.js`
- Test: `functions/repositories/__tests__/WebhookRepository.test.js`

- [ ] **Step 1: 建立 `webhook_event_subscriptions` 表和索引**

要求：

- 一个 webhook 对多个 event
- 支持启停同步

- [ ] **Step 2: Repository 改为按订阅表读取启用端点**

要求：

- 移除 `events LIKE ?`
- 兼容现有管理接口返回结构

- [ ] **Step 3: 合并投递前置查询**

要求：

- 将“是否已成功投递”和“最新 attempt”尽量合并成一次数据预取
- 保持 `delivery_key` 语义不变

- [ ] **Step 4: 跑 webhook 相关测试**

Run:

```bash
pnpm test:unit:run functions/repositories/__tests__/WebhookRepository.test.js functions/services/__tests__/WebhookDeliveryService.test.js functions/services/__tests__/WebhookSubscriptionService.test.js
```

Expected:

- PASS

### Task 6: 调整 outbox 调度策略，避免每写必拉 poller

**Files:**

- Modify: `functions/lib/hono/_shared/domain-outbox.js`
- Modify: `functions/api/cron/outbox.js`
- Modify: `functions/services/DomainOutboxDispatchService.js`
- Test: `functions/services/__tests__/DomainOutboxDispatchService.test.js`

- [ ] **Step 1: 定义请求侧 publish 与消费侧调度边界**

要求：

- 请求侧默认只 publish
- 当 backlog 超阈值或显式需要时才主动调度 poller

- [ ] **Step 2: 调整 poller claim 策略**

要求：

- 支持更大的批次窗口
- 保持 lease 语义不变

- [ ] **Step 3: 回归 outbox 测试**

Run:

```bash
pnpm test:unit:run functions/services/__tests__/DomainOutboxDispatchService.test.js functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js
```

Expected:

- PASS

### Task 7: 优化 reminders 幂等检查与 deadline 存储

**Files:**

- Create: `migrations/0079_orders_deadline_sidecar.sql`
- Modify: `functions/api/cron/reminders.js`
- Modify: `functions/repositories/order/mutations.js`
- Modify: `functions/repositories/order/queries.js`
- Test: `functions/api/cron/__tests__/reminders.test.js`

- [ ] **Step 1: 新增 deadline sidecar 字段或 sidecar 表**

建议：

- 优先使用 `orders.deadline_date`
- 补 `(status, deadline_date)` 索引

- [ ] **Step 2: 改造 reminders 的幂等检查为批量**

要求：

- 先批量取已有 key
- 再只为缺失 key 生成事件

- [ ] **Step 3: reminders 查询改为直接过滤索引字段**

- [ ] **Step 4: 跑 reminders 测试**

Run:

```bash
pnpm test:unit:run functions/api/cron/__tests__/reminders.test.js
```

Expected:

- PASS

### Task 8: 优化通用缓存中间件与公开画廊路径

**Files:**

- Modify: `functions/lib/hono/middleware/cache.js`
- Modify: `functions/api/gallery/[token].js`
- Test: `functions/api/gallery/__tests__/public-gallery-access.test.js`
- Test: `functions/lib/hono/middleware/__tests__/cache.test.js`

- [ ] **Step 1: 为 `withCache()` 增加轻量 ETag 模式**

要求：

- 默认不再强制读取完整 body 做哈希
- 支持通过 options 显式启用 body-hash

- [ ] **Step 2: 优化 gallery 首屏查询与文件签名策略**

候选方向：

- 限制返回字段
- 限制首屏文件数
- 引入分享级短期 token

- [ ] **Step 3: 跑 cache/gallery 测试**

Run:

```bash
pnpm test:unit:run functions/lib/hono/middleware/__tests__/cache.test.js functions/api/gallery/__tests__/public-gallery-access.test.js
```

Expected:

- PASS

## 集成验证

- [ ] **Step 1: 跑默认仓库测试**

Run:

```bash
pnpm test
```

Expected:

- PASS

- [ ] **Step 2: 跑真实链路回归**

Run:

```bash
pnpm build
pnpm test:real-api
```

Expected:

- `pnpm build` PASS
- `pnpm test:real-api` PASS，重点覆盖 products / notifications / uploads / webhooks

- [ ] **Step 3: 记录优化前后基线对比**

输出至少包含：

- 管理端统计接口耗时
- goods overview 接口耗时
- 单事件 cache invalidation 的 D1 查询数
- 单事件 webhook 投递前查询数
- reminders 单轮执行查询数

## 里程碑与交付标准

### Milestone 1

- stats / dashboard 已改为投影读取
- goods overview 不再回扫订单快照 JSON

### Milestone 2

- outbox cache invalidation 重复查询明显下降
- webhook 订阅已关系化
- webhook 投递前查询减少

### Milestone 3

- reminders 已改为批量幂等检查
- deadline 已具备索引能力
- public gallery 与通用 cache 已完成轻量化优化

## 风险控制

- 所有投影改造都必须保持现有 API 响应兼容
- 先做读模型旁路，再切换主路径，避免一次性替换
- Webhook 改造优先保证去重和投递正确性，不以吞吐换数据不一致
- public 分享优化不能削弱现有访问控制语义

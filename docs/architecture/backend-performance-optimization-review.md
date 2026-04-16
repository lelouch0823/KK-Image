# 后端性能优化审查

审查日期：2026-04-16

适用范围：

- `functions/lib/hono/*`
- `functions/repositories/*`
- `functions/services/*`
- `functions/api/cron/*`
- `functions/api/gallery/[token].js`

审查方法：

- 以当前仓库代码做静态审查
- 结合路由热度、D1 查询模式、缓存失效模式、外部 I/O 路径判断收益
- 本文不代表压测结论；未执行线上流量采样、`EXPLAIN QUERY PLAN`、Cloudflare Analytics 对照

## 结论摘要

当前后端最明显的性能瓶颈，不在单一慢函数，而在三类路径叠加：

1. 在线读接口仍在请求时做大量聚合与 JSON 提取
2. durable outbox 的副作用消费存在缓存失效和 Webhook 的额外放大
3. 少量 public / cron 路由仍保留“大结果集 + 逐项处理”的模式

按收益高低排序，当前最值得优先投入的 10 个优化点如下。

## Top 10 优化点

| 排名 | 优化点 | 预估收益 | 主要受影响路径 |
| --- | --- | --- | --- |
| 1 | 将统计与仪表盘接口改为投影读模型 | 极高 | `/api/manage/stats`、`/api/manage/dashboard/overview` |
| 2 | 将 `goods-overview` 的快照维度改为物化数据 | 极高 | `/api/manage/goods-overview*` |
| 3 | 收缩 outbox 缓存失效 fan-out | 高 | `cache` consumer、订单/商品/空间相关写接口 |
| 4 | 规范化 Webhook 事件订阅表 | 高 | `webhook` consumer、Webhook 管理接口 |
| 5 | 合并 Webhook 投递前置查询 | 高 | `WebhookDeliveryService` |
| 6 | 降低每次业务写入即拉起 outbox poller 的频率 | 高 | 所有发布领域事件的写接口 |
| 7 | 将 reminders 的幂等检查改为批量模式 | 中高 | `/api/cron/reminders` |
| 8 | 把订单 deadline 从 JSON 中抽离为可索引字段 | 中高 | reminders、后续订单筛选/提醒 |
| 9 | 降低通用缓存中间件的 ETag 计算成本 | 中 | 所有使用 `withCache()` 的 GET 接口 |
| 10 | 优化公开画廊的大文件夹加载与逐文件签名 | 中 | `/api/gallery/:token` |

## 详细审查结果

### 1. 将统计与仪表盘接口改为投影读模型

收益判断：

- 高频管理端读接口
- 每次请求触发多组 `COUNT(*)`、`SUM()`、`GROUP BY`
- 当前 TTL 只有 20-60 秒，无法真正掩盖聚合成本

核心证据：

- `functions/repositories/StatsRepository.js`
- `functions/repositories/OrderStatsRepository.js`
- `functions/lib/hono/routes/manage/stats.js`
- `functions/lib/hono/routes/manage/dashboard.js`

典型问题：

- `StatsRepository.getGlobalStats()` 在一次请求中并发统计文件总数、体积、状态分布、类型分布、空间访问趋势
- `OrderStatsRepository.getAdminStats()` 和 dashboard overview 继续叠加多组订单统计
- 同一批统计数据在多个接口中重复计算

建议方向：

- 新增系统统计投影表，如 `system_stats_projection`、`dashboard_overview_projection`
- 由 outbox / cron 增量刷新，而不是请求时聚合
- 将“今日、本周、30 天趋势、状态分布”拆成明确读模型

### 2. 将 `goods-overview` 的快照维度改为物化数据

收益判断：

- 当前查询复杂度最高
- 订单、采购、库存三块数据在读请求里临时拼接
- 列表、筛选、汇总会重复重建同一份快照聚合

核心证据：

- `functions/repositories/GoodsOverviewRepository.js`
- `functions/lib/hono/routes/manage/goods-overview.js`

典型问题：

- `SNAPSHOT_JOIN_SQL` 先对 `order_lines + orders` 做 `GROUP BY variant_id`
- 大量 `json_extract(...)` 用于品牌、分类、快照信息回填
- `getList()`、`getAvailableFilters()`、`getSummary()` 三条路径都依赖同一类高成本聚合

建议方向：

- 将品牌、分类、快照 SKU、快照图、快照规格并入 `variant_demand_projection`，或新增 `variant_snapshot_projection`
- goods overview 路由只读投影，不再回扫 `orders` / `order_lines`

### 3. 收缩 outbox 缓存失效 fan-out

收益判断：

- 所有写路径都会经过
- 当前消费侧容易把“单个实体更新”放大成“多组 token 查询 + 多 URL 删除”
- 事件量上来后会放大为稳定背景负载

核心证据：

- `functions/services/DomainOutboxConsumers.js`
- `functions/lib/hono/_shared/route-helpers.js`

典型问题：

- 多个分支反复调用 `getSalespersonAccessTokens()` / `getAllSalespersonAccessTokens()`
- 同一个 poller 周期内，相近事件会重复拼装和删除相同 cache URL
- 部分事件使用“全量销售 token”级别失效，过宽

建议方向：

- 在单次 poller 执行内引入 token 查询 memoization
- 先聚合待删 URL，再按 consumer / aggregate 批量失效
- 逐步把“按 token 删除”收缩到“按版本号或实体 ETag 变更”

### 4. 规范化 Webhook 事件订阅表

收益判断：

- Webhook 数量增长后，当前匹配方式退化明显
- 这是典型“能工作，但扩展性差”的表结构问题

核心证据：

- `functions/repositories/WebhookRepository.js`

典型问题：

- `listActiveByEvent()` 依赖 `events LIKE ?`
- 命中后还要在 JS 层再次过滤 `row.events.includes(eventType)`
- 订阅列表实际上是一个关系型映射，却被存在 JSON 字符串里

建议方向：

- 新增 `webhook_event_subscriptions(webhook_id, event_type)`
- 创建 `(event_type, webhook_id)` 索引
- Webhook 配置保存时同步维护订阅表

### 5. 合并 Webhook 投递前置查询

收益判断：

- 每个 endpoint 当前至少做两次投递前查询
- endpoint 数量增加后，D1 探测成本线性放大

核心证据：

- `functions/services/WebhookDeliveryService.js`
- `functions/repositories/WebhookRepository.js`
- `migrations/0057_webhook_delivery_tracing.sql`

典型问题：

- 先查 `hasSuccessfulDelivery()`
- 再查 `getLatestAttempt()`
- 然后才真正发出网络请求

建议方向：

- 以 `delivery_key` 为中心批量预取状态
- 或改为一次查询同时返回“是否成功过 + 最新 attempt_number”
- 更进一步可通过唯一键或 UPSERT 模式减少探测查询

### 6. 降低每次业务写入即拉起 outbox poller 的频率

收益判断：

- 几乎所有重要写接口都会命中
- 在低事件量时尚可；在连续写入时会造成大量短命 poller 重叠运行

核心证据：

- `functions/lib/hono/_shared/domain-outbox.js`
- `functions/api/cron/outbox.js`

典型问题：

- 每次发布领域事件后都 `waitUntil(runOutboxPoller(...))`
- poller 内部仍按 consumer 顺序 claim
- 单轮 claim 上限固定，吞吐和调度都不够平滑

建议方向：

- 请求侧只负责 publish
- 消费改为定时批量拉起，或做“有 backlog 时才调度”
- poller 层补充 backlog 指标和批处理窗口

### 7. 将 reminders 的幂等检查改为批量模式

收益判断：

- cron 周期执行，结果集一大就有 N 次额外查询
- 逻辑简单，改造收益高、风险低

核心证据：

- `functions/api/cron/reminders.js`

典型问题：

- `reminderAlreadyEnqueued()` 是逐条 `SELECT 1`
- pending 订单循环、deadline 订单循环里都存在“每条订单一次幂等查询”

建议方向：

- 预先生成一批 idempotency key 后统一查询已存在集合
- 或依赖 outbox 唯一约束做 `INSERT OR IGNORE` 风格落库

### 8. 把订单 deadline 从 JSON 中抽离为可索引字段

收益判断：

- 不只影响 reminders
- 后续凡是要做截止日期筛选、统计、提醒，都会受益

核心证据：

- `functions/api/cron/reminders.js`

典型问题：

- 使用 `json_extract(current_data, '$.deadline') BETWEEN ? AND ?`
- JSON 内范围查询无法得到稳定高效的索引支持

建议方向：

- 新增 `orders.deadline_date` 或 sidecar 表
- 补 `(status, deadline_date)` 索引
- 创建/更新订单时同步维护

### 9. 降低通用缓存中间件的 ETag 计算成本

收益判断：

- 命中面广
- 现在所有 cache miss 都会额外读完整 body 并做哈希

核心证据：

- `functions/lib/hono/middleware/cache.js`

典型问题：

- `response.clone().text()` 会把响应完整读入内存
- 再执行 `sha256Hex(bodyText)`
- 对大 JSON 列表响应尤其不划算

建议方向：

- 默认改为 TTL cache
- 仅在少数稳定小响应上保留 body-hash ETag
- 其余路由改用 `updated_at` / projection version 生成弱 ETag

### 10. 优化公开画廊的大文件夹加载与逐文件签名

收益判断：

- public 路由直接面向外部访问
- 大文件夹下 CPU 和 DB 负担都偏重

核心证据：

- `functions/api/gallery/[token].js`

典型问题：

- 一次性读取分享文件夹下全部文件
- 子文件夹计数使用相关子查询
- 返回前对每个文件单独生成 scoped token

建议方向：

- 列表分页或至少限制首屏返回量
- 子文件夹文件数改为预聚合或缓存
- 引入 share-scope 级短期 token，避免逐文件签名

## 候补优化点

以下点位也值得做，但收益暂时低于 Top 10：

### A. 备份流程避免全量数据驻留内存

核心证据：

- `functions/api/utils/backup-utils.js`

问题：

- 当前备份会把所有表、所有行先装入内存，再整体压缩上传

建议方向：

- 拆分为表级分块备份
- 追加 manifest
- 允许大表单独压缩上传

### B. 上传路径可继续压缩数据库往返次数

核心证据：

- `functions/lib/hono/routes/manage/upload.js`

问题：

- 上传后若绑定 `spaceId`，还会额外查询最大排序号、插入关联、更新空间时间

建议方向：

- 将排序号生成和空间更新时间维护收敛为批量 helper
- 降低上传高峰期的额外 D1 往返

## 推荐实施顺序

建议按下面四个波次推进：

1. 先做低风险高收益的数据面优化
   - Top 1
   - Top 2
   - Top 7
   - Top 8
2. 再做 outbox 背景负载压缩
   - Top 3
   - Top 6
3. 再做 webhook 子系统重构
   - Top 4
   - Top 5
4. 最后做响应层与 public 路由优化
   - Top 9
   - Top 10

## 验证建议

正式动手前，建议补齐以下基线：

- 关键接口 P50 / P95 / P99 延迟
- D1 `rows_read` / `rows_written`
- outbox backlog、claim 数、failed 数
- webhook 每事件的 D1 查询数与总投递耗时
- public share 大文件夹样本的响应体大小与 token 生成耗时

配套开发计划见：

- `docs/architecture/backend-performance-optimization-plan.md`

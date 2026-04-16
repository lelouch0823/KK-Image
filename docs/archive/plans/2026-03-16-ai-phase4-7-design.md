# AI Phase 4-7 Design

**Context**

Phase 1-3 已完成：请求上下文、取消链路、工具编排和 reliability policy stack 都已落地，并且当前 `pnpm test:unit` 基线已恢复全绿。下一步要完成 V2 剩余部分：治理配额、持久化可观测性、安全策略执行和 rollout/evaluation。

**Goal**

在不破坏当前 Cloudflare Workers + Hono AI 接口契约的前提下，补齐 Phase 4-7，使 AI 路由具备：

- AI 专用配额治理
- 持久化 trace/span/usage
- 输入与工具输出安全策略执行
- rollout flag 和 regression fixtures

## 1. Recommended Execution Order

推荐顺序：

1. Phase 4 `AI Governance and Quotas`
2. Phase 5 `Observability V2`
3. Phase 6 `Safety Enforcement Layer`
4. Phase 7 `Evaluation and Progressive Rollout`

原因：

- 先治理请求和成本，才能避免后面观测与安全是在无约束流量上事后记录
- 先建立持久化 trace，再补安全与 rollout，后续每个 block/degrade/flag 都能被查询
- 最后再做 rollout 和 regression，才能基于真实 quota / trace / safety 结果建立验证闭环

## 2. Architecture Boundaries

### Phase 4: AI Governance and Quotas

新增模块：

- `functions/ai/rate-limit-manager.js`
- `functions/lib/hono/middleware/ai-rate-limit.js`

扩展模块：

- `functions/ai/config-schema.js`
- `functions/ai/config-manager.js`
- `functions/lib/hono/routes/manage/ai.js`
- `wrangler.toml`

边界：

- Hono middleware 负责请求放行/拒绝，不把 quota 逻辑写进 route body
- KV 负责边缘快速计数
- request telemetry 记录 `quotaDecision`
- 响应头暴露 request/token 预算

### Phase 5: Observability V2

新增模块：

- `functions/ai/telemetry-writer.js`

扩展模块：

- `functions/ai/telemetry.js`
- `functions/ai/request-context.js`
- `functions/ai/stream-engine.js`
- `functions/utils/ai-utils.js`
- `functions/lib/hono/routes/manage/ai.js`
- 新 D1 migration

新增表：

- `ai_request_traces`
- `ai_request_spans`
- `ai_request_usage_daily`

边界：

- `telemetry.js` 只负责 payload builder
- `telemetry-writer.js` 只负责落库
- 路由和 AI service 在关键边界发 span，而不是直接拼 SQL

### Phase 6: Safety Enforcement Layer

新增模块：

- `functions/ai/input-validator.js`
- `functions/ai/data-masker.js`
- `functions/ai/log-safe-serializer.js`

扩展模块：

- `functions/ai/conversation-service.js`
- `functions/ai/stream-engine.js`
- `functions/lib/hono/routes/manage/ai.js`

边界：

- provider 调用前先做 input/image 预算校验
- tool output 返回前先做 redaction / size budget
- log/trace 统一只接受 log-safe serializer 的结果

### Phase 7: Evaluation and Progressive Rollout

新增模块：

- `functions/ai/__tests__/fixtures/*.json`
- `functions/ai/__tests__/ai-regression.test.js`

扩展模块：

- `functions/ai/config-schema.js`
- `functions/ai/config-manager.js`
- `functions/lib/hono/routes/manage/ai.js`

边界：

- rollout 先只走 config + runtime flag，不做 UI
- regression fixture 锁住关键请求路径
- 新行为默认 behind flag

## 3. Data Model Strategy

### KV

只存短周期、快速判定数据：

- per-user requests/minute
- per-user estimated tokens/day counters
- image-bearing request counters

设计原则：

- key 简单可预测
- TTL 对齐窗口
- 不做复杂查询

### D1

只存查询型数据：

- request trace summary
- span timeline
- daily usage aggregation

设计原则：

- request trace 记录单次请求摘要
- span 记录 provider/tool/retry/quota/safety 事件
- usage daily 记录 user + day 聚合结果

### No Durable Object Yet

本阶段不引入 Durable Object。

原因：

- 当前治理目标是边缘快速拦截和可查询 trace，KV + D1 足够
- 只有当后续发现 KV 在强一致预算上误差不可接受，才升级到 Durable Object

## 4. Request Flow

目标请求流：

```text
AI Route
  -> ai-rate-limit middleware
  -> request-context builder
  -> conversation preparation
  -> input validator
  -> provider / stream-engine / tool-orchestrator
  -> telemetry writer
```

具体语义：

- quota middleware 在最前面快速拒绝
- request context 继续承载 traceId / requestId / signal
- safety validator 在 provider 调用前决定 `allow / allow_with_redaction / block / degrade`
- trace/span 在 quota reject、provider call、tool round、retry、cancel、safety decision、response finish 时写入

## 5. Error Handling Policy

### Quota

- 超出 request/minute 或 token/day：
  - 返回 429
  - body 带结构化 quota 信息
  - headers 带剩余预算
  - telemetry 记录 `quotaDecision: denied`

### Safety

- 文本超长、图片超预算：
  - `block`
- prompt injection 高风险：
  - 优先 `degrade`
  - 禁用 tools/images
  - 必要时 `block`
- tool result 太大或含敏感字段：
  - `allow_with_redaction`

### Observability Failures

- telemetry 落库失败不能阻断主请求
- 必须吞掉异步失败并打印有限日志

## 6. Testing Strategy

每个 Phase 都遵循 TDD：

- 先 unit tests
- 再 route integration tests
- 最后全量回归

重点测试面：

- quota middleware
- rate-limit manager
- telemetry writer
- input validator
- data masker / serializer
- rollout flag behavior
- AI regression fixtures

## 7. Why This Design Is SOTA

这套设计优于“在现有 route 里继续堆逻辑”的原因是：

- 把治理、观测、安全、rollout 从业务实现中解耦成清晰边界
- KV 和 D1 各司其职，不把边缘判定和查询需求混在一起
- 新的 block/degrade/rollout 行为都有 trace 证据，不靠猜测运营
- 保持 Cloudflare Workers + Hono 兼容，不引入当前阶段不必要的基础设施复杂度

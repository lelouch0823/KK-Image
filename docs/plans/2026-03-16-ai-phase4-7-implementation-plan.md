# AI Phase 4-7 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在当前 Cloudflare Workers + Hono AI 运行时上完成 Phase 4-7：AI 专用 quotas、持久化 observability、安全策略执行和 rollout/evaluation，并保持全量单测基线绿色。

**Architecture:** 继续保留现有 AI route 与 service 分层，但把剩余控制面能力拆成独立模块。配额治理走 Hono middleware + KV；trace/span/usage 走 D1 telemetry writer；安全执行走 input validator + masker + serializer；rollout/evaluation 走 config flag + regression fixtures。

**Tech Stack:** Cloudflare Workers, Hono, KV, D1, Vitest, existing AI modules, D1 migrations

---

### Task 1: 为 AI quotas 增加配置 schema 与 rate-limit manager

**Files:**
- Modify: `functions/ai/config-schema.js`
- Create: `functions/ai/rate-limit-manager.js`
- Create: `functions/ai/__tests__/rate-limit-manager.test.js`

**Step 1: Write the failing test**

在 `functions/ai/__tests__/rate-limit-manager.test.js` 中先锁定：

```js
import { describe, expect, it, vi } from 'vitest';
import { createAIRateLimitManager } from '../rate-limit-manager.js';

describe('ai rate limit manager', () => {
  it('allows request under request-per-minute budget and returns remaining counters', async () => {
    const kv = { get: vi.fn().mockResolvedValue(null), put: vi.fn().mockResolvedValue(undefined) };
    const manager = createAIRateLimitManager({ kv, now: () => 1_700_000_000_000 });

    const result = await manager.checkAndConsume({
      userId: 'u-1',
      requestsPerMinute: 3,
      estimatedTokens: 120,
      tokensPerDay: 1000,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining.requests).toBe(2);
    expect(result.remaining.tokens).toBe(880);
  });

  it('rejects request when requests-per-minute budget is exhausted', async () => {
    const kv = {
      get: vi.fn()
        .mockResolvedValueOnce('3')
        .mockResolvedValueOnce('0'),
      put: vi.fn(),
    };
    const manager = createAIRateLimitManager({ kv, now: () => 1_700_000_000_000 });

    const result = await manager.checkAndConsume({
      userId: 'u-1',
      requestsPerMinute: 3,
      estimatedTokens: 10,
      tokensPerDay: 1000,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('rpm_exceeded');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/rate-limit-manager.test.js`

Expected: FAIL，因为模块尚不存在。

**Step 3: Write minimal implementation**

1. 在 `config-schema.js` 增加 AI governance 配置键：
   - `AI_RATE_LIMIT_ENABLED`
   - `AI_RATE_LIMIT_RPM`
   - `AI_RATE_LIMIT_TPD`
   - `AI_RATE_LIMIT_IMAGE_RPM`
2. 在 `rate-limit-manager.js` 实现 KV 窗口计数与 token/day 消耗

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/rate-limit-manager.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/ai/config-schema.js functions/ai/rate-limit-manager.js functions/ai/__tests__/rate-limit-manager.test.js
git commit -m "feat(ai): add rate limit manager and quota config"
```

---

### Task 2: 接入 AI 专用 Hono middleware

**Files:**
- Create: `functions/lib/hono/middleware/ai-rate-limit.js`
- Create: `functions/lib/hono/middleware/__tests__/ai-rate-limit.test.js`
- Modify: `functions/lib/hono/routes/manage/ai.js`
- Modify: `wrangler.toml`

**Step 1: Write the failing test**

在 `functions/lib/hono/middleware/__tests__/ai-rate-limit.test.js` 中锁定：

```js
it('returns 429 with AI quota headers when budget is denied', async () => {
  // 构造 Hono app + mocked rate-limit manager
  // 断言 429、结构化 body、X-AI-RateLimit-* headers
});
```

并在 `ai-routes.test.js` 补一个路由级用例，确认 `/api/manage/ai/stream` 在 middleware 拒绝时不会进入 `callAIStream`。

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/middleware/__tests__/ai-rate-limit.test.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`

Expected: FAIL。

**Step 3: Write minimal implementation**

1. `ai-rate-limit.js`
   - 读取 config snapshot
   - 调 `rate-limit-manager`
   - 放行时写 `X-AI-RateLimit-*` headers
   - 拒绝时返回结构化 429 payload
2. `ai.js`
   - 在 AI routes 上只挂 AI 专用 middleware
3. `wrangler.toml`
   - 为 preview/production 增加 AI 用 KV binding（复用 `KV` 或新增单独 binding，优先单独 binding）

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/middleware/__tests__/ai-rate-limit.test.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/lib/hono/middleware/ai-rate-limit.js functions/lib/hono/middleware/__tests__/ai-rate-limit.test.js functions/lib/hono/routes/manage/ai.js wrangler.toml
git commit -m "feat(ai): add hono ai quota middleware"
```

---

### Task 3: 增加 D1 trace/span/usage schema 与 telemetry writer

**Files:**
- Create: `migrations/0052_ai_observability.sql`
- Create: `functions/ai/telemetry-writer.js`
- Create: `functions/ai/__tests__/telemetry-writer.test.js`
- Modify: `functions/ai/telemetry.js`

**Step 1: Write the failing test**

在 `functions/ai/__tests__/telemetry-writer.test.js` 中锁定：

```js
it('writes request trace, spans and daily usage records to D1', async () => {
  // mock DB.prepare/bind/run
  // 调 telemetry writer
  // 断言写了 traces / spans / usage
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/telemetry-writer.test.js`

Expected: FAIL。

**Step 3: Write minimal implementation**

1. migration 建：
   - `ai_request_traces`
   - `ai_request_spans`
   - `ai_request_usage_daily`
2. `telemetry.js` 扩展 trace/span payload builder
3. `telemetry-writer.js` 落库，并保证失败不抛到主请求

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/telemetry-writer.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add migrations/0052_ai_observability.sql functions/ai/telemetry-writer.js functions/ai/__tests__/telemetry-writer.test.js functions/ai/telemetry.js
git commit -m "feat(ai): add d1 telemetry writer and observability schema"
```

---

### Task 4: 把 trace/span/usage 接入 AI 路由和执行链路

**Files:**
- Modify: `functions/lib/hono/routes/manage/ai.js`
- Modify: `functions/ai/request-context.js`
- Modify: `functions/ai/stream-engine.js`
- Modify: `functions/utils/ai-utils.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`

**Step 1: Write the failing test**

在 `ai-routes.test.js` 中新增：

```js
it('writes trace-aware telemetry with quota, retry, tool and cancellation dimensions', async () => {
  // mock telemetry writer
  // 请求 /stream
  // 断言 trace summary + spans 被调用
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`

Expected: FAIL。

**Step 3: Write minimal implementation**

1. request-context 继续承载 `traceId`
2. 路由开始/结束写 request trace
3. provider call / retry / tool round / cancel / quota reject 写 span
4. usage daily 聚合用 provider usage 或 estimated token fallback

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/ai.js functions/ai/request-context.js functions/ai/stream-engine.js functions/utils/ai-utils.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js
git commit -m "feat(ai): connect trace spans and usage telemetry"
```

---

### Task 5: 增加 safety enforcement primitives

**Files:**
- Create: `functions/ai/input-validator.js`
- Create: `functions/ai/data-masker.js`
- Create: `functions/ai/log-safe-serializer.js`
- Create: `functions/ai/__tests__/input-validator.test.js`
- Create: `functions/ai/__tests__/data-masker.test.js`

**Step 1: Write the failing tests**

在两个新测试中锁定：

```js
it('blocks oversized text or image payloads before provider invocation', () => { ... });
it('redacts sensitive fields and truncates oversized tool output for logs', () => { ... });
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/input-validator.test.js functions/ai/__tests__/data-masker.test.js`

Expected: FAIL。

**Step 3: Write minimal implementation**

1. `input-validator.js`
   - 文本长度
   - 图片数量
   - 图片字节预算
   - prompt injection score -> `allow/degrade/block`
2. `data-masker.js`
   - 工具输出脱敏
3. `log-safe-serializer.js`
   - payload 截断 + 敏感字段移除

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/input-validator.test.js functions/ai/__tests__/data-masker.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/ai/input-validator.js functions/ai/data-masker.js functions/ai/log-safe-serializer.js functions/ai/__tests__/input-validator.test.js functions/ai/__tests__/data-masker.test.js
git commit -m "feat(ai): add safety enforcement primitives"
```

---

### Task 6: 将 safety policy 接入 conversation route 和 tool output

**Files:**
- Modify: `functions/ai/conversation-service.js`
- Modify: `functions/lib/hono/routes/manage/ai.js`
- Modify: `functions/ai/stream-engine.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`

**Step 1: Write the failing test**

在 `ai-routes.test.js` 中增加：

```js
it('blocks oversized requests before provider call and degrades high-risk injection requests', async () => {
  // oversized => 400/422 without calling AI
  // injection high-risk => tools disabled or images degraded
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`

Expected: FAIL。

**Step 3: Write minimal implementation**

1. `prepareConversationRequest()` 前/中接入 validator
2. block 时提前返回
3. degrade 时禁用 tools/images
4. tool output 发给消息与 telemetry 前先过 masker/serializer

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/ai/conversation-service.js functions/lib/hono/routes/manage/ai.js functions/ai/stream-engine.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js
git commit -m "feat(ai): enforce request and tool safety policies"
```

---

### Task 7: 增加 rollout flags 与 regression fixtures

**Files:**
- Modify: `functions/ai/config-schema.js`
- Modify: `functions/ai/config-manager.js`
- Create: `functions/ai/__tests__/fixtures/basic-chat.json`
- Create: `functions/ai/__tests__/fixtures/multimodal-chat.json`
- Create: `functions/ai/__tests__/fixtures/quota-reject.json`
- Create: `functions/ai/__tests__/fixtures/safety-degrade.json`
- Create: `functions/ai/__tests__/ai-regression.test.js`

**Step 1: Write the failing test**

在 `functions/ai/__tests__/ai-regression.test.js` 中锁定 fixture contract：

```js
it('keeps baseline behavior for normal, multimodal, quota-rejected and safety-degraded requests', async () => {
  // 按 fixture 驱动 route/service
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/ai-regression.test.js`

Expected: FAIL。

**Step 3: Write minimal implementation**

1. 配置 rollout flags：
   - `AI_ROLLOUT_QUOTAS_ENABLED`
   - `AI_ROLLOUT_OBSERVABILITY_V2_ENABLED`
   - `AI_ROLLOUT_SAFETY_ENFORCEMENT_ENABLED`
2. route/runtime 按 flag 控制新行为
3. fixture regression tests 覆盖开关两侧

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/ai-regression.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/ai/config-schema.js functions/ai/config-manager.js functions/ai/__tests__/fixtures functions/ai/__tests__/ai-regression.test.js
git commit -m "feat(ai): add rollout flags and regression fixtures"
```

---

### Task 8: 跑剩余 Phase 4-7 定向验证与全量回归

**Files:**
- Modify: `docs/plans/2026-03-16-ai-phase4-7-implementation-plan.md`

**Step 1: Run targeted governance/observability tests**

Run:

```bash
node node_modules/vitest/vitest.mjs run \
  functions/ai/__tests__/rate-limit-manager.test.js \
  functions/lib/hono/middleware/__tests__/ai-rate-limit.test.js \
  functions/ai/__tests__/telemetry-writer.test.js \
  functions/lib/hono/routes/manage/__tests__/ai-routes.test.js
```

Expected: PASS。

**Step 2: Run targeted safety/rollout tests**

Run:

```bash
node node_modules/vitest/vitest.mjs run \
  functions/ai/__tests__/input-validator.test.js \
  functions/ai/__tests__/data-masker.test.js \
  functions/ai/__tests__/ai-regression.test.js
```

Expected: PASS。

**Step 3: Run migrations/lint/full unit tests**

Run:

```bash
node node_modules/eslint/bin/eslint.js functions/ai functions/lib/hono/routes/manage/ai.js functions/lib/hono/middleware/ai-rate-limit.js
pnpm test:unit
```

Expected: PASS。

**Step 4: Record verification notes**

把通过的命令和结果写回计划文件底部，并记录：

1. 新增 migration / bindings
2. 是否完成 Phase 4-7 全部范围
3. 若有残余风险，明确说明

**Step 5: Commit**

```bash
git add docs/plans/2026-03-16-ai-phase4-7-implementation-plan.md
git commit -m "docs: record ai phase 4-7 verification"
```

---

## Verification Notes

- 已执行：`node node_modules/vitest/vitest.mjs run functions/ai/__tests__/rate-limit-manager.test.js functions/lib/hono/middleware/__tests__/ai-rate-limit.test.js functions/ai/__tests__/telemetry-writer.test.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
  - 结果：4 个测试文件通过，17 个测试通过，0 失败
- 已执行：`node node_modules/vitest/vitest.mjs run functions/ai/__tests__/input-validator.test.js functions/ai/__tests__/data-masker.test.js functions/ai/__tests__/ai-regression.test.js`
  - 结果：3 个测试文件通过，5 个测试通过，0 失败
- 已执行：`node node_modules/eslint/bin/eslint.js functions/ai functions/lib/hono/routes/manage/ai.js functions/lib/hono/middleware/ai-rate-limit.js`
  - 结果：0 errors，0 warnings
- 已执行：`pnpm test:unit`
  - 结果：PASS，全量 Vitest 基线保持绿色

## Scope Status

- 已完成：Phase 4 AI Governance and Quotas
- 已完成：Phase 5 Observability V2
- 已完成：Phase 6 Safety Enforcement Layer
- 已完成：Phase 7 Evaluation and Progressive Rollout

## Added Runtime Artifacts

- 新增 migration：`migrations/0052_ai_observability.sql`
- 新增 KV binding：`AI_KV`（local / preview / production）

## Residual Risks

- 当前 observability 已能把 trace/span/usage 写入 D1，但仍是最小实现，尚未增加查询 API 或运营 UI。
- 当前 rollout flags 已进入 config schema 与 regression fixtures，但尚未暴露到设置界面。
- 当前 quotas 使用 KV 进行边缘计数，若后续发现强一致误差不可接受，再评估 Durable Object。

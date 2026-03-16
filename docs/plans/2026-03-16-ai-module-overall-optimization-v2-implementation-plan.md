# AI Module Overall Optimization V2 Phase 1-3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在保持当前 Cloudflare Workers + Hono AI 路由协议兼容的前提下，优先完成 Phase 1-3：请求上下文与取消链路、Tool Orchestrator V2、Reliability Policy Stack，并以测试先行的方式逐步落地。

**Architecture:** 保留 `functions/lib/hono/routes/manage/ai.js` 作为 Hono 路由入口，但把请求生命周期、工具编排、重试与模型策略从路由与 `functions/utils/ai-utils.js` 中拆出为显式模块。路由只负责装配依赖、创建请求上下文、驱动流式输出；执行平面由 `request-context`、`tool-orchestrator`、`retry-manager`、`model-policy` 和 `stream-engine` 组合完成。

**Tech Stack:** Cloudflare Workers, Hono, AbortController, SSE streaming, Vitest, 现有 `functions/ai/*` 与 `functions/utils/ai-utils.js`

---

### Task 1: 建立 Request Context 模块并锁定取消语义

**Files:**
- Create: `functions/ai/request-context.js`
- Create: `functions/ai/__tests__/request-context.test.js`

**Step 1: Write the failing test**

在 `functions/ai/__tests__/request-context.test.js` 中先锁定以下行为：

```js
import { describe, expect, it } from 'vitest';
import { createAIRequestContext, throwIfAborted } from '../request-context.js';

describe('request-context', () => {
  it('creates a stable request context with request and trace ids', () => {
    const context = createAIRequestContext({ userId: 'u-1', routeType: 'stream' });

    expect(context.requestId).toBeTruthy();
    expect(context.traceId).toBeTruthy();
    expect(context.userId).toBe('u-1');
    expect(context.routeType).toBe('stream');
    expect(typeof context.abort).toBe('function');
  });

  it('aborts with a structured reason and exposes it to downstream helpers', () => {
    const context = createAIRequestContext({ userId: 'u-1' });
    context.abort('client_disconnect');

    expect(context.signal.aborted).toBe(true);
    expect(context.getAbortReason()).toBe('client_disconnect');
    expect(() => throwIfAborted(context.signal, context.getAbortReason)).toThrow(/client_disconnect/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/request-context.test.js`

Expected: FAIL，因为 `request-context.js` 尚不存在。

**Step 3: Write minimal implementation**

在 `functions/ai/request-context.js` 中实现：

```js
export function createAIRequestContext(input = {}) {
  const controller = new AbortController();
  let abortReason = null;

  return {
    requestId: input.requestId || crypto.randomUUID(),
    traceId: input.traceId || crypto.randomUUID(),
    userId: input.userId || null,
    routeType: input.routeType || null,
    deadline: input.deadline || null,
    signal: controller.signal,
    abort(reason = 'aborted') {
      abortReason = reason;
      controller.abort(reason);
    },
    getAbortReason() {
      return abortReason || controller.signal.reason || null;
    },
  };
}
```

并补 `throwIfAborted(signal, getReason)` 辅助函数。

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/request-context.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/ai/request-context.js functions/ai/__tests__/request-context.test.js
git commit -m "feat(ai): add request context primitives"
```

---

### Task 2: 先补流式引擎取消链路测试

**Files:**
- Modify: `functions/ai/__tests__/stream-engine.test.js`
- Modify: `functions/ai/stream-engine.js`

**Step 1: Write the failing test**

在 `functions/ai/__tests__/stream-engine.test.js` 追加两个用例：

```js
it('stops reading and emits cancellation telemetry when request signal aborts mid-stream', async () => {
  const controller = new AbortController();
  const emit = vi.fn();
  const readerCancel = vi.fn();
  const stream = {
    getReader() {
      return {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n') })
          .mockImplementation(async () => {
            controller.abort('client_disconnect');
            throw Object.assign(new Error('aborted'), { name: 'AbortError' });
          }),
        cancel: readerCancel,
      };
    },
  };

  await expect(runAIStreamEngine({
    initialResult: { body: stream, model: 'model-a', switched: false },
    initialMessages: [],
    runtimeEnv: {},
    emit,
    executeTool: vi.fn(),
    requestContext: { signal: controller.signal, getAbortReason: () => controller.signal.reason || 'client_disconnect' },
  })).rejects.toThrow(/client_disconnect|aborted/);

  expect(readerCancel).toHaveBeenCalled();
  expect(emit).toHaveBeenCalledWith(expect.objectContaining({
    type: 'cancellation',
    data: expect.objectContaining({ reason: 'client_disconnect' }),
  }));
});

it('does not start queued tool work after the request has been aborted', async () => {
  const controller = new AbortController();
  controller.abort('client_disconnect');

  const executeTool = vi.fn();

  await expect(runAIStreamEngine({
    initialResult: {
      body: createReadable(['data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"tc_1","function":{"name":"searchVariants","arguments":"{}"}}]}}]}\n\n']),
      model: 'model-a',
      switched: false,
    },
    initialMessages: [],
    runtimeEnv: {},
    emit: vi.fn(),
    executeTool,
    requestContext: { signal: controller.signal, getAbortReason: () => 'client_disconnect' },
  })).rejects.toThrow(/client_disconnect/);

  expect(executeTool).not.toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/stream-engine.test.js`

Expected: FAIL，因为当前 `stream-engine.js` 不感知 `AbortSignal`。

**Step 3: Write minimal implementation**

在 `functions/ai/stream-engine.js` 中：

1. 给 `processStreamToEvents()` 和 `runAIStreamEngine()` 增加 `requestContext`。
2. 在 `reader.read()` 前后与每轮工具前调用 `throwIfAborted(...)`。
3. 捕获 `AbortError` 时：
   - `await reader.cancel(reason)`
   - `await emit({ type: 'cancellation', data: { reason } })`
   - 抛出结构化取消错误。

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/stream-engine.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/ai/__tests__/stream-engine.test.js functions/ai/stream-engine.js
git commit -m "feat(ai): add abort-aware stream engine"
```

---

### Task 3: 把 Request Context 接入 Hono AI 路由

**Files:**
- Modify: `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
- Modify: `functions/lib/hono/routes/manage/ai.js`

**Step 1: Write the failing test**

在 `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js` 中新增一条最小契约测试：

```js
it('passes request context signal into callAIStream and emits cancellation event on abort', async () => {
  let capturedSignal = null;
  callAIStream.mockImplementation(async (_messages, _tools, runtimeEnv) => {
    capturedSignal = runtimeEnv.AI_REQUEST_SIGNAL;
    return {
      body: createSSEReadable([{ choices: [{ delta: { content: 'ok' } }] }]),
      model: 'model-a',
      switched: false,
    };
  });

  const app = createApp();
  const res = await app.request(
    'http://localhost/api/manage/ai/stream',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ai-abort-after-ms': '0' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'ping' }],
        context: {},
      }),
    },
    { DB: createDbWithSettingsRows([]) }
  );

  await res.text();
  expect(capturedSignal).toBeInstanceOf(AbortSignal);
});
```

测试内可以通过仅测试环境支持的 `x-ai-abort-after-ms` 注入快速取消。

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`

Expected: FAIL，因为路由尚未构建 request context，也未向下游传递 signal。

**Step 3: Write minimal implementation**

在 `functions/lib/hono/routes/manage/ai.js` 中：

1. `import { createAIRequestContext } from '../../../../ai/request-context.js'`
2. 在 `/chat` 和 `/stream` 入口创建 `requestContext`
3. 将 `requestContext.signal` 注入 `runtimeEnv.AI_REQUEST_SIGNAL`
4. 将 `requestContext` 传给 `runAIStreamEngine`
5. 在测试环境下允许 `x-ai-abort-after-ms` 触发 `requestContext.abort('client_disconnect')`
6. 遥测中记录 `cancellationReason`

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/__tests__/ai-routes.test.js functions/lib/hono/routes/manage/ai.js
git commit -m "feat(ai): wire request context into hono ai routes"
```

---

### Task 4: 新建 Tool Orchestrator V2 并先锁定并发与超时

**Files:**
- Create: `functions/ai/tool-orchestrator.js`
- Create: `functions/ai/__tests__/tool-orchestrator.test.js`

**Step 1: Write the failing test**

在 `functions/ai/__tests__/tool-orchestrator.test.js` 中先锁定 3 个行为：

```js
import { describe, expect, it, vi } from 'vitest';
import { runToolOrchestration } from '../tool-orchestrator.js';

describe('tool-orchestrator', () => {
  it('runs independent tool calls in parallel under the configured concurrency limit', async () => {
    const order = [];
    const executeTool = vi.fn(async (name) => {
      order.push(`start:${name}`);
      await Promise.resolve();
      order.push(`end:${name}`);
      return { ok: true, name };
    });

    const result = await runToolOrchestration({
      toolCalls: [
        { id: '1', name: 'toolA', arguments: '{}' },
        { id: '2', name: 'toolB', arguments: '{}' },
      ],
      executeTool,
      concurrency: 2,
      timeoutMs: 500,
    });

    expect(result.results).toHaveLength(2);
    expect(order.slice(0, 2)).toEqual(['start:toolA', 'start:toolB']);
  });

  it('returns a timeout envelope instead of hanging the whole round', async () => {
    const executeTool = vi.fn(async () => new Promise(() => {}));

    const result = await runToolOrchestration({
      toolCalls: [{ id: '1', name: 'slowTool', arguments: '{}' }],
      executeTool,
      concurrency: 1,
      timeoutMs: 10,
    });

    expect(result.results[0]).toEqual(expect.objectContaining({
      status: 'timeout',
      toolCallId: '1',
      name: 'slowTool',
    }));
  });

  it('stops scheduling additional tool calls when the request is aborted', async () => {
    const controller = new AbortController();
    const executeTool = vi.fn(async (name) => {
      if (name === 'toolA') controller.abort('client_disconnect');
      return { ok: true };
    });

    const result = await runToolOrchestration({
      toolCalls: [
        { id: '1', name: 'toolA', arguments: '{}' },
        { id: '2', name: 'toolB', arguments: '{}' },
      ],
      executeTool,
      concurrency: 1,
      timeoutMs: 500,
      requestContext: { signal: controller.signal, getAbortReason: () => 'client_disconnect' },
    });

    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(result.results[1]).toEqual(expect.objectContaining({ status: 'skipped' }));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/tool-orchestrator.test.js`

Expected: FAIL，因为 `tool-orchestrator.js` 尚不存在。

**Step 3: Write minimal implementation**

在 `functions/ai/tool-orchestrator.js` 中实现：

1. `runToolOrchestration({ toolCalls, executeTool, concurrency, timeoutMs, requestContext, emit })`
2. 并发池限制
3. `withToolTimeout` 包装
4. 结果 envelope：

```js
{
  toolCallId,
  name,
  status: 'success' | 'failure' | 'timeout' | 'skipped',
  output,
  error,
}
```

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/tool-orchestrator.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/ai/tool-orchestrator.js functions/ai/__tests__/tool-orchestrator.test.js
git commit -m "feat(ai): add tool orchestrator v2 primitives"
```

---

### Task 5: 让 stream-engine 使用 Tool Orchestrator V2

**Files:**
- Modify: `functions/ai/__tests__/stream-engine.test.js`
- Modify: `functions/ai/stream-engine.js`

**Step 1: Write the failing test**

在 `functions/ai/__tests__/stream-engine.test.js` 中新增：

```js
it('executes tool calls through the orchestrator and emits structured tool statuses', async () => {
  const emit = vi.fn();
  const callAIStream = vi
    .fn()
    .mockResolvedValueOnce({
      body: createReadable(['data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"tc_1","function":{"name":"toolA","arguments":"{}"}},{"index":1,"id":"tc_2","function":{"name":"toolB","arguments":"{}"}}]}}]}\n\n']),
      model: 'model-a',
      switched: false,
    })
    .mockResolvedValueOnce({
      body: createReadable(['data: {"choices":[{"delta":{"content":"done"}}]}\n\n', 'data: [DONE]\n\n']),
      model: 'model-a',
      switched: false,
    });

  const result = await runAIStreamEngine({
    initialMessages: [],
    runtimeEnv: { AI_TOOL_CONCURRENCY: 2, AI_TOOL_TIMEOUT_MS: 100 },
    callAIStream,
    emit,
    executeTool: vi.fn(async (name) => ({ name })),
  });

  expect(emit).toHaveBeenCalledWith(expect.objectContaining({
    type: 'tool_result',
    data: expect.objectContaining({ name: 'toolA', status: 'success' }),
  }));
  expect(result.roundTelemetry.executedTools).toBe(2);
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/stream-engine.test.js`

Expected: FAIL，因为当前工具仍是串行 `for...of` 执行。

**Step 3: Write minimal implementation**

在 `functions/ai/stream-engine.js` 中：

1. 引入 `runToolOrchestration`
2. 用编排结果替换串行执行
3. `messages.push({ role: 'tool', ... })` 时写入每个 tool envelope 的安全结果
4. `emit` 统一输出 `tool_call` / `tool_result` / `tool_timeout` / `tool_failure`

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/stream-engine.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/ai/__tests__/stream-engine.test.js functions/ai/stream-engine.js
git commit -m "feat(ai): run stream tools through orchestrator v2"
```

---

### Task 6: 补齐 Reliability 测试，拆出 Retry Manager 与 Error Classifier

**Files:**
- Create: `functions/ai/retry-manager.js`
- Create: `functions/ai/model-policy.js`
- Create: `functions/ai/__tests__/retry-manager.test.js`
- Modify: `functions/utils/__tests__/ai-utils-health.test.js`
- Modify: `functions/utils/ai-utils.js`

**Step 1: Write the failing test**

新增 `functions/ai/__tests__/retry-manager.test.js`：

```js
import { describe, expect, it, vi } from 'vitest';
import { classifyAIError, executeWithRetry } from '../retry-manager.js';

describe('retry-manager', () => {
  it('classifies 429 and network errors as retryable', () => {
    expect(classifyAIError(new Error('AI API error (429)'))).toEqual(expect.objectContaining({ retryable: true }));
    expect(classifyAIError(new TypeError('fetch failed'))).toEqual(expect.objectContaining({ retryable: true }));
  });

  it('does not retry validation-style 400 errors', async () => {
    const task = vi.fn(async () => {
      throw new Error('AI API error (400) [model:m]: invalid parameter');
    });

    await expect(executeWithRetry(task, { retries: 2, baseDelayMs: 1 })).rejects.toThrow(/400/);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('retries transient failures with bounded attempts', async () => {
    let attempts = 0;
    const task = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('AI API error (503) [model:m]: overloaded');
      return 'ok';
    });

    const result = await executeWithRetry(task, { retries: 2, baseDelayMs: 1, jitterMs: 0 });
    expect(result).toBe('ok');
    expect(task).toHaveBeenCalledTimes(3);
  });
});
```

并在 `functions/utils/__tests__/ai-utils-health.test.js` 追加一个失败用例，要求 `callAI` 使用新的 retry 策略但仍保持现有 fallback 契约。

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/retry-manager.test.js functions/utils/__tests__/ai-utils-health.test.js`

Expected: FAIL，因为还没有独立 retry manager，`ai-utils.js` 也没有统一策略。

**Step 3: Write minimal implementation**

1. 在 `functions/ai/retry-manager.js` 实现：
   - `classifyAIError(error)`
   - `executeWithRetry(task, options)`
2. 在 `functions/ai/model-policy.js` 实现：
   - 解析模型列表
   - 判断冷却可用性
   - 选择下一个模型
3. 在 `functions/utils/ai-utils.js` 中：
   - 保留对外 `callAI`/`callAIStream`
   - 将内部 `executeAIRequest` 改为依赖 `executeWithRetry` 与 `model-policy`

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/retry-manager.test.js functions/utils/__tests__/ai-utils-health.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/ai/retry-manager.js functions/ai/model-policy.js functions/ai/__tests__/retry-manager.test.js functions/utils/__tests__/ai-utils-health.test.js functions/utils/ai-utils.js
git commit -m "feat(ai): add retry manager and model policy stack"
```

---

### Task 7: 将 Reliability Policy 接回流式与非流式调用

**Files:**
- Modify: `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
- Modify: `functions/utils/__tests__/ai-utils-health.test.js`
- Modify: `functions/lib/hono/routes/manage/ai.js`
- Modify: `functions/utils/ai-utils.js`

**Step 1: Write the failing test**

在 `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js` 新增：

```js
it('records retry count and cancellation reason in request telemetry for stream requests', async () => {
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  callAIStream.mockResolvedValue({
    body: createSSEReadable([{ choices: [{ delta: { content: 'ok' } }] }]),
    model: 'model-a',
    switched: false,
    retryCount: 2,
  });

  const app = createApp();
  const res = await app.request(
    'http://localhost/api/manage/ai/stream',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'ping' }], context: {} }),
    },
    { DB: createDbWithSettingsRows([]) }
  );

  await res.text();
  expect(res.status).toBe(200);
  expect(infoSpy).toHaveBeenCalledWith(
    '[AI RequestTelemetry]',
    expect.stringContaining('"retryCount":2')
  );
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/ai-routes.test.js functions/utils/__tests__/ai-utils-health.test.js`

Expected: FAIL，因为现有遥测没有 `retryCount`，路由也未透传策略结果。

**Step 3: Write minimal implementation**

1. 让 `callAI` / `callAIStream` 返回 `_meta.retryCount`
2. 扩展 `createAIRequestTelemetry`，增加：
   - `retryCount`
   - `cancellationReason`
3. 在 `ai.js` 的 chat/stream 请求遥测里写入这些字段

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/ai-routes.test.js functions/utils/__tests__/ai-utils-health.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/__tests__/ai-routes.test.js functions/utils/__tests__/ai-utils-health.test.js functions/lib/hono/routes/manage/ai.js functions/utils/ai-utils.js functions/ai/telemetry.js
git commit -m "feat(ai): expose retry and cancellation telemetry"
```

---

### Task 8: 跑完整的 Phase 1-3 定向验证

**Files:**
- Modify: `docs/plans/2026-03-16-ai-module-overall-optimization-v2-implementation-plan.md`

**Step 1: Run request-context and orchestrator tests**

Run:

```bash
node node_modules/vitest/vitest.mjs run \
  functions/ai/__tests__/request-context.test.js \
  functions/ai/__tests__/tool-orchestrator.test.js \
  functions/ai/__tests__/stream-engine.test.js
```

Expected: all PASS。

**Step 2: Run reliability and route tests**

Run:

```bash
node node_modules/vitest/vitest.mjs run \
  functions/ai/__tests__/retry-manager.test.js \
  functions/utils/__tests__/ai-utils-health.test.js \
  functions/lib/hono/routes/manage/__tests__/ai-routes.test.js
```

Expected: all PASS。

**Step 3: Run touched backend lint scope**

Run: `node node_modules/eslint/bin/eslint.js functions/ai functions/utils/ai-utils.js functions/lib/hono/routes/manage/ai.js`

Expected: PASS，或只剩与本次未改动逻辑无关的问题。

**Step 4: Record verification notes**

把执行结果补回本计划文件底部，记录：

1. 实际通过的测试命令
2. 若存在未覆盖风险，明确写出
3. 当前仅完成 Phase 1-3，其余 Phase 未开始

**Step 5: Commit**

```bash
git add docs/plans/2026-03-16-ai-module-overall-optimization-v2-implementation-plan.md
git commit -m "docs: record phase 1-3 ai optimization verification"
```

---

## Verification Notes

- 已执行：`node node_modules/vitest/vitest.mjs run functions/ai/__tests__/request-context.test.js functions/ai/__tests__/tool-orchestrator.test.js functions/ai/__tests__/stream-engine.test.js`
  - 结果：3 个测试文件通过，10 个测试通过，0 失败
- 已执行：`node node_modules/vitest/vitest.mjs run functions/ai/__tests__/retry-manager.test.js functions/utils/__tests__/ai-utils-health.test.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
  - 结果：3 个测试文件通过，17 个测试通过，0 失败
- 已执行：`node node_modules/eslint/bin/eslint.js functions/ai functions/utils/ai-utils.js functions/lib/hono/routes/manage/ai.js`
  - 结果：0 errors，0 warnings
- 已执行：`pnpm test:unit`
  - 结果：失败，且失败项集中在本次范围之外；当前观察到的失败包括：
    - `src/components/product/import/__tests__/ImportPreviewStep.test.js`
    - `src/components/product/__tests__/VariantBatchBuilderModal.test.js`
    - `src/components/product/__tests__/ProductBasicInfoSection.contract.test.js`
    - `src/components/order/__tests__/sales-a11y.test.js`
    - `src/components/product/__tests__/ProductCreateModal.variant-images.test.js`
    - `functions/repositories/__tests__/product-variant-code.test.js`
    - `functions/lib/authz/__tests__/metadata-consistency.test.js`
    - `functions/lib/hono/routes/manage/products/__tests__/product-patch-rollback-boundary.test.js`
  - 另有 3 个来自 `functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js` 期间的 audit helper 未处理 rejection

## Residual Risks

- 当前 `tool-orchestrator` 已具备并发、超时、取消后的跳过语义，但尚未实现依赖 DAG 与更细粒度的预算策略。
- Reliability 目前已统一 request retry 与基础模型策略，但跨实例共享 cooldown / circuit breaker 仍未接入 KV 或 Durable Object。
- 路由遥测已包含 `retryCount` 与 `cancellationReason`，但持久化 trace/span 与运营级查询能力仍属于后续 Phase。
- 仓库当前全量 unit test 基线不是全绿，因此本次只能确认“AI Phase 1-3 定向范围通过”，不能声明整个仓库单测通过。

## Scope Status

- 已完成：Phase 1 Request Context and Cancellation
- 已完成：Phase 2 Tool Orchestrator V2
- 已完成：Phase 3 Reliability Policy Stack
- 未开始：Phase 4-7

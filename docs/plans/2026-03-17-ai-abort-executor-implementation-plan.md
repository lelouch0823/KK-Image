# AI Abort Executor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a shared AI request executor and migrate all AI entrypoints to one cancellation-aware execution path so request aborts stop provider work, retries, and tool orchestration consistently.

**Architecture:** Introduce a new `functions/ai/request-executor.js` module that owns abort-aware fetch, retry delays, and model switching. Keep `request-context.js` as the source of request lifecycle state, make `ai-utils.js` a thin payload wrapper, and update routes plus stream/tool orchestration to consume the new cancellation contract.

**Tech Stack:** Hono, Cloudflare-style Fetch/AbortController APIs, Vitest, existing AI model policy and retry manager utilities.

---

### Task 1: Lock down request-context behavior

**Files:**
- Modify: `functions/ai/request-context.js`
- Create: `functions/ai/__tests__/request-context.test.js`

**Step 1: Write the failing tests**

Add tests covering:

```js
it('adopts an external abort signal and preserves its reason', () => {
  const inbound = new AbortController();
  const ctx = createAIRequestContext({ routeType: 'stream', signal: inbound.signal });
  inbound.abort('client_disconnect');
  expect(ctx.signal.aborted).toBe(true);
  expect(ctx.getAbortReason()).toBe('client_disconnect');
});

it('keeps the first abort reason sticky', () => {
  const ctx = createAIRequestContext({});
  ctx.abort('deadline');
  ctx.abort('client_disconnect');
  expect(ctx.getAbortReason()).toBe('deadline');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run functions/ai/__tests__/request-context.test.js`
Expected: FAIL because `createAIRequestContext` does not yet consume an inbound signal or preserve first reason semantics explicitly.

**Step 3: Write minimal implementation**

Update `createAIRequestContext` to:
- accept `input.signal`
- forward external aborts into the internal controller
- preserve the first abort reason
- keep `throwIfAborted` and structured abort helpers unchanged for callers

**Step 4: Run test to verify it passes**

Run: `npx vitest run functions/ai/__tests__/request-context.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/ai/request-context.js functions/ai/__tests__/request-context.test.js
git commit -m "test(ai): lock request context abort semantics"
```

### Task 2: Introduce a shared request executor

**Files:**
- Create: `functions/ai/request-executor.js`
- Create: `functions/ai/__tests__/request-executor.test.js`
- Check: `functions/ai/model-policy.js`
- Check: `functions/ai/retry-manager.js`

**Step 1: Write the failing tests**

Add tests covering:

```js
it('passes the request signal into fetch', async () => {
  const signal = new AbortController().signal;
  await executeAIRequest({
    env,
    modelIndex: 0,
    signal,
    requestFn: vi.fn(async ({ signal: fetchSignal }) => {
      expect(fetchSignal).toBe(signal);
      return okResponse();
    }),
  });
});

it('stops retrying when the signal aborts during backoff', async () => {
  const controller = new AbortController();
  const requestFn = vi.fn()
    .mockResolvedValueOnce(errorResponse(503))
    .mockImplementation(async () => {
      throw new Error('should not retry after abort');
    });

  const promise = executeAIRequest({ env, signal: controller.signal, requestFn });
  controller.abort('client_disconnect');
  await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  expect(requestFn).toHaveBeenCalledTimes(1);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run functions/ai/__tests__/request-executor.test.js`
Expected: FAIL because the executor module does not exist yet.

**Step 3: Write minimal implementation**

Implement `functions/ai/request-executor.js` with:
- exported executor used by AI wrappers
- abort-aware preflight check
- abort-aware retry loop/backoff
- existing model policy integration
- existing retry count and rate-limit metadata
- abort-aware model switch recursion

**Step 4: Run test to verify it passes**

Run: `npx vitest run functions/ai/__tests__/request-executor.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/ai/request-executor.js functions/ai/__tests__/request-executor.test.js
git commit -m "feat(ai): add abort-aware request executor"
```

### Task 3: Migrate `ai-utils.js` to the executor

**Files:**
- Modify: `functions/utils/ai-utils.js`
- Modify: `functions/utils/__tests__/ai-utils-health.test.js`

**Step 1: Write the failing tests**

Extend tests to cover:

```js
it('passes AI_REQUEST_SIGNAL to fetch in callAI', async () => {
  const controller = new AbortController();
  await callAI(messages, [], { ...env, AI_REQUEST_SIGNAL: controller.signal });
  expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
});

it('does not enter fallback mode in callAIAuto after abort', async () => {
  const controller = new AbortController();
  controller.abort('client_disconnect');
  await expect(callAIAuto({ messages, env: { ...env, AI_REQUEST_SIGNAL: controller.signal } }))
    .rejects.toMatchObject({ name: 'AbortError' });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run functions/utils/__tests__/ai-utils-health.test.js`
Expected: FAIL because `callAI`, `callAIStream`, and `callAIAuto` do not yet use the executor or carry signals through.

**Step 3: Write minimal implementation**

Refactor `ai-utils.js` to:
- delegate provider execution to `request-executor.js`
- pass `env.AI_REQUEST_SIGNAL` through request execution
- preserve current public return shapes
- ensure `callAIAuto` never performs fallback after abort

**Step 4: Run test to verify it passes**

Run: `npx vitest run functions/utils/__tests__/ai-utils-health.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/utils/ai-utils.js functions/utils/__tests__/ai-utils-health.test.js
git commit -m "refactor(ai): route provider calls through request executor"
```

### Task 4: Wire route entrypoints into the shared cancellation path

**Files:**
- Modify: `functions/lib/hono/routes/manage/ai.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`

**Step 1: Write the failing tests**

Add route tests covering:

```js
it('passes request context signal into callAI runtime env for /chat', async () => {
  let capturedSignal = null;
  callAI.mockImplementation(async (_messages, _tools, runtimeEnv) => {
    capturedSignal = runtimeEnv?.AI_REQUEST_SIGNAL || null;
    return { choices: [{ message: { role: 'assistant', content: 'ok' } }] };
  });

  const res = await app.request('http://localhost/api/manage/ai/chat', requestInit, env);
  expect(res.status).toBe(200);
  expect(capturedSignal).toBeInstanceOf(AbortSignal);
});
```

If the test harness supports custom request signals, add one more case verifying `/stream` request abort is connected to the request context; otherwise document that this wiring is covered by `request-context` plus executor tests.

**Step 2: Run test to verify it fails**

Run: `npx vitest run functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
Expected: FAIL because `/chat` does not yet inject the request signal into runtime env consistently.

**Step 3: Write minimal implementation**

Update `/chat` and `/stream` route setup to:
- construct request contexts from inbound request signals
- pass the canonical signal into runtime env
- keep existing telemetry behavior but source cancellation reason only from request context

**Step 4: Run test to verify it passes**

Run: `npx vitest run functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/ai.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js
git commit -m "fix(ai): unify route abort signal wiring"
```

### Task 5: Correct tool abort semantics

**Files:**
- Modify: `functions/ai/tool-orchestrator.js`
- Modify: `functions/ai/__tests__/tool-orchestrator.test.js`

**Step 1: Write the failing test**

Add coverage like:

```js
it('marks an in-flight tool as aborted instead of success when the request aborts', async () => {
  const requestContext = createAIRequestContext({});
  const result = await runToolOrchestration({
    toolCalls: [{ id: '1', name: 'toolA', arguments: '{}' }],
    requestContext,
    executeTool: vi.fn(async () => {
      requestContext.abort('client_disconnect');
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }),
  });

  expect(result.results[0]).toEqual(expect.objectContaining({
    status: 'aborted',
    toolCallId: '1',
  }));
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run functions/ai/__tests__/tool-orchestrator.test.js`
Expected: FAIL because aborted work is currently returned as `success`.

**Step 3: Write minimal implementation**

Update tool orchestration to:
- emit `aborted` for the in-flight canceled tool
- preserve `skipped` for unscheduled trailing work
- avoid fabricating `{ ok: true }`

**Step 4: Run test to verify it passes**

Run: `npx vitest run functions/ai/__tests__/tool-orchestrator.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/ai/tool-orchestrator.js functions/ai/__tests__/tool-orchestrator.test.js
git commit -m "fix(ai): separate aborted tool results from success"
```

### Task 6: Update stream engine to honor aborted tool/provider flow

**Files:**
- Modify: `functions/ai/stream-engine.js`
- Modify: `functions/ai/__tests__/stream-engine.test.js`

**Step 1: Write the failing tests**

Add tests covering:

```js
it('does not emit tool_result for aborted tool execution', async () => {
  const emit = vi.fn();
  await expect(runAIStreamEngine({
    initialResult,
    initialMessages: [],
    runtimeEnv: {},
    emit,
    executeTool: vi.fn(async () => {
      requestContext.abort('client_disconnect');
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }),
    requestContext,
  })).rejects.toMatchObject({ name: 'AbortError' });

  expect(emit).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'tool_result' }));
});

it('does not request the next stream round after abort', async () => {
  expect(callAIStream).toHaveBeenCalledTimes(1);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run functions/ai/__tests__/stream-engine.test.js`
Expected: FAIL because current logic emits a synthetic success path for aborted tools.

**Step 3: Write minimal implementation**

Update `runAIStreamEngine` to:
- ignore `aborted` results for tool success emission and tool message append
- throw on the shared abort path before any follow-up provider round
- keep timeout/failure behavior unchanged

**Step 4: Run test to verify it passes**

Run: `npx vitest run functions/ai/__tests__/stream-engine.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/ai/stream-engine.js functions/ai/__tests__/stream-engine.test.js
git commit -m "fix(ai): stop stream rounds cleanly on cancellation"
```

### Task 7: Run focused verification and then full relevant verification

**Files:**
- No code changes required unless failures surface

**Step 1: Run focused test suites**

Run:

```bash
npx vitest run functions/ai/__tests__/request-context.test.js
npx vitest run functions/ai/__tests__/request-executor.test.js
npx vitest run functions/ai/__tests__/tool-orchestrator.test.js
npx vitest run functions/ai/__tests__/stream-engine.test.js
npx vitest run functions/utils/__tests__/ai-utils-health.test.js
npx vitest run functions/lib/hono/routes/manage/__tests__/ai-routes.test.js
```

Expected: PASS

**Step 2: Run broader regression slice**

Run:

```bash
npx vitest run functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js
```

Expected: PASS, confirming route changes did not regress adjacent AI route behavior.

**Step 3: Investigate and fix any failures**

If anything fails:
- update only the smallest relevant implementation or test fixture
- rerun the failing suite first
- rerun the full verification set

**Step 4: Commit**

```bash
git add .
git commit -m "test(ai): verify abort executor integration"
```

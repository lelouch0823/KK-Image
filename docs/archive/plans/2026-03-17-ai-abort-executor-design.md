# AI Abort Executor Design

**Goal:** Unify AI request cancellation across route entrypoints, provider fetch/retry execution, streaming orchestration, and tool execution so client disconnects, deadlines, and manual aborts all produce the same behavior.

**Scope:** `functions/lib/hono/routes/manage/ai.js`, `functions/utils/ai-utils.js`, `functions/ai/request-context.js`, a new shared request executor module, stream/tool orchestration, and related tests.

---

## Problem Summary

The current cancellation stack is incomplete in three places:

1. `/stream` creates a fresh request context but does not forward the incoming request abort signal into it, so SSE disconnects do not abort downstream work.
2. Provider calls and retry flow do not consume `AI_REQUEST_SIGNAL`, so upstream fetches and retry backoff continue after cancellation.
3. Tool orchestration reports an in-flight aborted tool as `success`, which causes the stream engine to emit a fake successful `tool_result`.

The user requested a full solution, not a narrow patch, so the design consolidates cancellation into a single executor layer used by all AI paths.

## Recommended Approach

### Option 1: Localized fixes only

Patch `/stream`, add `signal` to `fetch`, and change tool abort status.

Why not:
- Leaves `/chat` and `callAIAuto` with separate behavior.
- Keeps retry/model-switch logic cancellation-unaware in multiple places.
- Increases regression risk because abort semantics remain fragmented.

### Option 2: Shared abort helpers inside `ai-utils.js`

Add helper functions in `ai-utils.js` for abort-aware fetch and sleep, then thread them into `callAI` and `callAIStream`.

Why not:
- Better than localized fixes, but still leaves request lifecycle and provider execution coupled in one file.
- Makes stream/chat callers keep duplicating context wiring.

### Option 3: Dedicated request executor

Introduce a shared executor layer that owns provider request execution, retry/model-switch flow, and abort propagation, with route/request context feeding a single merged signal.

Why this is the recommendation:
- Solves the current review findings and the broader consistency problem in one place.
- Keeps `ai-utils.js` focused on payload shaping instead of transport control flow.
- Gives `stream-engine` and route handlers one cancellation contract to consume.

## Architecture

### Request lifecycle

`createAIRequestContext` remains the request-scoped state holder, but it must support external abort sources.

Required behavior:
- Accept an inbound request signal from Hono/Fetch when available.
- Optionally accept a deadline or extra abort sources later without changing callers.
- Preserve the first meaningful abort reason.
- Expose one canonical `signal` and one canonical `getAbortReason()`.

### Provider execution

Add `functions/ai/request-executor.js` as the single owner of:
- abort-aware `fetch`
- abort-aware retry backoff
- abort checks before retry and before model switch
- model selection and rate-limit switch recursion
- normalized result metadata (`model`, `switched`, `rateLimit`, `retryCount`)

`callAI`, `callAIStream`, and `callAIAuto` become thin wrappers around this executor.

### Route integration

Both `/chat` and `/stream` must:
- create a request context once
- connect the incoming request signal into that context
- pass `requestContext.signal` through runtime env as `AI_REQUEST_SIGNAL`
- read cancellation telemetry from the same request context

This avoids route-specific cancellation behavior.

### Stream and tools

`runAIStreamEngine` and `runToolOrchestration` should not invent their own success semantics for aborts.

New state model:
- `success`: tool finished and returned output
- `failure`: tool threw a normal error
- `timeout`: tool exceeded timeout
- `aborted`: current in-flight tool was interrupted by request abort
- `skipped`: queued tool never started because the request was already aborted

The stream engine must never emit `tool_result` for `aborted`.

## Data Flow

### `/stream`

1. Incoming request enters route.
2. Route creates request context connected to `c.req.raw.signal`.
3. Runtime env receives `AI_REQUEST_SIGNAL`.
4. `callAIStream` delegates provider transport to request executor.
5. If client disconnects, the inbound signal aborts the request context.
6. The executor aborts fetch/retry, the stream engine cancels reader work, tool orchestration stops scheduling new tools, and the route records the same cancellation reason in telemetry.

### `/chat`

1. Route creates the same request context pattern.
2. `callAI` and any follow-up rounds use the same runtime env signal.
3. If the request is aborted mid-call, provider execution exits early instead of completing in the background.

### `callAIAuto`

1. The primary mode call uses the shared executor.
2. If cancellation occurs during stream/non-stream attempt, abort wins immediately.
3. Auto fallback only runs for supported provider errors, never after abort.

## Error Handling Rules

Abort rules:
- Cancellation is represented by `AbortError` with code `AI_REQUEST_ABORTED`.
- Executor throws abort immediately if signal is already aborted.
- Retry loops stop immediately when signal aborts.
- Model switch recursion stops immediately when signal aborts.
- Stream engine emits a `cancellation` event once and rethrows a structured abort error.

Non-abort rules:
- Normal provider failures keep existing error behavior.
- 429 handling and model switch remain intact.
- Timeout remains distinct from abort.

## Testing Strategy

### Unit tests

`functions/ai/__tests__/tool-orchestrator.test.js`
- Add a case proving an in-flight aborted tool returns `aborted` rather than `success`.
- Keep existing skipped-queue coverage.

`functions/ai/__tests__/stream-engine.test.js`
- Add a case proving aborted tool results do not emit `tool_result`.
- Add a case proving abort between rounds prevents a follow-up provider request.

`functions/utils/__tests__/ai-utils-health.test.js`
- Add coverage that `callAI` passes `AI_REQUEST_SIGNAL` to `fetch`.
- Add coverage that retry stops after abort instead of issuing another attempt.
- Add coverage that abort prevents auto fallback in `callAIAuto`.

### Route tests

`functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
- Keep existing `AI_REQUEST_SIGNAL` propagation assertions.
- Add a route-level test for `/chat` to prove runtime env also carries the request signal.
- Add a route-level abort wiring test for `/stream` if the Hono test harness exposes a controllable request signal; otherwise keep this at request-context/executor unit level and document the harness limit.

### Executor tests

Add new test file for `functions/ai/request-executor.js`:
- abort before first fetch
- abort during retry delay
- abort before model switch retry
- successful retry still records retry count

## Acceptance Criteria

- Closing the SSE connection aborts provider work and tool scheduling.
- `/chat`, `/stream`, and `callAIAuto` all consume the same request signal contract.
- Provider `fetch` and retry backoff stop promptly on abort.
- Aborted tool work never appears as a successful tool result.
- Telemetry reports one consistent cancellation reason from request context.
- Existing model-switch and retry behavior still works when no abort occurs.

## Risks

- Refactoring transport flow can unintentionally change retry/model-switch semantics.
- Hono request-signal behavior in tests may not exactly mirror production; unit coverage must anchor the executor behavior directly.
- Some provider/runtime environments may differ in how `AbortSignal.reason` is surfaced, so context-owned reason tracking remains necessary.

## Implementation Notes

- Keep the first abort reason sticky; later abort attempts should not overwrite it.
- Prefer introducing small helper functions in `request-executor.js` over enlarging `ai-utils.js`.
- Preserve existing response shapes from `callAI` and `callAIStream` to minimize caller churn.
- Avoid broad route refactors unrelated to cancellation.

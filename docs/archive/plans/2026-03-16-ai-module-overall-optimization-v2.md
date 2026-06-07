# AI Module Overall Optimization V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the AI optimization roadmap on top of the current KK-Image implementation, closing gaps in cancellation, orchestration, reliability, observability, security, and rollout while staying compatible with the existing Cloudflare Workers + Hono architecture.

**Architecture:** Keep the current Hono route layer and AI service split, but upgrade the runtime into a more explicit control plane plus execution plane model. Configuration, routing, model policy, tool orchestration, request budgets, tracing, and safety controls should become first-class modules with clear boundaries, Cloudflare-native persistence, and measurable behavior.

**Tech Stack:** Cloudflare Workers, Hono, D1, KV, optional Durable Objects for coordination, SSE streaming, Vitest, existing AI route/service modules

---

## 1. Why V2 Exists

The previous plan no longer matches the repository state:

- Some capabilities were already implemented ahead of plan, including runtime AI config loading, model health tracking, dynamic fallback ranking, stream gate telemetry, prompt-injection signal logging, and AI settings UI support.
- Several items described as completed in spirit are still only partial implementations, especially stream cancellation, tool orchestration concurrency, persistent observability, user-scoped rate limiting, retry policy, and structured safety enforcement.
- The old plan is still useful as background, but it is no longer an accurate execution contract.

This document is the new source of truth.

## 2. Current State Baseline

### 2.1 Confirmed Capabilities Already Present

- Runtime config loading with DB > env > default precedence via `functions/ai/config-manager.js`
- Config schema and validation via `functions/ai/config-schema.js`
- AI route integration for config-aware runtime env resolution in `functions/lib/hono/routes/manage/ai.js`
- Dynamic fallback ordering and model health snapshots in `functions/utils/ai-utils.js`
- AI settings UI for API URL/key, model ordering, dynamic fallback toggle, model health window, health panel, connection test, and model discovery in `src/components/settings/tabs/AISettings.vue`
- Stream engine with multi-round tool loop, stream gating, tool lifecycle events, and model switch events in `functions/ai/stream-engine.js`
- Prompt-injection signal detection and multimodal request preparation in `functions/ai/conversation-service.js`
- Request-level telemetry payload logging in `functions/ai/telemetry.js`
- Test coverage across config manager, stream engine, AI routes, settings routes, model health logic, and AI settings UI

### 2.2 Current Implementation Gaps

#### Gap A: Stream cancellation is not end-to-end

Current state:

- The SSE route streams responses correctly.
- There is no request-scoped `AbortController` propagated from Hono route to AI fetch and stream engine loops.
- No explicit cleanup primitive exists for reader cancellation, tool execution cancellation, or downstream fetch abort.

Impact:

- Wasted provider tokens after client disconnect.
- Wasted Worker execution time and lingering tool work.
- Hard to guarantee bounded resource usage under poor networks.

V2 solution:

- Introduce request-scoped cancellation context.
- Propagate abort signals through route, AI provider fetch, stream parser, tool executor, and post-tool follow-up rounds.
- Add deterministic cleanup hooks for stream readers and any pending tool tasks.

#### Gap B: Tool orchestration is still serial

Current state:

- The stream engine supports multi-round tool execution.
- Tool calls are executed one-by-one in each round.
- No timeout policy, no concurrency budget, no isolation policy, no dependency-aware execution graph.

Impact:

- Higher end-to-end latency.
- One slow tool blocks the entire round.
- No principled way to support richer tool topologies later.

V2 solution:

- Replace serial round execution with a budgeted orchestration layer.
- Support bounded parallel execution for independent tools.
- Add per-tool timeout, partial failure handling, structured tool errors, and optional dependency DAG execution.

#### Gap C: Reliability policy is fragmented

Current state:

- Model fallback and cooldown exist.
- There is no unified retry manager with backoff, jitter, retry classes, and per-error policy.
- Cooldowns are in-memory only, which is weak under multi-instance Worker execution.

Impact:

- Behavior differs across hot instances.
- Retries are ad hoc and hard to reason about.
- Recovery and saturation behavior is not measurable enough.

V2 solution:

- Separate provider retry policy from model routing policy.
- Add retry budget, exponential backoff, jitter, and retryable/non-retryable classification.
- Keep local fast-path metrics in memory, but persist coordination-grade state to Cloudflare-native storage where needed.

#### Gap D: Observability is logs-first, not trace-first

Current state:

- There are structured-ish console logs for model use, gate telemetry, injection signals, and request telemetry.
- There is no persistent trace/span model, no correlation across route -> model -> tool -> retry -> output stages, and no durable token accounting pipeline.

Impact:

- Root-cause analysis is manual.
- Latency and token hotspots are difficult to query.
- No durable basis for SLOs, alerting, or rollout comparisons.

V2 solution:

- Introduce AI trace records and span records with request correlation.
- Persist minimal, high-value telemetry to D1 or queue-backed sinks.
- Standardize metrics: latency, stream first-byte latency, tool latency, model switches, retry counts, token estimates or provider counts, cancellation reasons.

#### Gap E: Safety controls are signal-only, not policy-enforced

Current state:

- Prompt-injection heuristics exist.
- There is no first-class input validator, image budget checker, output masker, tool result redaction layer, or request budget policy.

Impact:

- Unsafe or excessively large requests may still reach providers.
- Tool results can overexpose data.
- Logs and telemetry can accidentally retain sensitive payload fragments.

V2 solution:

- Add request validation before model invocation.
- Add redaction and response-safe summaries for tool outputs.
- Add log-safe serialization and payload truncation rules.

#### Gap F: User-scoped governance is missing

Current state:

- Generic middleware rate limiting exists elsewhere in the app.
- AI routes do not have user-level request and token budgets.

Impact:

- Expensive routes are exposed to abuse or accidental overuse.
- No basis for user fairness or cost containment.

V2 solution:

- Add AI-specific user rate limiting and token budget enforcement.
- Make limits config-driven and visible in telemetry and response headers where appropriate.

#### Gap G: Rollout and evaluation loop is missing

Current state:

- There is no formal evaluation dataset, no regression suite for prompts/tooling behavior, and no canary or shadow policy for AI changes.

Impact:

- Changes can improve one path while silently regressing another.
- Production learning remains anecdotal.

V2 solution:

- Add lightweight evaluation fixtures and scenario contracts.
- Add rollout flags and comparison telemetry for major AI behavior changes.

## 3. V2 Target Architecture

## 3.1 Architectural Principles

- Prefer Cloudflare-native coordination primitives over external infrastructure.
- Keep fast-path request handling simple inside Hono routes; move complexity into composable AI services.
- Treat cancellation, budgets, tracing, and safety as first-class concerns rather than route-local helpers.
- Separate concerns clearly:
  - control plane: config, policy, rollout, quotas
  - execution plane: model call, stream processing, tools, retries
  - observation plane: logs, traces, metrics, audits

## 3.2 Target Runtime Topology

```text
Client
  -> Hono AI Route
    -> Request Context Builder
      -> Config Snapshot
      -> Budget Snapshot
      -> Trace Context
      -> Cancellation Context
    -> AI Execution Coordinator
      -> Model Policy Router
      -> Provider Client
      -> Stream Engine V2
      -> Tool Orchestrator
      -> Safety Guardrails
    -> Telemetry Sink
      -> Structured Logs
      -> D1 Trace Records
      -> Optional Queue Export
```

## 4. Core Design Topics

### 4.1 Control Plane

The control plane should define all runtime-tunable AI policy:

- provider config
- model routing policy
- retry policy
- user quotas
- tool concurrency budget
- stream gate policy
- safety budgets
- telemetry sampling policy
- rollout flags

Design direction:

- Keep `AIConfigManager`, but evolve it into a snapshot-oriented loader.
- A request should resolve a single config snapshot once, then pass that immutable snapshot through execution.
- Avoid repeated point reads during a single request.

Why this is stronger than current state:

- Lower config drift inside a request.
- Easier testing.
- Cleaner telemetry because every request can log a config version or snapshot hash.

### 4.2 Cancellation and Lifecycle Management

V2 requires explicit request lifecycle control.

Design direction:

- Create `AIRequestContext` carrying `requestId`, `signal`, `deadline`, `userId`, `traceId`, and budgets.
- In the Hono route, bind client disconnect to an abort signal.
- Update provider fetch calls to pass `signal`.
- Update stream engine to check abort before every blocking wait and after every emitted chunk batch.
- Update tool execution path to cancel pending or queued tools.

Cloudflare compatibility:

- Works with standard `AbortController` and fetch in Workers.
- No Node-specific constructs required.

### 4.3 Tool Orchestrator V2

The orchestrator should graduate from helper function to a policy-governed subsystem.

Required abilities:

- bounded parallel execution
- per-tool timeout
- per-round timeout
- partial failure continuation
- structured tool result envelopes
- dependency-aware execution for future composite tools
- cancellation-aware execution

Recommended execution model:

- default to parallel execution for independent tool calls
- cap concurrency by config
- keep dependency DAG support optional but built into the API shape

Output contract:

- tool start
- tool success
- tool timeout
- tool failure
- tool skipped due to dependency or budget

### 4.4 Reliability: Retry, Fallback, and Circuit Policy

The current model cooldown approach should be preserved as a local optimization, but wrapped in a clearer policy stack.

Policy layers:

- request retry policy for transient provider/network failures
- model fallback policy for provider/model saturation or error classes
- lightweight circuit breaker to avoid obviously degraded models
- global and user-level retry budgets to avoid retry storms

Recommended storage split:

- in-memory state for low-latency local heuristics
- KV or Durable Object only for coordination-grade counters or cooldowns where cross-instance consistency matters

### 4.5 Observability and Traceability

V2 observability must answer:

- Which model served the request?
- Why did a model switch happen?
- When did first byte arrive?
- Which tools ran, and how long did they take?
- How many retries happened?
- Was the request cancelled, gated, blocked, truncated, or rate-limited?
- What token cost did we incur, or what estimate do we have if the provider omitted usage?

Design direction:

- Add trace and span builders
- Add durable telemetry persistence with configurable sampling
- Add a log-safe serializer for structured output

Suggested tables:

- `ai_request_traces`
- `ai_request_spans`
- `ai_request_usage_daily`

Suggested event dimensions:

- request type
- route
- user
- session
- model
- tool names
- cancellation reason
- retry count
- quota decision

### 4.6 Safety and Policy Enforcement

V2 safety must move from warning logs to enforceable policy.

Required enforcement points:

- request input text length
- image count and byte budget
- tool result size budget
- telemetry/log payload truncation
- sensitive field masking
- prompt injection signal scoring with policy outcomes

Policy outcomes:

- allow
- allow with redaction
- block with user-facing validation error
- degrade by disabling tools or images

### 4.7 User Governance and Cost Control

AI routes need explicit governance.

Required budgets:

- requests per minute
- estimated tokens per day
- optional action-capable request budgets
- optional heavier quotas for image-bearing requests

Design direction:

- store counters in KV for low-latency edge enforcement
- optionally use Durable Object if strict coordination becomes necessary
- record quota decisions into telemetry for observability

### 4.8 Evaluation and Rollout

V2 should add a minimal but real evaluation loop.

Required pieces:

- representative AI request fixtures
- expected behavioral assertions
- regression coverage for tool usage, stream sequencing, and safety policy
- rollout flags for new orchestration and guardrail behavior

This is necessary to make later AI changes safe.

## 5. V2 Phases

### Phase 0: Baseline Alignment and Deprecation Cleanup

Objective:

- mark the old plan as superseded
- document current state accurately
- freeze naming and boundaries for new modules

Deliverables:

- this V2 plan
- deprecated note in old plan
- architecture boundary map

### Phase 1: Request Context and Cancellation

Objective:

- make request lifecycle explicit and cancellable end-to-end

Scope:

- request context builder
- abort propagation through AI route, provider client, stream engine, and tool path
- cleanup semantics and cancellation telemetry

Success criteria:

- client disconnect aborts downstream fetch/tool work quickly
- cancellation reason is recorded

### Phase 2: Tool Orchestrator V2

Objective:

- move from serial tool execution to bounded, observable orchestration

Scope:

- concurrency control
- timeouts
- partial failure envelopes
- orchestration telemetry
- optional dependency API

Success criteria:

- independent tools run in parallel under configured limits
- tool timeout does not deadlock the whole request

### Phase 3: Reliability Policy Stack

Objective:

- unify retry, fallback, cooldown, and circuit policy

Scope:

- retry manager
- error classifier
- retry budgets
- shared model policy contract

Success criteria:

- transient failures use consistent retry behavior
- degraded models are avoided predictably

### Phase 4: AI Governance and Quotas

Objective:

- enforce user-level request and token budgets

Scope:

- AI-specific middleware
- KV-backed counters
- config-driven budgets
- telemetry and headers

Success criteria:

- over-budget requests fail early with actionable response metadata

### Phase 5: Observability V2

Objective:

- persist actionable traces and metrics rather than relying on console-only logs

Scope:

- trace/span model
- D1 schema
- telemetry writer
- sampling policy
- usage accounting

Success criteria:

- operators can query request outcomes, model switches, tool timings, and cancellations

### Phase 6: Safety Enforcement Layer

Objective:

- enforce validated, auditable AI safety budgets

Scope:

- input validator
- image budget validator
- redaction/masking pipeline
- safe serialization for logs and tool outputs

Success criteria:

- oversized or unsafe requests are rejected or degraded before provider invocation

### Phase 7: Evaluation and Progressive Rollout

Objective:

- make AI changes measurable and safer to ship

Scope:

- regression fixtures
- rollout flags
- canary metrics comparison

Success criteria:

- major AI behavior changes have pre-ship regression checks and controlled rollout path

## 6. Recommended File Evolution

### Keep and evolve

- `functions/ai/config-schema.js`
- `functions/ai/config-manager.js`
- `functions/ai/stream-engine.js`
- `functions/ai/telemetry.js`
- `functions/utils/ai-utils.js`
- `functions/utils/ai-tool-executor.js`
- `functions/lib/hono/routes/manage/ai.js`
- `src/components/settings/tabs/AISettings.vue`

### Likely new modules

- `functions/ai/request-context.js`
- `functions/ai/retry-manager.js`
- `functions/ai/model-policy.js`
- `functions/ai/tool-orchestrator.js`
- `functions/ai/input-validator.js`
- `functions/ai/data-masker.js`
- `functions/ai/telemetry-writer.js`
- `functions/ai/rate-limit-manager.js`
- `functions/lib/hono/middleware/ai-rate-limit.js`
- `functions/ai/log-safe-serializer.js`

### Likely new tests

- `functions/ai/__tests__/request-context.test.js`
- `functions/ai/__tests__/retry-manager.test.js`
- `functions/ai/__tests__/tool-orchestrator.test.js`
- `functions/ai/__tests__/input-validator.test.js`
- `functions/ai/__tests__/telemetry-writer.test.js`
- `functions/lib/hono/middleware/__tests__/ai-rate-limit.test.js`

## 7. Acceptance Criteria

### Functional

- Every AI request uses a single resolved config snapshot
- Client disconnect propagates cancellation through provider and tool execution
- Independent tool calls can execute in parallel under configured limits
- Retry and fallback behavior is policy-driven and test-covered
- User-scoped AI quotas are enforced
- Every sampled request has durable trace metadata
- Unsafe inputs are blocked or degraded before model invocation
- Tool outputs and telemetry are redacted safely

### Performance

- stream first-byte latency remains bounded after orchestration changes
- parallel tool rounds reduce latency for independent tool sets
- config resolution remains cheap due to snapshot caching
- cancellation reduces wasted downstream work

### Operability

- operators can query model-switch causes and cancellation reasons
- telemetry volume is controlled by sampling policy
- rollout flags can gate new AI execution behavior

## 8. Execution Order Recommendation

Recommended order:

1. request context and cancellation
2. tool orchestrator
3. reliability policy stack
4. observability v2
5. governance and quotas
6. safety enforcement
7. evaluation and rollout

Reason:

- cancellation and orchestration define the core runtime contract
- observability should land before broad rollout of more aggressive policies
- quotas and safety should build on already traceable request behavior

## 9. Compatibility Constraints

The following are non-negotiable for V2:

- Remain deployable on the current Cloudflare Workers + Hono stack
- Avoid Node-only APIs in runtime code
- Prefer Cloudflare-native persistence and coordination
- Preserve existing external API contracts unless an explicit versioning decision is made
- Evolve current modules incrementally where practical instead of replacing everything at once

## 10. Difference From the Old Plan

Compared with the superseded plan, V2 changes the strategy in several important ways:

- It starts from actual repository state instead of assuming a greenfield sequence.
- It treats cancellation, tracing, quotas, and safety as core runtime concerns, not optional add-ons.
- It upgrades tool execution from helper logic to an orchestration subsystem.
- It separates local heuristics from coordination-grade state for multi-instance Cloudflare execution.
- It adds evaluation and rollout as explicit workstreams rather than leaving them implicit.

## 11. Next Planning Output

This document is the V2 master roadmap.

The next document should be a task-by-task execution plan that implements V2 in small, test-driven increments, starting with:

- request context and cancellation
- tool orchestrator v2
- reliability policy stack

# Order Procurement Outbox Expansion Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this roadmap phase-by-phase. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the current receipt-focused transaction + outbox core into a production-grade business workflow platform that also supports notifications, webhooks, audit replay, and rollback compensation.

**Architecture:** Keep the existing rule that core domain truth is written only by command handlers inside a transaction. Expand outward in layers: first add reusable outbox delivery primitives, then external side-effect consumers, then operator-facing replay/audit tooling, and only after that add reversal and compensation commands that write new immutable facts.

**Tech Stack:** Cloudflare D1/SQLite, Hono, Vitest, repository/service layer JavaScript modules, existing outbox tables (`domain_outbox`, `outbox_consumer_jobs`)

---

## Scope Split

This work should be executed as four linked but separate phase plans:

1. Notification consumers
2. Webhook delivery consumers
3. Audit replay / operator tooling
4. Rollback compensation / reversal commands

Recommended dependency order:

1. Notifications
2. Webhooks
3. Audit replay
4. Rollback compensation

Why this order:

- notifications and webhooks reuse the outbox delivery layer already built
- replay needs stable event taxonomy and retained payload shape from earlier phases
- rollback compensation is the highest-risk business change and should only be built after observability and replay tooling exist

## Shared Principles

- Domain events remain immutable
- Consumers never mutate core truth tables
- Rollback is modeled as compensating commands and reversal facts, never delete/update-in-place history
- Every new consumer must be idempotent
- Every operator action must be traceable by `command_id`, `correlation_id`, and `event_id`

## Shared File Areas

**Existing foundation to extend**
- Modify: `functions/services/DomainOutboxDispatchService.js`
- Modify: `functions/services/DomainOutboxConsumers.js`
- Modify: `functions/api/cron/outbox.js`
- Modify: `functions/repositories/DomainOutboxRepository.js`
- Modify: `docs/DATABASE_SCHEMA.md`

**Likely new foundation files**
- Create: `functions/services/DomainEventCatalog.js`
- Create: `functions/services/OutboxConsumerMetricsService.js`
- Create: `functions/repositories/OutboxReplayRepository.js`
- Create: `functions/lib/hono/routes/manage/outbox.js`
- Create: `functions/lib/hono/routes/manage/audit-replay.js`

---

### Phase 1: Notification Consumers

**Goal:** Turn selected receipt and procurement events into internal notifications without reintroducing request-thread side effects.

**Files:**
- Modify: `functions/services/DomainOutboxConsumers.js`
- Modify: `functions/api/cron/outbox.js`
- Modify: `scripts/init-database.sql`
- Modify: `docs/DATABASE_SCHEMA.md`
- Test: `functions/services/__tests__/DomainOutboxConsumers.notifications.test.js`
- Test: `functions/api/cron/__tests__/outbox.test.js`

- [ ] Define which domain events generate notifications
- [ ] Keep initial scope narrow:
  `purchase_receipt_recorded`, `order_procurement_progressed`, future reversal events
- [ ] Decide recipient routing rules:
  admin only first, salesperson optional second step
- [ ] Write failing consumer tests for idempotent notification creation
- [ ] Run focused tests and verify failure
- [ ] Implement notification consumer branch in `DomainOutboxConsumers`
- [ ] Add replay-safe dedupe key in notification metadata
- [ ] Re-run focused tests and verify pass
- [ ] Run affected receipt/outbox regression set

**Exit criteria**
- One domain event produces at most one logical notification per recipient
- Re-delivery does not duplicate notifications
- Notification failures do not affect committed receipt truth

---

### Phase 2: Webhook Delivery Consumers

**Goal:** Publish selected domain events to external systems through durable webhook jobs with retry, signing, and delivery logs.

**Files:**
- Modify: `functions/services/DomainOutboxConsumers.js`
- Modify: `functions/services/DomainOutboxDispatchService.js`
- Modify: `functions/api/cron/outbox.js`
- Modify: `functions/lib/hono/routes/manage/webhooks.js`
- Modify: `scripts/init-database.sql`
- Modify: `docs/DATABASE_SCHEMA.md`
- Test: `functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js`
- Test: `functions/services/__tests__/DomainOutboxDispatchService.webhooks.test.js`
- Test: `functions/api/cron/__tests__/outbox.test.js`

- [ ] Define webhook event catalog and payload contract versioning
- [ ] Decide tenant/subscriber filtering rules per webhook endpoint
- [ ] Write failing tests for signed webhook publish and retry behavior
- [ ] Run focused tests and verify failure
- [ ] Implement webhook consumer handler
- [ ] Persist webhook delivery attempt metadata in existing `webhook_logs`
- [ ] Add retry classification:
  retry 5xx / network failures, do not retry 4xx contract failures by default
- [ ] Re-run focused tests and verify pass
- [ ] Run affected webhook and outbox regression set

**Exit criteria**
- Webhook publishing is fully outbox-driven
- Duplicate delivery attempts are traceable and safe
- Operators can inspect per-event delivery results

---

### Phase 3: Audit Replay / Operator Tooling

**Goal:** Give operators and developers a safe way to inspect, replay, and re-drive outbox side effects from immutable event history.

**Files:**
- Create: `functions/repositories/OutboxReplayRepository.js`
- Create: `functions/lib/hono/routes/manage/outbox.js`
- Create: `functions/lib/hono/routes/manage/audit-replay.js`
- Modify: `functions/services/DomainOutboxDispatchService.js`
- Modify: `functions/services/DomainOutboxConsumers.js`
- Test: `functions/repositories/__tests__/OutboxReplayRepository.test.js`
- Test: `functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js`
- Test: `functions/lib/hono/routes/manage/__tests__/audit-replay-routes.test.js`

- [ ] Define operator use-cases:
  inspect stuck events, replay one event, replay one command, replay one consumer
- [ ] Write failing repository tests for querying event history and consumer job state
- [ ] Run focused tests and verify failure
- [ ] Implement replay repository and read models
- [ ] Add admin routes for search/filter/detail
- [ ] Add replay route guarded by admin permission and dry-run validation
- [ ] Ensure replay only re-drives side effects, not core truth mutation
- [ ] Re-run focused tests and verify pass
- [ ] Run affected outbox/audit regression set

**Exit criteria**
- Operators can answer:
  which events were emitted, which consumers processed them, which are stuck
- Replay can target consumer side effects without rewriting domain truth
- Replay actions themselves are audited

---

### Phase 4: Rollback Compensation / Reversal Commands

**Goal:** Introduce explicit reversal commands for receipt rollback and related compensation so business recovery happens through new immutable facts instead of destructive edits.

**Files:**
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/repositories/PurchaseReceiptRepository.js`
- Modify: `functions/services/InventoryService.js`
- Modify: `functions/repositories/DomainOutboxRepository.js`
- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Modify: `scripts/init-database.sql`
- Modify: `docs/DATABASE_SCHEMA.md`
- Test: `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
- Test: `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
- Test: `functions/services/__tests__/DomainOutboxConsumers.notifications.test.js`

- [ ] Freeze reversal semantics before coding:
  full reversal only first, partial reversal second if needed
- [ ] Define reversal facts and links to original receipt / inventory event / command
- [ ] Write failing service tests for receipt reversal transaction
- [ ] Run focused tests and verify failure
- [ ] Implement compensating command that writes:
  reversal receipt fact, reversal inventory fact, order-line progress correction, outbox events
- [ ] Reject reversal when downstream invariant would be broken
- [ ] Emit explicit reversal events for notifications/webhooks/audit
- [ ] Re-run focused tests and verify pass
- [ ] Run full procurement/inventory regression set

**Exit criteria**
- No historical facts are deleted
- Reversal preserves lineage to original receipt and command
- Inventory and order projections converge through facts, not manual patching

---

## Cross-Phase Risks

- Event taxonomy drift:
  fix by introducing a small domain event catalog before phase 2
- Payload bloat / schema instability:
  freeze event versions and add explicit compatibility notes in docs
- Consumer fan-out overload:
  keep consumer count small and add per-consumer metrics before broadening scope
- Unsafe replay:
  restrict replay to side-effect consumers only until reversal commands exist
- Compensation bugs:
  do not implement rollback before replay and observability are in place

## Recommended Delivery Sequence

1. Create a dedicated detailed plan for **Phase 1 notifications**
2. Execute Phase 1 and re-run the full receipt/outbox regression suite
3. Create and execute a dedicated plan for **Phase 2 webhooks**
4. Create and execute a dedicated plan for **Phase 3 replay**
5. Create and execute a dedicated plan for **Phase 4 rollback compensation**

## Recommendation

Do **not** start with rollback compensation even though it sounds most strategic. The safer SOTA path is:

1. notifications
2. webhooks
3. replay
4. reversal / compensation

That sequence gives you external integration value early, improves observability before high-risk recovery logic, and avoids building compensations blind.

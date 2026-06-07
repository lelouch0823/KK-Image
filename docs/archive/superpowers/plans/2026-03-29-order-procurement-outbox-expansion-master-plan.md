# Order Procurement Outbox Expansion Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the outbox expansion as a long-horizon, production-grade workflow program: notifications first, then webhooks, then operator replay, and only after observability is in place, immutable reversal commands.

**Architecture:** Treat the current receipt transaction + outbox core as the stable correctness boundary. Expand it in four phases behind a shared event catalog, selective consumer fan-out, durable side-effect tracing, and strict stage gates so later phases inherit real contracts instead of assumptions.

**Tech Stack:** Cloudflare D1/SQLite, Hono, Vitest, JavaScript repository/service modules, existing `domain_outbox` and `outbox_consumer_jobs`

---

## Plan Set

- Roadmap anchor: `docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-roadmap.md`
- Phase 1 detailed plan: `docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-1-notification-consumers-plan.md`
- Phase 2 detailed plan: `docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-2-webhook-delivery-plan.md`
- Phase 3 detailed plan: `docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-3-audit-replay-plan.md`
- Phase 4 detailed plan: `docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-4-rollback-compensation-plan.md`

## Long-Term SOTA Decisions

- Centralize event definitions in `functions/services/DomainEventCatalog.js` so event versions, payload contracts, and eligible consumers do not drift by phase.
- Move consumer fan-out from "all events go to all consumers" to "each event resolves its consumers from the catalog" before adding notification or webhook branches.
- Persist notification dedupe state in first-class columns instead of metadata-only JSON so replay and redelivery remain deterministic.
- Keep webhook attempts immutable in `webhook_logs`, but make delivery idempotent by checking per-endpoint success keys before re-sending on retries.
- Treat replay as an operator command with its own persistence and audit trail; replay may re-drive side effects, but it must never write core truth tables.
- Model rollback as a new command/service that writes reversal facts linked to the original receipt, inventory event, and command lineage.

## Global Stage Gates

**Entry gate for every phase**

- Previous phase merged locally and regression suite green.
- The next phase plan has been re-read and updated against the actual previous-phase diff before coding starts.
- `docs/DATABASE_SCHEMA.md` and event contract notes are aligned with current code, not stale roadmap assumptions.

**Exit gate for every phase**

- Focused unit/integration tests for the phase pass.
- Receipt + outbox regression suite passes.
- Operator-facing routes and audit behavior are covered by tests.
- The next phase plan is refreshed before implementation begins.

### Task 1: Freeze the shared execution baseline

**Files:**

- Review: `docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-roadmap.md`
- Review: `docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-1-notification-consumers-plan.md`
- Review: `docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-2-webhook-delivery-plan.md`
- Review: `docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-3-audit-replay-plan.md`
- Review: `docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-4-rollback-compensation-plan.md`
- Verify: `functions/services/OrderProcurementDomainService.js`
- Verify: `functions/services/DomainOutboxConsumers.js`
- Verify: `functions/api/cron/outbox.js`

- [ ] **Step 1: Re-read the roadmap and all phase plans before changing code**

Run: `sed -n '1,220p' docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-roadmap.md`
Expected: the engineer can state the dependency order `notifications -> webhooks -> audit replay -> rollback compensation`

- [ ] **Step 2: Re-run the current receipt/outbox baseline tests**

Run: `pnpm test:unit functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/DomainOutboxDispatchService.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js functions/api/cron/__tests__/outbox.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
Expected: PASS before Phase 1 begins

- [ ] **Step 3: Freeze the shared event taxonomy before Phase 1 implementation**

```js
export const DOMAIN_EVENT_CATALOG = {
  purchase_receipt_recorded: { version: 1, consumers: ['audit', 'cache', 'notification'] },
  inventory_received: { version: 1, consumers: ['audit', 'cache', 'webhook'] },
  order_procurement_progressed: {
    version: 1,
    consumers: ['audit', 'cache', 'notification', 'webhook'],
  },
  purchase_receipt_reversed: {
    version: 1,
    consumers: ['audit', 'cache', 'notification', 'webhook'],
  },
};
```

- [ ] **Step 4: Update the next phase plan before each phase starts**

Run: `git diff --stat HEAD~1..HEAD docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-*.md functions/ scripts/`
Expected: the engineer knows which actual file paths and contracts changed and refreshes the next phase plan accordingly

### Task 2: Execute Phase 1 notifications

**Files:**

- Execute: `docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-1-notification-consumers-plan.md`

- [ ] **Step 1: Implement Phase 1 exactly from the dedicated plan**

Run: `sed -n '1,260p' docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-1-notification-consumers-plan.md`
Expected: complete file map, test list, and commit boundaries are clear before coding

- [ ] **Step 2: Re-run the Phase 1 regression gate**

Run: `pnpm test:unit functions/repositories/__tests__/DomainOutboxRepository.test.js functions/repositories/__tests__/NotificationRepository.domain-outbox.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/DomainOutboxConsumers.notifications.test.js functions/api/cron/__tests__/outbox.test.js`
Expected: PASS

- [ ] **Step 3: Refresh the Phase 2 plan using the Phase 1 diff**

Run: `git diff --name-only HEAD~1..HEAD`
Expected: the webhook plan reflects the real event catalog, notification schema changes, and consumer names produced by Phase 1

### Task 3: Execute Phase 2 webhooks

**Files:**

- Execute: `docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-2-webhook-delivery-plan.md`

- [ ] **Step 1: Revalidate the webhook plan against the current codebase**

Run: `sed -n '1,320p' docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-2-webhook-delivery-plan.md`
Expected: delivery-key semantics and route mount points match the current Phase 1 implementation

- [ ] **Step 2: Execute the webhook plan and close its test gate**

Run: `pnpm test:unit functions/repositories/__tests__/WebhookRepository.test.js functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js functions/services/__tests__/WebhookDeliveryService.test.js functions/api/cron/__tests__/outbox.test.js functions/lib/hono/routes/manage/__tests__/webhooks-routes.test.js functions/lib/hono/_shared/__tests__/audit-runtime-alignment.test.js`
Expected: PASS

- [ ] **Step 3: Refresh the Phase 3 plan using the new delivery contracts**

Run: `git diff --name-only HEAD~1..HEAD docs/DATABASE_SCHEMA.md scripts/init-database.sql functions/`
Expected: replay queries and operator routes reference the actual webhook log schema and consumer contracts

### Task 4: Execute Phase 3 audit replay

**Files:**

- Execute: `docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-3-audit-replay-plan.md`

- [ ] **Step 1: Revalidate replay targets after Phase 2**

Run: `sed -n '1,320p' docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-3-audit-replay-plan.md`
Expected: replay scope still targets side effects only and names the real consumers shipped in Phases 1 and 2

- [ ] **Step 2: Execute the replay plan and close its test gate**

Run: `pnpm test:unit functions/repositories/__tests__/OutboxReplayRepository.test.js functions/services/__tests__/OutboxReplayService.test.js functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js functions/lib/hono/routes/manage/__tests__/audit-replay-routes.test.js functions/lib/hono/_shared/__tests__/audit-runtime-alignment.test.js`
Expected: PASS

- [ ] **Step 3: Refresh the Phase 4 plan only after replay is auditable**

Run: `git diff --name-only HEAD~1..HEAD`
Expected: the reversal plan references the real replay-run persistence, audit hooks, and event catalog

### Task 5: Execute Phase 4 rollback compensation

**Files:**

- Execute: `docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-4-rollback-compensation-plan.md`

- [ ] **Step 1: Revalidate the reversal plan against all prior phases**

Run: `sed -n '1,360p' docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-4-rollback-compensation-plan.md`
Expected: reversal facts, replay hooks, notifications, and webhooks all reference shipped infrastructure instead of roadmap assumptions

- [ ] **Step 2: Execute the reversal plan and run the broad regression gate**

Run: `pnpm test:unit functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/DomainOutboxConsumers.notifications.test.js functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/api/cron/__tests__/outbox.test.js`
Expected: PASS

- [ ] **Step 3: Run the final program-level regression suite**

Run: `pnpm test:unit functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/DomainOutboxDispatchService.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js functions/services/__tests__/DomainOutboxConsumers.notifications.test.js functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js functions/repositories/__tests__/DomainOutboxRepository.test.js functions/repositories/__tests__/OutboxReplayRepository.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/lib/hono/routes/manage/__tests__/webhooks-routes.test.js functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js functions/lib/hono/routes/manage/__tests__/audit-replay-routes.test.js functions/api/cron/__tests__/outbox.test.js`
Expected: PASS

# Order Procurement Outbox Expansion Phase 1 Notification Consumers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn selected receipt and procurement events into replay-safe internal notifications with deterministic routing and true dedupe, without reintroducing request-thread side effects.

**Architecture:** Add a shared event catalog and move outbox consumer fan-out onto event-aware routing instead of static all-consumer fan-out. Notifications stay as side effects only, but dedupe is persisted in first-class notification columns so redelivery and future replay remain safe.

**Tech Stack:** Cloudflare D1/SQLite, Hono, Vitest, repository/service modules, existing `notifications`, `domain_outbox`, and `outbox_consumer_jobs`

---

## Pre-Execution Refresh Rule

Before coding this phase, re-read the current versions of:

- `functions/services/OrderProcurementDomainService.js`
- `functions/repositories/DomainOutboxRepository.js`
- `functions/repositories/NotificationRepository.js`
- `functions/services/DomainOutboxConsumers.js`
- `functions/api/cron/outbox.js`

If the actual Phase 0 baseline differs from this plan, update this document first, then implement.

### Task 1: Add notification source and dedupe persistence

**Files:**
- Modify: `scripts/init-database.sql`
- Modify: `docs/DATABASE_SCHEMA.md`
- Modify: `functions/repositories/NotificationRepository.js`
- Create: `functions/repositories/__tests__/NotificationRepository.domain-outbox.test.js`
- Test: `functions/repositories/__tests__/notification-repository-legacy-schema.test.js`

- [ ] **Step 1: Write the failing notification repository tests**

```js
it('creates one notification for a unique source consumer + dedupe key', async () => {});
it('returns the existing notification when the same event is replayed', async () => {});
it('falls back safely on legacy schemas without source columns', async () => {});
```

- [ ] **Step 2: Run the repository tests to verify failure**

Run: `pnpm test:unit functions/repositories/__tests__/NotificationRepository.domain-outbox.test.js functions/repositories/__tests__/notification-repository-legacy-schema.test.js`
Expected: FAIL because source columns and repository helpers do not exist yet

- [ ] **Step 3: Add schema support for source-aware notification dedupe**

```sql
ALTER TABLE notifications ADD COLUMN source_consumer TEXT;
ALTER TABLE notifications ADD COLUMN source_event_id TEXT;
ALTER TABLE notifications ADD COLUMN dedupe_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_source_dedupe
  ON notifications(source_consumer, dedupe_key, receiver, COALESCE(salesperson_id, ''));
```

- [ ] **Step 4: Add repository helpers for event-backed notifications**

```js
async createFromDomainEvent({
  type,
  title,
  content,
  link,
  receiver,
  salespersonId,
  orderId,
  metadata,
  sourceConsumer,
  sourceEventId,
  dedupeKey,
}) {}
```

- [ ] **Step 5: Re-run the repository tests**

Run: `pnpm test:unit functions/repositories/__tests__/NotificationRepository.domain-outbox.test.js functions/repositories/__tests__/notification-repository-legacy-schema.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/init-database.sql docs/DATABASE_SCHEMA.md functions/repositories/NotificationRepository.js functions/repositories/__tests__/NotificationRepository.domain-outbox.test.js functions/repositories/__tests__/notification-repository-legacy-schema.test.js
git commit -m "feat: persist replay-safe notification dedupe metadata"
```

### Task 2: Introduce an event catalog and selective outbox fan-out

**Files:**
- Create: `functions/services/DomainEventCatalog.js`
- Modify: `functions/repositories/DomainOutboxRepository.js`
- Modify: `functions/services/OrderProcurementDomainService.js`
- Create: `functions/repositories/__tests__/DomainOutboxRepository.event-catalog.test.js`
- Test: `functions/repositories/__tests__/DomainOutboxRepository.test.js`
- Test: `functions/services/__tests__/OrderProcurementDomainService.test.js`

- [ ] **Step 1: Write failing tests for event-aware consumer fan-out**

```js
it('fans out only the consumers declared by the event catalog', async () => {});
it('keeps audit/cache on existing receipt events and adds notification only where declared', async () => {});
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `pnpm test:unit functions/repositories/__tests__/DomainOutboxRepository.event-catalog.test.js functions/repositories/__tests__/DomainOutboxRepository.test.js functions/services/__tests__/OrderProcurementDomainService.test.js`
Expected: FAIL because the outbox repository still receives one static consumer list for every event

- [ ] **Step 3: Add the catalog and move fan-out resolution onto event definitions**

```js
export const DOMAIN_EVENT_CATALOG = {
  purchase_receipt_recorded: {
    version: 1,
    consumers: ['audit', 'cache', 'notification'],
  },
  inventory_received: {
    version: 1,
    consumers: ['audit', 'cache'],
  },
  order_procurement_progressed: {
    version: 1,
    consumers: ['audit', 'cache', 'notification'],
  },
};
```

```js
buildInsertStatements(events = [], resolveConsumers = () => []) {
  for (const event of events) {
    const consumerNames = resolveConsumers(event);
    // insert event row, then one consumer job per resolved consumer
  }
}
```

- [ ] **Step 4: Update the receipt command to use the catalog**

```js
const outboxStatements = this.domainOutboxRepo.buildInsertStatements(
  outboxEvents,
  (event) => getDomainEventDefinition(event.event_type).consumers
);
```

- [ ] **Step 5: Re-run the focused tests**

Run: `pnpm test:unit functions/repositories/__tests__/DomainOutboxRepository.event-catalog.test.js functions/repositories/__tests__/DomainOutboxRepository.test.js functions/services/__tests__/OrderProcurementDomainService.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/services/DomainEventCatalog.js functions/repositories/DomainOutboxRepository.js functions/services/OrderProcurementDomainService.js functions/repositories/__tests__/DomainOutboxRepository.event-catalog.test.js functions/repositories/__tests__/DomainOutboxRepository.test.js functions/services/__tests__/OrderProcurementDomainService.test.js
git commit -m "feat: route outbox consumers through domain event catalog"
```

### Task 3: Implement notification outbox consumers and admin-first routing

**Files:**
- Modify: `functions/services/DomainOutboxConsumers.js`
- Modify: `functions/api/cron/outbox.js`
- Create: `functions/services/__tests__/DomainOutboxConsumers.notifications.test.js`
- Modify: `functions/api/cron/__tests__/outbox.test.js`

- [ ] **Step 1: Write the failing notification consumer tests**

```js
it('creates one admin notification from purchase_receipt_recorded', async () => {});
it('creates one admin notification from order_procurement_progressed', async () => {});
it('does not duplicate notifications when the same event is retried or replayed', async () => {});
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `pnpm test:unit functions/services/__tests__/DomainOutboxConsumers.notifications.test.js functions/api/cron/__tests__/outbox.test.js`
Expected: FAIL because the `notification` consumer does not exist

- [ ] **Step 3: Add a `notification` consumer that writes through the repository helper**

```js
async function notifyOutboxEvent({ db, event }) {
  const payload = parsePayload(event);
  const repo = new NotificationRepository(db);
  return repo.createFromDomainEvent({
    type: 'order',
    title: JSON.stringify({ key: 'notification.purchase_receipt_recorded' }),
    receiver: 'admin',
    orderId: payload.order_id || null,
    metadata: { eventType: event.event_type, payload },
    sourceConsumer: 'notification',
    sourceEventId: event.event_id,
    dedupeKey: `${event.event_type}:${event.event_id}:admin`,
  });
}
```

- [ ] **Step 4: Activate the consumer in the cron poller**

```js
const ACTIVE_CONSUMERS = ['audit', 'cache', 'notification'];
```

- [ ] **Step 5: Re-run the focused tests**

Run: `pnpm test:unit functions/services/__tests__/DomainOutboxConsumers.notifications.test.js functions/api/cron/__tests__/outbox.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/services/DomainOutboxConsumers.js functions/api/cron/outbox.js functions/services/__tests__/DomainOutboxConsumers.notifications.test.js functions/api/cron/__tests__/outbox.test.js
git commit -m "feat: add outbox-driven procurement notifications"
```

### Task 4: Close the phase with receipt/outbox regressions

**Files:**
- Verify: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Verify: `functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js`
- Verify: `functions/services/__tests__/DomainOutboxConsumers.notifications.test.js`
- Verify: `functions/api/cron/__tests__/outbox.test.js`
- Verify: `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`

- [ ] **Step 1: Run the full Phase 1 regression gate**

Run: `pnpm test:unit functions/repositories/__tests__/NotificationRepository.domain-outbox.test.js functions/repositories/__tests__/notification-repository-legacy-schema.test.js functions/repositories/__tests__/DomainOutboxRepository.event-catalog.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js functions/services/__tests__/DomainOutboxConsumers.notifications.test.js functions/api/cron/__tests__/outbox.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
Expected: PASS

- [ ] **Step 2: Update docs if payloads or consumer names drifted during implementation**

```md
purchase_receipt_recorded -> audit, cache, notification
inventory_received -> audit, cache
order_procurement_progressed -> audit, cache, notification
```

- [ ] **Step 3: Commit**

```bash
git add docs/DATABASE_SCHEMA.md functions/services/DomainEventCatalog.js functions/services/DomainOutboxConsumers.js functions/api/cron/outbox.js functions/repositories/NotificationRepository.js
git commit -m "chore: close notification consumer phase"
```

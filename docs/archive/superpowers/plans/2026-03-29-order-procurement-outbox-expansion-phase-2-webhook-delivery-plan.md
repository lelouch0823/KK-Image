# Order Procurement Outbox Expansion Phase 2 Webhook Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish selected procurement domain events to subscribed external endpoints through replay-safe, signed, traceable webhook delivery.

**Architecture:** Reuse the shared event catalog and outbox poller, but make webhook delivery endpoint-aware and idempotent. Each retry checks immutable `webhook_logs` for already-succeeded delivery keys so repeated outbox attempts do not resend to endpoints that already accepted the event.

**Tech Stack:** Cloudflare D1/SQLite, Hono, Vitest, fetch, HMAC signing, existing `webhooks` and `webhook_logs`

---

## Pre-Execution Refresh Rule

Before coding this phase, refresh this document against:

- the shipped `functions/services/DomainEventCatalog.js`
- the actual `notification` consumer name and cron poller setup from Phase 1
- the current `webhooks` route strategy in `functions/lib/hono/app.js`

If those differ, update this plan before implementation.

### Task 1: Add manage-side webhook persistence and route ownership

**Files:**

- Create: `functions/repositories/WebhookRepository.js`
- Create: `functions/lib/hono/routes/manage/webhooks.js`
- Modify: `functions/lib/hono/app.js`
- Create: `functions/repositories/__tests__/WebhookRepository.test.js`
- Create: `functions/lib/hono/routes/manage/__tests__/webhooks-routes.test.js`
- Verify: `functions/lib/hono/routes/v1/webhooks.js`

- [ ] **Step 1: Write failing repository and route tests**

```js
it('lists active webhook endpoints subscribed to a domain event type', async () => {});
it('creates and updates manage webhook configs under /api/manage/webhooks', async () => {});
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `pnpm test:unit functions/repositories/__tests__/WebhookRepository.test.js functions/lib/hono/routes/manage/__tests__/webhooks-routes.test.js`
Expected: FAIL because the repository and manage route do not exist

- [ ] **Step 3: Create a repository-backed manage route**

```js
export class WebhookRepository {
  async listActiveByEvent(eventType) {}
  async create(input) {}
  async update(id, input) {}
  async logAttempt(input) {}
}
```

```js
app.get('/', requirePermission('webhooks:read'), async (c) => {});
app.post('/', requirePermission('webhooks:write'), async (c) => {});
app.put('/:id', requirePermission('webhooks:write'), async (c) => {});
app.post('/:id/test', requirePermission('webhooks:write'), async (c) => {});
```

- [ ] **Step 4: Mount the manage route without removing the legacy v1 route yet**

```js
app.route('/api/manage/webhooks', manageWebhooksRoutes);
```

- [ ] **Step 5: Re-run the focused tests**

Run: `pnpm test:unit functions/repositories/__tests__/WebhookRepository.test.js functions/lib/hono/routes/manage/__tests__/webhooks-routes.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/repositories/WebhookRepository.js functions/lib/hono/routes/manage/webhooks.js functions/lib/hono/app.js functions/repositories/__tests__/WebhookRepository.test.js functions/lib/hono/routes/manage/__tests__/webhooks-routes.test.js
git commit -m "feat: add manage webhook repository and routes"
```

### Task 2: Extend webhook logs for idempotent delivery tracing

**Files:**

- Modify: `scripts/init-database.sql`
- Modify: `docs/DATABASE_SCHEMA.md`
- Modify: `functions/repositories/WebhookRepository.js`
- Test: `functions/repositories/__tests__/WebhookRepository.test.js`

- [ ] **Step 1: Write failing persistence tests for delivery keys and retry visibility**

```js
it('stores immutable webhook attempts with delivery_key and attempt_number', async () => {});
it('detects that an endpoint has already succeeded for a delivery key', async () => {});
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `pnpm test:unit functions/repositories/__tests__/WebhookRepository.test.js`
Expected: FAIL because `webhook_logs` does not yet expose the required columns or queries

- [ ] **Step 3: Extend `webhook_logs` for durable delivery tracing**

```sql
ALTER TABLE webhook_logs ADD COLUMN event_id TEXT;
ALTER TABLE webhook_logs ADD COLUMN delivery_key TEXT;
ALTER TABLE webhook_logs ADD COLUMN attempt_number INTEGER;
ALTER TABLE webhook_logs ADD COLUMN classification TEXT;
ALTER TABLE webhook_logs ADD COLUMN next_retry_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_webhook_logs_delivery_key ON webhook_logs(delivery_key, webhook_id, success, created_at DESC);
```

- [ ] **Step 4: Add repository queries that skip already-succeeded endpoints**

```js
async hasSuccessfulDelivery(webhookId, deliveryKey) {}
async getLatestAttempt(webhookId, deliveryKey) {}
async logAttempt({ webhookId, eventId, deliveryKey, attemptNumber, classification, success }) {}
```

- [ ] **Step 5: Re-run the focused tests**

Run: `pnpm test:unit functions/repositories/__tests__/WebhookRepository.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/init-database.sql docs/DATABASE_SCHEMA.md functions/repositories/WebhookRepository.js functions/repositories/__tests__/WebhookRepository.test.js
git commit -m "feat: add durable webhook delivery tracing"
```

### Task 3: Implement the outbox webhook consumer and retry classifier

**Files:**

- Create: `functions/services/WebhookDeliveryService.js`
- Modify: `functions/services/DomainEventCatalog.js`
- Modify: `functions/services/DomainOutboxConsumers.js`
- Modify: `functions/api/cron/outbox.js`
- Create: `functions/services/__tests__/WebhookDeliveryService.test.js`
- Create: `functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js`
- Modify: `functions/api/cron/__tests__/outbox.test.js`

- [ ] **Step 1: Write failing consumer and delivery tests**

```js
it('signs and sends subscribed webhook payloads for supported domain events', async () => {});
it('skips endpoints that already succeeded for the same delivery key', async () => {});
it('retries network and 5xx failures but treats 4xx as terminal contract failures', async () => {});
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `pnpm test:unit functions/services/__tests__/WebhookDeliveryService.test.js functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js functions/api/cron/__tests__/outbox.test.js`
Expected: FAIL because no webhook outbox consumer exists

- [ ] **Step 3: Add a dedicated delivery service and consumer branch**

```js
export class WebhookDeliveryService {
  async deliverDomainEvent(event) {
    const endpoints = await this.webhookRepo.listActiveByEvent(event.event_type);
    for (const endpoint of endpoints) {
      const deliveryKey = `${event.event_id}:${endpoint.id}:v1`;
      if (await this.webhookRepo.hasSuccessfulDelivery(endpoint.id, deliveryKey)) continue;
      // sign, send, classify, log
    }
  }
}
```

```js
export const DOMAIN_OUTBOX_CONSUMERS = {
  audit,
  cache,
  notification,
  webhook,
};
```

- [ ] **Step 4: Add webhook eligibility to the event catalog**

```js
order_procurement_progressed: {
  version: 1,
  consumers: ['audit', 'cache', 'notification', 'webhook'],
},
purchase_receipt_recorded: {
  version: 1,
  consumers: ['audit', 'cache', 'notification', 'webhook'],
},
```

- [ ] **Step 5: Re-run the focused tests**

Run: `pnpm test:unit functions/services/__tests__/WebhookDeliveryService.test.js functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js functions/api/cron/__tests__/outbox.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/services/WebhookDeliveryService.js functions/services/DomainEventCatalog.js functions/services/DomainOutboxConsumers.js functions/api/cron/outbox.js functions/services/__tests__/WebhookDeliveryService.test.js functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js functions/api/cron/__tests__/outbox.test.js
git commit -m "feat: deliver procurement domain events via outbox webhooks"
```

### Task 4: Close the phase with route and audit regression coverage

**Files:**

- Verify: `functions/lib/hono/routes/manage/__tests__/webhooks-routes.test.js`
- Verify: `functions/lib/hono/_shared/__tests__/audit-runtime-alignment.test.js`
- Verify: `functions/services/__tests__/DomainOutboxConsumers.notifications.test.js`
- Verify: `functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js`

- [ ] **Step 1: Run the full Phase 2 regression gate**

Run: `pnpm test:unit functions/repositories/__tests__/WebhookRepository.test.js functions/services/__tests__/WebhookDeliveryService.test.js functions/services/__tests__/DomainOutboxConsumers.notifications.test.js functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js functions/api/cron/__tests__/outbox.test.js functions/lib/hono/routes/manage/__tests__/webhooks-routes.test.js functions/lib/hono/_shared/__tests__/audit-runtime-alignment.test.js`
Expected: PASS

- [ ] **Step 2: Update docs to freeze webhook payload contract versioning**

```md
Webhook envelope v1:

- event_id
- event_type
- event_version
- occurred_at
- aggregate
- payload
```

- [ ] **Step 3: Commit**

```bash
git add docs/DATABASE_SCHEMA.md functions/services/DomainEventCatalog.js functions/services/WebhookDeliveryService.js functions/lib/hono/routes/manage/webhooks.js
git commit -m "chore: close webhook delivery phase"
```

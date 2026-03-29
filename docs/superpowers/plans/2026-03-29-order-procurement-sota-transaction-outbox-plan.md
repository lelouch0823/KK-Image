# Order Procurement SOTA Transaction + Outbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make purchase receipt recording transaction-safe, idempotent, and event-driven with durable outbox delivery for audit and cache side effects.

**Architecture:** Introduce dedicated command-idempotency and outbox tables, refactor receipt handling into a single transaction-oriented write set, and fan out audit/cache side effects through per-consumer jobs. Keep the scope narrow: only receipt flows adopt the new outbox model in this phase, while existing route-local behavior is migrated only where needed for this flow.

**Tech Stack:** Cloudflare D1/SQLite, Hono, Vitest, repository/service layer JavaScript modules

---

## File Map

**Schema / persistence**
- Modify: `scripts/init-database.sql`
- Create: `migrations/0055_command_idempotency_and_outbox.sql`
- Modify: `docs/DATABASE_SCHEMA.md`

**Receipt command and supporting repositories**
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/repositories/PurchaseReceiptRepository.js`
- Modify: `functions/services/InventoryService.js`
- Create: `functions/repositories/CommandIdempotencyRepository.js`
- Create: `functions/repositories/DomainOutboxRepository.js`
- Test: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Test: `functions/repositories/__tests__/CommandIdempotencyRepository.test.js`
- Test: `functions/repositories/__tests__/DomainOutboxRepository.test.js`

**Outbox consumers / delivery**
- Create: `functions/services/DomainOutboxDispatchService.js`
- Create: `functions/services/DomainOutboxConsumers.js`
- Create: `functions/api/cron/outbox.js`
- Modify: `functions/api/[[route]].js`
- Test: `functions/services/__tests__/DomainOutboxDispatchService.test.js`
- Test: `functions/api/cron/__tests__/outbox.test.js`

**Audit + cache integration**
- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Modify: `functions/lib/hono/_shared/audit-helpers.js`
- Create: `functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`

### Task 1: Add Command Idempotency and Outbox Schema

**Files:**
- Create: `migrations/0055_command_idempotency_and_outbox.sql`
- Modify: `scripts/init-database.sql`
- Modify: `docs/DATABASE_SCHEMA.md`
- Test: `scripts/__tests__/check-migration-prefixes.test.js`
- Test: `scripts/__tests__/init-database-bootstrap-consistency.test.js`

- [ ] **Step 1: Write the failing schema assertions**

```js
expect(sql).toContain('CREATE TABLE IF NOT EXISTS command_idempotency');
expect(sql).toContain('CREATE TABLE IF NOT EXISTS domain_outbox');
expect(sql).toContain('CREATE TABLE IF NOT EXISTS outbox_consumer_jobs');
```

- [ ] **Step 2: Run schema tests to verify failure**

Run: `pnpm test:unit scripts/__tests__/check-migration-prefixes.test.js scripts/__tests__/init-database-bootstrap-consistency.test.js`
Expected: FAIL because the new migration / bootstrap tables do not exist yet

- [ ] **Step 3: Add the migration and bootstrap schema**

```sql
CREATE TABLE IF NOT EXISTS command_idempotency (...);
CREATE TABLE IF NOT EXISTS domain_outbox (...);
CREATE TABLE IF NOT EXISTS outbox_consumer_jobs (...);
```

- [ ] **Step 4: Update schema docs**

```md
| `command_idempotency` | durable receipt command dedupe and replay-safe response storage |
| `domain_outbox` | immutable domain facts emitted in the same transaction as receipt writes |
| `outbox_consumer_jobs` | per-consumer delivery and retry state |
```

- [ ] **Step 5: Re-run schema tests**

Run: `pnpm test:unit scripts/__tests__/check-migration-prefixes.test.js scripts/__tests__/init-database-bootstrap-consistency.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add migrations/0055_command_idempotency_and_outbox.sql scripts/init-database.sql docs/DATABASE_SCHEMA.md scripts/__tests__/check-migration-prefixes.test.js scripts/__tests__/init-database-bootstrap-consistency.test.js
git commit -m "feat: add receipt command idempotency and outbox schema"
```

### Task 2: Add Repositories for Command Idempotency and Outbox

**Files:**
- Create: `functions/repositories/CommandIdempotencyRepository.js`
- Create: `functions/repositories/DomainOutboxRepository.js`
- Test: `functions/repositories/__tests__/CommandIdempotencyRepository.test.js`
- Test: `functions/repositories/__tests__/DomainOutboxRepository.test.js`

- [ ] **Step 1: Write failing repository tests**

```js
it('creates or loads a scoped receipt command idempotency record', async () => {});
it('appends outbox events and fan-out consumer jobs in one call', async () => {});
```

- [ ] **Step 2: Run repository tests to verify failure**

Run: `pnpm test:unit functions/repositories/__tests__/CommandIdempotencyRepository.test.js functions/repositories/__tests__/DomainOutboxRepository.test.js`
Expected: FAIL because the repositories do not exist

- [ ] **Step 3: Implement minimal repositories**

```js
export class CommandIdempotencyRepository {
  async reserveReceiptCommand(scopeKey, idempotencyKey, fingerprint) {}
  async finalizeCommand(commandId, responseJson, status) {}
}
```

```js
export class DomainOutboxRepository {
  buildInsertStatements(events, consumerNames) {}
}
```

- [ ] **Step 4: Re-run repository tests**

Run: `pnpm test:unit functions/repositories/__tests__/CommandIdempotencyRepository.test.js functions/repositories/__tests__/DomainOutboxRepository.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/repositories/CommandIdempotencyRepository.js functions/repositories/DomainOutboxRepository.js functions/repositories/__tests__/CommandIdempotencyRepository.test.js functions/repositories/__tests__/DomainOutboxRepository.test.js
git commit -m "feat: add receipt idempotency and outbox repositories"
```

### Task 3: Refactor Receipt Recording Into One Transactional Command

**Files:**
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/repositories/PurchaseReceiptRepository.js`
- Modify: `functions/services/InventoryService.js`
- Test: `functions/services/__tests__/OrderProcurementDomainService.test.js`

- [ ] **Step 1: Write failing transactional receipt tests**

```js
it('commits purchase item, receipt, inventory, order progress, and outbox in one transaction batch', async () => {});
it('stores and replays the original response for the same purchase_order_id + idempotency_key', async () => {});
it('rejects the same idempotency key when the request fingerprint changes', async () => {});
```

- [ ] **Step 2: Run service tests to verify failure**

Run: `pnpm test:unit functions/services/__tests__/OrderProcurementDomainService.test.js`
Expected: FAIL because receipt recording is still imperative and not transaction-wrapped

- [ ] **Step 3: Add statement-builder support for receipt and inventory writes**

```js
createInsertStatement(payload) { return this.db.prepare(...).bind(...); }
buildMutationStatements(payload) { return [updateBalanceStmt, insertLedgerStmt, insertEventStmt]; }
```

- [ ] **Step 4: Refactor the receipt command to assemble one atomic write set**

```js
const stmts = [
  reserveCommandStmt,
  reserveReceiptCapacityStmt,
  receiptInsertStmt,
  ...inventoryStatements,
  orderLineUpdateStmt,
  orderProcurementUpdateStmt,
  ...outboxStatements,
  finalizeCommandStmt,
];
await this.db.batch(stmts);
```

- [ ] **Step 5: Re-run focused service tests**

Run: `pnpm test:unit functions/services/__tests__/OrderProcurementDomainService.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/services/OrderProcurementDomainService.js functions/repositories/PurchaseReceiptRepository.js functions/services/InventoryService.js functions/services/__tests__/OrderProcurementDomainService.test.js
git commit -m "feat: transaction-wrap purchase receipt command"
```

### Task 4: Add Outbox Dispatch Service and Claim/Lease Logic

**Files:**
- Create: `functions/services/DomainOutboxDispatchService.js`
- Test: `functions/services/__tests__/DomainOutboxDispatchService.test.js`

- [ ] **Step 1: Write failing dispatch tests**

```js
it('claims pending jobs with a lease and skips already leased jobs', async () => {});
it('reclaims stale processing jobs after lease expiry', async () => {});
it('marks jobs published or failed with retry backoff', async () => {});
```

- [ ] **Step 2: Run dispatch tests to verify failure**

Run: `pnpm test:unit functions/services/__tests__/DomainOutboxDispatchService.test.js`
Expected: FAIL because the dispatch service does not exist

- [ ] **Step 3: Implement minimal lease-based dispatcher**

```js
export class DomainOutboxDispatchService {
  async claimJobs(consumerName, workerId, nowTs) {}
  async markPublished(jobId, nowTs) {}
  async markFailed(jobId, error, nowTs) {}
}
```

- [ ] **Step 4: Re-run dispatch tests**

Run: `pnpm test:unit functions/services/__tests__/DomainOutboxDispatchService.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/services/DomainOutboxDispatchService.js functions/services/__tests__/DomainOutboxDispatchService.test.js
git commit -m "feat: add lease-based outbox job dispatcher"
```

### Task 5: Add Audit and Cache Consumers

**Files:**
- Create: `functions/services/DomainOutboxConsumers.js`
- Modify: `functions/lib/hono/_shared/audit-helpers.js`
- Test: `functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js`

- [ ] **Step 1: Write failing consumer tests**

```js
it('writes audit logs from purchase receipt domain events', async () => {});
it('invalidates purchase-order, order, and goods-overview caches idempotently', async () => {});
```

- [ ] **Step 2: Run consumer tests to verify failure**

Run: `pnpm test:unit functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js`
Expected: FAIL because no consumers exist

- [ ] **Step 3: Implement audit and cache consumer handlers**

```js
export const DOMAIN_OUTBOX_CONSUMERS = {
  audit_log: async ({ event, db }) => {},
  cache_invalidation: async ({ event, env }) => {},
};
```

- [ ] **Step 4: Re-run consumer tests**

Run: `pnpm test:unit functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/services/DomainOutboxConsumers.js functions/lib/hono/_shared/audit-helpers.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js
git commit -m "feat: add audit and cache outbox consumers"
```

### Task 6: Add Outbox Poller Endpoint and Wire Runtime Entry

**Files:**
- Create: `functions/api/cron/outbox.js`
- Modify: `functions/api/[[route]].js`
- Test: `functions/api/cron/__tests__/outbox.test.js`

- [ ] **Step 1: Write the failing cron test**

```js
it('runs the outbox poller and returns processed counts', async () => {});
```

- [ ] **Step 2: Run cron tests to verify failure**

Run: `pnpm test:unit functions/api/cron/__tests__/outbox.test.js`
Expected: FAIL because the endpoint is missing

- [ ] **Step 3: Implement the poller endpoint**

```js
export default async function handler(context) {
  const processed = await dispatchPendingOutboxJobs(...);
  return json({ success: true, processed });
}
```

- [ ] **Step 4: Re-run cron tests**

Run: `pnpm test:unit functions/api/cron/__tests__/outbox.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/api/cron/outbox.js functions/api/[[route]].js functions/api/cron/__tests__/outbox.test.js
git commit -m "feat: add receipt outbox cron poller"
```

### Task 7: Update Receipt Route Integration for Idempotency and Side-Effect Handoff

**Files:**
- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`

- [ ] **Step 1: Write failing route tests**

```js
it('requires or derives an idempotency key for receipt commands', async () => {});
it('returns the stored response when the same receipt command is retried', async () => {});
it('stops direct audit side effects for receipt creation and relies on outbox delivery', async () => {});
```

- [ ] **Step 2: Run route tests to verify failure**

Run: `pnpm test:unit functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
Expected: FAIL because the route does not pass idempotency context and still triggers direct receipt audit side effects

- [ ] **Step 3: Update the route to pass command metadata only**

```js
const idempotencyKey = c.req.header('Idempotency-Key') || crypto.randomUUID();
const result = await domain.recordPurchaseOrderReceipts(poId, body, { idempotencyKey, actor: ... });
```

- [ ] **Step 4: Re-run route tests**

Run: `pnpm test:unit functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/purchase-orders.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js
git commit -m "feat: pass receipt idempotency context through route"
```

### Task 8: Full Regression Pass

**Files:**
- Verify only: all files above plus existing order/procurement regression coverage

- [ ] **Step 1: Run focused new-suite coverage**

Run: `pnpm test:unit functions/repositories/__tests__/CommandIdempotencyRepository.test.js functions/repositories/__tests__/DomainOutboxRepository.test.js functions/services/__tests__/DomainOutboxDispatchService.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js functions/api/cron/__tests__/outbox.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
Expected: PASS

- [ ] **Step 2: Run full receipt/order/procurement regression**

Run: `pnpm test:unit scripts/__tests__/backfill-order-lines.test.js scripts/__tests__/check-migration-prefixes.test.js scripts/__tests__/init-database-bootstrap-consistency.test.js functions/repositories/__tests__/order-mutations.test.js functions/repositories/__tests__/order-inventory-flow.test.js functions/repositories/__tests__/order-helpers.procurement-status.test.js functions/repositories/__tests__/order-queries.display-model.test.js functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js functions/repositories/__tests__/PurchaseOrderRepository.read-model.test.js functions/services/__tests__/OrderStatusProjectionService.test.js functions/services/__tests__/InventoryProjectionService.test.js functions/services/__tests__/DemandService.test.js functions/services/__tests__/DemandReservationProjection.test.js functions/services/__tests__/InventoryService.test.js functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/lib/hono/routes/_shared/__tests__/variant-replenishment.test.js functions/repositories/__tests__/CommandIdempotencyRepository.test.js functions/repositories/__tests__/DomainOutboxRepository.test.js functions/services/__tests__/DomainOutboxDispatchService.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js functions/api/cron/__tests__/outbox.test.js`
Expected: PASS with zero failed tests

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: harden purchase receipts with transactional outbox delivery"
```

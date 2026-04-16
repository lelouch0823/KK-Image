# Order Procurement Outbox Expansion Phase 4 Rollback Compensation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce explicit receipt reversal commands so business recovery happens by writing new immutable facts and side effects, never by deleting or mutating historical truth.

**Architecture:** Implement reversal as a new command/service with its own idempotency scope and lineage links back to the original receipt, inventory event, and domain command. Reversal writes new receipt-reversal facts, inventory compensation facts, procurement projection corrections, and reversal events that flow through the same notification/webhook/replay infrastructure.

**Tech Stack:** Cloudflare D1/SQLite, Hono, Vitest, repository/service modules, existing receipt, inventory, outbox, and replay infrastructure

---

## Pre-Execution Refresh Rule

Before coding this phase, refresh this document against the shipped outputs of Phases 1-3:

- `functions/services/DomainEventCatalog.js`
- `functions/services/OutboxReplayService.js`
- `functions/repositories/OutboxReplayRepository.js`
- `functions/repositories/PurchaseReceiptRepository.js`
- `functions/services/InventoryService.js`
- `functions/lib/hono/routes/manage/purchase-orders.js`

Do not start reversal work until replay and side-effect observability are actually present.

### Task 1: Add immutable reversal persistence and lineage links

**Files:**
- Modify: `scripts/init-database.sql`
- Modify: `docs/DATABASE_SCHEMA.md`
- Modify: `functions/repositories/PurchaseReceiptRepository.js`
- Modify: `functions/services/DomainEventCatalog.js`
- Create: `functions/repositories/__tests__/PurchaseReceiptRepository.reversal.test.js`
- Test: `functions/repositories/__tests__/PurchaseReceiptRepository.test.js`

- [ ] **Step 1: Write failing persistence tests for receipt reversals**

```js
it('stores a reversal fact linked to the original receipt and command lineage', async () => {});
it('rejects duplicate reversal records for the same reversal command idempotency key', async () => {});
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `pnpm test:unit functions/repositories/__tests__/PurchaseReceiptRepository.reversal.test.js functions/repositories/__tests__/PurchaseReceiptRepository.test.js`
Expected: FAIL because reversal persistence does not exist

- [ ] **Step 3: Add immutable reversal tables and event definitions**

```sql
CREATE TABLE IF NOT EXISTS purchase_receipt_reversals (
  id TEXT PRIMARY KEY,
  original_receipt_id TEXT NOT NULL,
  purchase_order_id TEXT NOT NULL,
  purchase_order_item_id TEXT,
  reversal_qty INTEGER NOT NULL,
  reason TEXT,
  command_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (original_receipt_id) REFERENCES purchase_receipts(id)
);
```

```js
purchase_receipt_reversed: { version: 1, consumers: ['audit', 'cache', 'notification', 'webhook'] },
inventory_receipt_reversed: { version: 1, consumers: ['audit', 'cache', 'webhook'] },
order_procurement_reversed: { version: 1, consumers: ['audit', 'cache', 'notification', 'webhook'] },
```

- [ ] **Step 4: Add repository statement builders for reversal facts**

```js
createReversalInsertStatement(payload) {}
findReceiptWithLineage(receiptId) {}
```

- [ ] **Step 5: Re-run the focused tests**

Run: `pnpm test:unit functions/repositories/__tests__/PurchaseReceiptRepository.reversal.test.js functions/repositories/__tests__/PurchaseReceiptRepository.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/init-database.sql docs/DATABASE_SCHEMA.md functions/repositories/PurchaseReceiptRepository.js functions/services/DomainEventCatalog.js functions/repositories/__tests__/PurchaseReceiptRepository.reversal.test.js functions/repositories/__tests__/PurchaseReceiptRepository.test.js
git commit -m "feat: add immutable purchase receipt reversal facts"
```

### Task 2: Implement reversal as a dedicated domain service

**Files:**
- Create: `functions/services/OrderProcurementReceiptReversalService.js`
- Modify: `functions/services/InventoryService.js`
- Modify: `functions/repositories/DomainOutboxRepository.js`
- Create: `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
- Verify: `functions/services/__tests__/OrderProcurementDomainService.test.js`

- [ ] **Step 1: Write failing reversal service tests**

```js
it('writes reversal receipt facts, inventory compensation, order projection correction, and outbox events in one transaction', async () => {});
it('rejects reversal when downstream invariants would be broken', async () => {});
it('replays the original reversal response for the same reversal idempotency key', async () => {});
```

- [ ] **Step 2: Run the focused service tests to verify failure**

Run: `pnpm test:unit functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
Expected: FAIL because the reversal service does not exist

- [ ] **Step 3: Add reversal-aware inventory and outbox builders**

```js
await this.inventoryService.buildMutationStatements({
  type: 'inventory_adjusted_reversal',
  quantityDelta: -reversalQty,
  purchaseReceiptId: originalReceipt.id,
  referenceType: 'purchase_receipt_reversal',
  referenceId: reversalId,
});
```

```js
const outboxEvents = [
  { event_type: 'purchase_receipt_reversed', ... },
  { event_type: 'inventory_receipt_reversed', ... },
  { event_type: 'order_procurement_reversed', ... },
];
```

- [ ] **Step 4: Implement the dedicated reversal command**

```js
export class OrderProcurementReceiptReversalService {
  async reverseReceipt(poId, receiptId, payload, options = {}) {
    // reserve reversal idempotency, validate lineage, write reversal facts, write inventory compensation,
    // correct procurement projections, append reversal outbox events, finalize idempotency
  }
}
```

- [ ] **Step 5: Re-run the focused service tests**

Run: `pnpm test:unit functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/services/OrderProcurementReceiptReversalService.js functions/services/InventoryService.js functions/repositories/DomainOutboxRepository.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js
git commit -m "feat: add transactional purchase receipt reversal command"
```

### Task 3: Expose reversal through the manage purchase-orders route

**Files:**
- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
- Test: `functions/lib/hono/_shared/__tests__/audit-runtime-alignment.test.js`

- [ ] **Step 1: Write failing route tests for reversal**

```js
it('reverses a receipt through POST /:id/receipts/:receiptId/reversal and returns 201', async () => {});
it('passes Idempotency-Key through to the reversal service', async () => {});
it('returns 400 when the reversal command is rejected by domain invariants', async () => {});
```

- [ ] **Step 2: Run focused route tests to verify failure**

Run: `pnpm test:unit functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
Expected: FAIL because the route and reversal service wiring do not exist

- [ ] **Step 3: Add the route and audit contract**

```js
app.post('/:id/receipts/:receiptId/reversal', async (c) => {
  const result = await reversalService.reverseReceipt(poId, receiptId, body, { idempotencyKey });
  c.executionCtx.waitUntil(runOutboxPoller({ env: c.env, requestUrl: c.req.url, workerId: `reversal:${poId}:${receiptId}` }));
  return c.json({ success: true, data: result }, 201);
});
```

- [ ] **Step 4: Re-run the focused route tests**

Run: `pnpm test:unit functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/lib/hono/_shared/__tests__/audit-runtime-alignment.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/purchase-orders.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js
git commit -m "feat: expose receipt reversal through manage purchase orders"
```

### Task 4: Close the phase with side-effect and replay regressions

**Files:**
- Verify: `functions/services/__tests__/DomainOutboxConsumers.notifications.test.js`
- Verify: `functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js`
- Verify: `functions/services/__tests__/OutboxReplayService.test.js`
- Verify: `functions/api/cron/__tests__/outbox.test.js`

- [ ] **Step 1: Run the full Phase 4 regression gate**

Run: `pnpm test:unit functions/repositories/__tests__/PurchaseReceiptRepository.reversal.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/DomainOutboxConsumers.notifications.test.js functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js functions/services/__tests__/OutboxReplayService.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/api/cron/__tests__/outbox.test.js`
Expected: PASS

- [ ] **Step 2: Update docs to freeze reversal semantics**

```md
Reversal rules:
- full reversal only in this phase
- no historical delete/update-in-place
- reversal facts must link to original receipt, command, and resulting compensation events
```

- [ ] **Step 3: Commit**

```bash
git add docs/DATABASE_SCHEMA.md functions/services/OrderProcurementReceiptReversalService.js functions/repositories/PurchaseReceiptRepository.js functions/services/DomainEventCatalog.js functions/lib/hono/routes/manage/purchase-orders.js
git commit -m "chore: close rollback compensation phase"
```

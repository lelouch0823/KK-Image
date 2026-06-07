# Order Procurement Domain Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the order/procurement/inventory domain to support multi-line orders plus partial procurement and partial receipt using event-first inventory projections without breaking current management and sales workflows during migration.

**Architecture:** Introduce new schema and repositories for order lines, receipts, allocations, and inventory events; funnel high-risk writes through unified domain services; project compatibility-friendly order and inventory read models back into existing manage/sales routes and frontend pages. Keep legacy endpoints alive during transition, but stop treating header status and balance tables as the only sources of truth.

**Tech Stack:** Cloudflare Pages Functions, D1 SQL migrations, Hono routes, repository/service pattern, Vitest, Vue 3 composables/views

---

## File Map

### New Files

- `migrations/00xx_order_procurement_domain_redesign.sql`
- `scripts/migrations/backfill-order-lines.mjs`
- `functions/repositories/OrderLineRepository.js`
- `functions/repositories/PurchaseReceiptRepository.js`
- `functions/repositories/InventoryEventRepository.js`
- `functions/repositories/OrderLineAllocationRepository.js`
- `functions/services/OrderStatusProjectionService.js`
- `functions/services/InventoryProjectionService.js`
- `functions/services/OrderProcurementDomainService.js`
- `functions/services/__tests__/OrderStatusProjectionService.test.js`
- `functions/services/__tests__/InventoryProjectionService.test.js`
- `functions/services/__tests__/OrderProcurementDomainService.test.js`
- `functions/repositories/__tests__/OrderLineRepository.test.js`
- `functions/repositories/__tests__/PurchaseReceiptRepository.test.js`
- `functions/repositories/__tests__/InventoryEventRepository.test.js`
- `functions/lib/hono/routes/manage/__tests__/purchase-order-receipts-routes.test.js`
- `src/composables/__tests__/usePurchaseOrders.receipts.test.js`
- `src/components/__tests__/OrderManager.line-statuses.test.js`
- `src/views/__tests__/PurchaseOrders.receipt-allocation.test.js`

### Modified Files

- `functions/repositories/OrderRepository.js`
- `functions/repositories/PurchaseOrderRepository.js`
- `functions/repositories/order/queries.js`
- `functions/repositories/order/helpers.js`
- `functions/services/PurchaseOrderService.js`
- `functions/services/DemandService.js`
- `functions/services/InventoryService.js`
- `functions/lib/hono/routes/manage/orders/list.js`
- `functions/lib/hono/routes/manage/orders/detail.js`
- `functions/lib/hono/routes/manage/orders/create.js`
- `functions/lib/hono/routes/manage/purchase-orders.js`
- `functions/lib/hono/routes/sales/orders.js`
- `functions/api/utils/order-utils.js`
- `src/composables/useOrders.js`
- `src/composables/usePurchaseOrders.js`
- `src/components/OrderManager.vue`
- `src/views/PurchaseOrders.vue`
- `src/utils/constants.js`
- `docs/API_REFERENCE.md`
- `docs/api/management.md`
- `docs/api/sales.md`

### Existing Tests To Extend

- `functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js`
- `functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js`
- `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
- `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
- `functions/repositories/__tests__/order-inventory-flow.test.js`
- `functions/services/__tests__/DemandReservationProjection.test.js`
- `test/manage-inventory-linkage-workflow.test.js`

## Task 1: Add Schema and Backfill Foundations

**Files:**

- Create: `migrations/00xx_order_procurement_domain_redesign.sql`
- Create: `scripts/migrations/backfill-order-lines.mjs`
- Modify: `docs/DATABASE_SCHEMA.md`
- Test: `scripts/__tests__/check-migration-prefixes.test.js`

- [ ] **Step 1: Write the failing migration-prefix test expectation**

```js
it('accepts the order procurement domain redesign migration name', async () => {
  const files = ['00xx_order_procurement_domain_redesign.sql'];
  expect(files.every((file) => /^\d+_.+\.sql$/.test(file))).toBe(true);
});
```

- [ ] **Step 2: Run test to verify the new migration is currently missing**

Run: `pnpm test:unit scripts/__tests__/check-migration-prefixes.test.js`
Expected: PASS on current suite, but the new migration file does not exist yet.

- [ ] **Step 3: Create the migration and backfill scaffold**

```sql
CREATE TABLE order_lines (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT,
  variant_id TEXT,
  snapshot_name TEXT NOT NULL,
  snapshot_sku TEXT,
  snapshot_specs TEXT,
  snapshot_image TEXT,
  ordered_qty INTEGER NOT NULL DEFAULT 0,
  procured_qty INTEGER NOT NULL DEFAULT 0,
  received_qty INTEGER NOT NULL DEFAULT 0,
  reserved_qty INTEGER NOT NULL DEFAULT 0,
  shipped_qty INTEGER NOT NULL DEFAULT 0,
  cancelled_qty INTEGER NOT NULL DEFAULT 0,
  display_status TEXT NOT NULL DEFAULT 'unprocured',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE purchase_receipts (...);
CREATE TABLE inventory_events (...);
CREATE TABLE order_line_allocations (...);
```

```js
for (const legacyOrder of legacyOrders) {
  await insertOrderLine({
    orderId: legacyOrder.id,
    snapshot_name: currentData.name || '',
    snapshot_sku: currentData.sku || '',
    ordered_qty: Number(legacyOrder.quantity || 1),
  });
}
```

- [ ] **Step 4: Run migration validation commands**

Run: `pnpm db:migrations:check-prefix`
Expected: PASS

Run: `pnpm test:unit scripts/__tests__/check-migration-prefixes.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add migrations/00xx_order_procurement_domain_redesign.sql scripts/migrations/backfill-order-lines.mjs docs/DATABASE_SCHEMA.md
git commit -m "feat: add order procurement redesign schema scaffold"
```

## Task 2: Add Repositories for Lines, Receipts, Events, and Allocations

**Files:**

- Create: `functions/repositories/OrderLineRepository.js`
- Create: `functions/repositories/PurchaseReceiptRepository.js`
- Create: `functions/repositories/InventoryEventRepository.js`
- Create: `functions/repositories/OrderLineAllocationRepository.js`
- Create: `functions/repositories/__tests__/OrderLineRepository.test.js`
- Create: `functions/repositories/__tests__/PurchaseReceiptRepository.test.js`
- Create: `functions/repositories/__tests__/InventoryEventRepository.test.js`

- [ ] **Step 1: Write failing repository tests**

```js
it('creates a migrated single-line order snapshot', async () => {
  const repo = new OrderLineRepository(db);
  await repo.createFromLegacyOrder({
    order_id: 'o-1',
    snapshot_name: 'Legacy Shoe',
    ordered_qty: 3,
  });
  expect(db.prepare).toHaveBeenCalled();
});

it('records receipt rows independently from purchase item totals', async () => {
  const repo = new PurchaseReceiptRepository(db);
  await repo.create({ po_item_id: 'poi-1', received_qty: 4 });
  expect(db.prepare).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run repository tests to verify failure**

Run: `pnpm test:unit functions/repositories/__tests__/OrderLineRepository.test.js functions/repositories/__tests__/PurchaseReceiptRepository.test.js functions/repositories/__tests__/InventoryEventRepository.test.js`
Expected: FAIL with missing modules or missing methods

- [ ] **Step 3: Implement minimal repositories**

```js
export class InventoryEventRepository {
  constructor(db) {
    this.db = db;
  }

  async create(event) {
    return this.db
      .prepare(
        `
      INSERT INTO inventory_events (id, variant_id, event_type, quantity_delta, reference_type, reference_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .bind(
        event.id,
        event.variantId,
        event.eventType,
        event.quantityDelta,
        event.referenceType,
        event.referenceId,
        JSON.stringify(event.metadata || {}),
        event.createdAt
      )
      .run();
  }
}
```

- [ ] **Step 4: Run repository tests to verify they pass**

Run: `pnpm test:unit functions/repositories/__tests__/OrderLineRepository.test.js functions/repositories/__tests__/PurchaseReceiptRepository.test.js functions/repositories/__tests__/InventoryEventRepository.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/repositories/OrderLineRepository.js functions/repositories/PurchaseReceiptRepository.js functions/repositories/InventoryEventRepository.js functions/repositories/OrderLineAllocationRepository.js functions/repositories/__tests__/OrderLineRepository.test.js functions/repositories/__tests__/PurchaseReceiptRepository.test.js functions/repositories/__tests__/InventoryEventRepository.test.js
git commit -m "feat: add repositories for lines receipts and inventory events"
```

## Task 3: Add Projection Services for Inventory and Statuses

**Files:**

- Create: `functions/services/OrderStatusProjectionService.js`
- Create: `functions/services/InventoryProjectionService.js`
- Create: `functions/services/__tests__/OrderStatusProjectionService.test.js`
- Create: `functions/services/__tests__/InventoryProjectionService.test.js`
- Modify: `functions/services/DemandService.js`
- Modify: `functions/services/InventoryService.js`

- [ ] **Step 1: Write failing projection tests**

```js
it('projects an order line to partially_received when receipts lag ordered quantity', () => {
  const status = projectOrderLineStatus({
    ordered_qty: 10,
    procured_qty: 10,
    received_qty: 4,
    shipped_qty: 0,
    cancelled_qty: 0,
  });
  expect(status).toBe('partially_received');
});

it('projects balances from event stream deltas', async () => {
  const balances = projectInventoryBalances([
    { eventType: 'purchase_received', quantityDelta: 8 },
    { eventType: 'inventory_reserved', quantityDelta: -3, reservedDelta: 3 },
  ]);
  expect(balances.onHand).toBe(8);
  expect(balances.reserved).toBe(3);
  expect(balances.available).toBe(5);
});
```

- [ ] **Step 2: Run tests to confirm missing projection logic**

Run: `pnpm test:unit functions/services/__tests__/OrderStatusProjectionService.test.js functions/services/__tests__/InventoryProjectionService.test.js`
Expected: FAIL with missing modules

- [ ] **Step 3: Implement pure projection functions and adapt legacy services**

```js
export function projectOrderLineStatus(line) {
  if (line.cancelled_qty >= line.ordered_qty) return 'cancelled';
  if (line.shipped_qty >= line.ordered_qty) return 'completed';
  if (line.received_qty > 0 && line.received_qty < line.ordered_qty) return 'partially_received';
  if (line.procured_qty >= line.ordered_qty) return 'fully_procured';
  if (line.procured_qty > 0) return 'partially_procured';
  return 'unprocured';
}
```

```js
export function projectInventoryBalances(events) {
  return events.reduce(
    (acc, event) => {
      if (event.eventType === 'purchase_received') acc.onHand += event.quantityDelta;
      if (event.eventType === 'inventory_reserved') acc.reserved += event.reservedDelta;
      acc.available = acc.onHand - acc.reserved;
      return acc;
    },
    { onHand: 0, reserved: 0, available: 0 }
  );
}
```

- [ ] **Step 4: Run new and legacy projection tests**

Run: `pnpm test:unit functions/services/__tests__/OrderStatusProjectionService.test.js functions/services/__tests__/InventoryProjectionService.test.js functions/services/__tests__/DemandReservationProjection.test.js functions/services/__tests__/InventoryService.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/services/OrderStatusProjectionService.js functions/services/InventoryProjectionService.js functions/services/DemandService.js functions/services/InventoryService.js functions/services/__tests__/OrderStatusProjectionService.test.js functions/services/__tests__/InventoryProjectionService.test.js
git commit -m "feat: add projection services for order and inventory state"
```

## Task 4: Add Unified Domain Service for Receipt, Allocation, and Reversal

**Files:**

- Create: `functions/services/OrderProcurementDomainService.js`
- Create: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Modify: `functions/services/PurchaseOrderService.js`
- Modify: `functions/repositories/PurchaseOrderRepository.js`

- [ ] **Step 1: Write failing service tests for receipt and allocation**

```js
it('records a receipt, writes inventory events, and updates projected quantities', async () => {
  const service = new OrderProcurementDomainService(db);
  await service.recordReceipt({
    poItemId: 'poi-1',
    variantId: 'v-1',
    receivedQty: 5,
    allocations: [{ orderLineId: 'ol-1', quantity: 3 }],
  });
  expect(db.batch).toHaveBeenCalled();
});

it('reverses a receipt by writing reversal events instead of deleting history', async () => {
  const service = new OrderProcurementDomainService(db);
  await service.reverseReceipt({ receiptId: 'rcpt-1', reason: 'damaged intake' });
  expect(db.prepare).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the service tests to verify failure**

Run: `pnpm test:unit functions/services/__tests__/OrderProcurementDomainService.test.js`
Expected: FAIL with missing service

- [ ] **Step 3: Implement unified write boundary**

```js
export class OrderProcurementDomainService {
  async recordReceipt(input) {
    // 1. validate purchase item and allocations
    // 2. create receipt row
    // 3. append inventory events
    // 4. update purchase item / order line projections
    // 5. recompute header statuses
  }
}
```

- [ ] **Step 4: Run service and purchase-order tests**

Run: `pnpm test:unit functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/PurchaseOrderService.procurement-status.test.js functions/repositories/__tests__/PurchaseOrderRepository.variant-required.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/services/OrderProcurementDomainService.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/PurchaseOrderService.js functions/repositories/PurchaseOrderRepository.js
git commit -m "feat: unify procurement receipt and allocation domain writes"
```

## Task 5: Update Manage Procurement Routes for Receipts and Allocations

**Files:**

- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Create: `functions/lib/hono/routes/manage/__tests__/purchase-order-receipts-routes.test.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
- Modify: `src/utils/constants.js`
- Modify: `docs/api/management.md`

- [ ] **Step 1: Write failing route tests for receipt endpoints**

```js
it('POST /api/manage/purchase-orders/:id/receipts stores a partial receipt', async () => {
  const res = await app.request('http://localhost/api/manage/purchase-orders/po-1/receipts', {
    method: 'POST',
    body: JSON.stringify({ items: [{ po_item_id: 'poi-1', received_qty: 4 }] }),
  });
  expect(res.status).toBe(201);
});
```

- [ ] **Step 2: Run receipt route tests to verify failure**

Run: `pnpm test:unit functions/lib/hono/routes/manage/__tests__/purchase-order-receipts-routes.test.js`
Expected: FAIL because route does not exist

- [ ] **Step 3: Implement new manage endpoints on top of the domain service**

```js
app.post('/:id/receipts', async (c) => {
  const body = await c.req.json();
  const service = new OrderProcurementDomainService(c.env.DB);
  const result = await service.recordReceiptBatch(
    c.req.param('id'),
    body.items,
    body.allocations || []
  );
  return c.json({ success: true, data: result }, 201);
});
```

- [ ] **Step 4: Run procurement route tests**

Run: `pnpm test:unit functions/lib/hono/routes/manage/__tests__/purchase-order-receipts-routes.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/purchase-orders.js functions/lib/hono/routes/manage/__tests__/purchase-order-receipts-routes.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js src/utils/constants.js docs/api/management.md
git commit -m "feat: add manage purchase receipt and allocation routes"
```

## Task 6: Project Compatibility Data Back Into Order APIs

**Files:**

- Modify: `functions/repositories/OrderRepository.js`
- Modify: `functions/repositories/order/queries.js`
- Modify: `functions/repositories/order/helpers.js`
- Modify: `functions/api/utils/order-utils.js`
- Modify: `functions/lib/hono/routes/manage/orders/list.js`
- Modify: `functions/lib/hono/routes/manage/orders/detail.js`
- Modify: `functions/lib/hono/routes/manage/orders/create.js`
- Modify: `functions/lib/hono/routes/sales/orders.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js`
- Modify: `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`

- [ ] **Step 1: Write failing compatibility tests**

```js
it('returns order lines alongside aggregate display status in manage detail', async () => {
  const payload = await getManageOrder('order-1');
  expect(payload.data.lines).toHaveLength(1);
  expect(payload.data.displayStatus).toBe('partially_received');
});

it('does not reopen rejected/void sales orders on no-op edit', async () => {
  const res = await patchSalesOrder('o-1', { reason: 'noop' });
  expect(res.status).toBe(200);
  expect(updateStatusMock).not.toHaveBeenCalledWith('o-1', 'pending', 'sales');
});
```

- [ ] **Step 2: Run the route tests to confirm failure**

Run: `pnpm test:unit functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
Expected: FAIL on missing `lines`/aggregate state and current reopen behavior

- [ ] **Step 3: Update repositories and routes to read projected lines**

```js
return {
  id: order.id,
  orderNo: order.order_no,
  displayStatus: aggregateOrderHeaderStatus(lines),
  status: legacyCompatibilityStatus(lines),
  procurementStatus: legacyCompatibilityProcurementStatus(lines),
  lines,
};
```

```js
if (!result.hasChanges) {
  return c.json({ success: true, message: MSG.ORDER.UPDATE_SUCCESS, data: order });
}
```

- [ ] **Step 4: Run compatibility route tests and inventory regression tests**

Run: `pnpm test:unit functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js functions/repositories/__tests__/order-inventory-flow.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/repositories/OrderRepository.js functions/repositories/order/queries.js functions/repositories/order/helpers.js functions/api/utils/order-utils.js functions/lib/hono/routes/manage/orders/list.js functions/lib/hono/routes/manage/orders/detail.js functions/lib/hono/routes/manage/orders/create.js functions/lib/hono/routes/sales/orders.js functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js
git commit -m "feat: expose projected order lines through legacy order apis"
```

## Task 7: Update Frontend Composables and Admin Views

**Files:**

- Modify: `src/composables/useOrders.js`
- Modify: `src/composables/usePurchaseOrders.js`
- Modify: `src/components/OrderManager.vue`
- Modify: `src/views/PurchaseOrders.vue`
- Create: `src/composables/__tests__/usePurchaseOrders.receipts.test.js`
- Create: `src/components/__tests__/OrderManager.line-statuses.test.js`
- Create: `src/views/__tests__/PurchaseOrders.receipt-allocation.test.js`
- Modify: `src/composables/__tests__/useOrders.update-order.test.js`
- Modify: `src/composables/__tests__/usePurchaseOrders.test.js`

- [ ] **Step 1: Write failing composable/view tests**

```js
it('normalizes order detail lines and displayStatus', async () => {
  const { getOrder } = useOrders();
  const order = await getOrder('o-1');
  expect(order.lines[0].orderedQty).toBe(10);
  expect(order.displayStatus).toBe('partially_received');
});

it('submits purchase receipts from the purchase order detail view', async () => {
  await wrapper.find('[data-testid=\"submit-receipt\"]').trigger('click');
  expect(authFetch).toHaveBeenCalledWith(
    '/api/manage/purchase-orders/po-1/receipts',
    expect.anything()
  );
});
```

- [ ] **Step 2: Run frontend unit tests to verify failure**

Run: `pnpm test:unit src/composables/__tests__/usePurchaseOrders.receipts.test.js src/components/__tests__/OrderManager.line-statuses.test.js src/views/__tests__/PurchaseOrders.receipt-allocation.test.js`
Expected: FAIL on missing UI support

- [ ] **Step 3: Update composables and views**

```js
const normalizedLine = {
  id: line.id,
  orderedQty: Number(line.ordered_qty || 0),
  receivedQty: Number(line.received_qty || 0),
  displayStatus: line.display_status,
};
```

```vue
<ProgressBar :value="line.receivedQty" :max="line.orderedQty" label="Received / Ordered" />
```

- [ ] **Step 4: Run frontend tests**

Run: `pnpm test:unit src/composables/__tests__/usePurchaseOrders.receipts.test.js src/components/__tests__/OrderManager.line-statuses.test.js src/views/__tests__/PurchaseOrders.receipt-allocation.test.js src/composables/__tests__/useOrders.update-order.test.js src/composables/__tests__/usePurchaseOrders.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/useOrders.js src/composables/usePurchaseOrders.js src/components/OrderManager.vue src/views/PurchaseOrders.vue src/composables/__tests__/usePurchaseOrders.receipts.test.js src/components/__tests__/OrderManager.line-statuses.test.js src/views/__tests__/PurchaseOrders.receipt-allocation.test.js src/composables/__tests__/useOrders.update-order.test.js src/composables/__tests__/usePurchaseOrders.test.js
git commit -m "feat: add line-level order and receipt workflows to admin ui"
```

## Task 8: Add Replay and Consistency Verification

**Files:**

- Modify: `functions/services/InventoryProjectionService.js`
- Modify: `functions/services/OrderStatusProjectionService.js`
- Modify: `functions/services/__tests__/InventoryBusinessWorkflow.test.js`
- Modify: `functions/services/__tests__/inventory-ledger-projection.test.js`
- Modify: `test/manage-inventory-linkage-workflow.test.js`
- Create: `scripts/qa/check-order-projection-consistency.mjs`

- [ ] **Step 1: Write failing consistency tests**

```js
it('rebuilds balances from inventory_events to match online balances', async () => {
  const report = await checkConsistency(db);
  expect(report.mismatches).toEqual([]);
});
```

- [ ] **Step 2: Run consistency tests to verify failure**

Run: `pnpm test:unit functions/services/__tests__/InventoryBusinessWorkflow.test.js functions/services/__tests__/inventory-ledger-projection.test.js`
Expected: FAIL until replay helpers exist

- [ ] **Step 3: Implement replay helper and QA script**

```js
export async function rebuildVariantBalance(db, variantId) {
  const events = await eventRepo.listByVariant(variantId);
  return projectInventoryBalances(events);
}
```

```js
for (const variantId of variantIds) {
  const projected = await rebuildVariantBalance(db, variantId);
  if (!matchesStored(projected, stored)) mismatches.push({ variantId, projected, stored });
}
```

- [ ] **Step 4: Run end-to-end verification**

Run: `pnpm test:unit functions/services/__tests__/InventoryBusinessWorkflow.test.js functions/services/__tests__/inventory-ledger-projection.test.js test/manage-inventory-linkage-workflow.test.js`
Expected: PASS

Run: `node scripts/qa/check-order-projection-consistency.mjs`
Expected: exits `0` with no mismatches

- [ ] **Step 5: Commit**

```bash
git add functions/services/InventoryProjectionService.js functions/services/OrderStatusProjectionService.js functions/services/__tests__/InventoryBusinessWorkflow.test.js functions/services/__tests__/inventory-ledger-projection.test.js test/manage-inventory-linkage-workflow.test.js scripts/qa/check-order-projection-consistency.mjs
git commit -m "test: add projection replay and consistency verification"
```

## Task 9: Refresh Documentation and Cutover Notes

**Files:**

- Modify: `docs/API_REFERENCE.md`
- Modify: `docs/api/management.md`
- Modify: `docs/api/sales.md`
- Modify: `docs/developer-guide/architecture.md`
- Modify: `docs/developer-guide/minisales.md`

- [ ] **Step 1: Write the failing documentation contract note**

```md
Expected API docs must mention:

- order lines in order detail payloads
- purchase receipt endpoints
- compatibility status semantics
```

- [ ] **Step 2: Run targeted smoke tests before doc updates**

Run: `pnpm test:unit functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
Expected: PASS so the docs reflect working behavior

- [ ] **Step 3: Update API and architecture docs**

```md
`GET /api/manage/orders/:id`
returns:

- order header compatibility fields
- `lines[]` with snapshot and quantity-progress data

`POST /api/manage/purchase-orders/:id/receipts`
records partial receipts and optional immediate allocations
```

- [ ] **Step 4: Run docs-adjacent verification**

Run: `pnpm test:audit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/API_REFERENCE.md docs/api/management.md docs/api/sales.md docs/developer-guide/architecture.md docs/developer-guide/minisales.md
git commit -m "docs: update order procurement redesign references"
```

## Final Verification Checklist

- [ ] Run: `pnpm test:unit functions/repositories/__tests__/OrderLineRepository.test.js functions/repositories/__tests__/PurchaseReceiptRepository.test.js functions/repositories/__tests__/InventoryEventRepository.test.js functions/services/__tests__/OrderStatusProjectionService.test.js functions/services/__tests__/InventoryProjectionService.test.js functions/services/__tests__/OrderProcurementDomainService.test.js`
      Expected: PASS

- [ ] Run: `pnpm test:unit functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/lib/hono/routes/manage/__tests__/purchase-order-receipts-routes.test.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
      Expected: PASS

- [ ] Run: `pnpm test:unit src/composables/__tests__/usePurchaseOrders.receipts.test.js src/components/__tests__/OrderManager.line-statuses.test.js src/views/__tests__/PurchaseOrders.receipt-allocation.test.js`
      Expected: PASS

- [ ] Run: `pnpm test:unit test/manage-inventory-linkage-workflow.test.js`
      Expected: PASS

- [ ] Run: `node scripts/qa/check-order-projection-consistency.mjs`
      Expected: exits `0`

- [ ] Run: `pnpm db:migrations:check-prefix`
      Expected: PASS

## Execution Notes

- Do not delete legacy compatibility fields until all order and procurement reads have switched to projections.
- Keep route-level inventory mutations thin; new logic belongs in `OrderProcurementDomainService`.
- Preserve snapshot data on every new order line creation and migration path.
- Avoid mixing current catalog labels with historical snapshot labels in frontend displays.
- When a write changes both receipt/allocation and display status, assert the quantities first and project the status second.

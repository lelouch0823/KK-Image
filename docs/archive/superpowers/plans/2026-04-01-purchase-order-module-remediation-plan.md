# Purchase Order Module Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining purchase-order logic gaps so item editing, receipt reversal, shortage closure, order procurement projection, and landed-cost accounting all follow the same approved business rules.

**Architecture:** Keep purchase-order header state as purchase-order-local, keep order procurement status as order-line-derived truth, and add the missing shortage-closure command without broadening scope into a full state-machine rewrite. Reuse shared projection helpers where possible so receipt, reversal, and settlement paths stop diverging in subtle ways.

**Tech Stack:** JavaScript, Hono, Vue 3 Composition API, Vitest, Cloudflare D1

---

## File Structure

- Create: `functions/services/purchase-order-projection.js`
  - Shared helpers for purchase-order item receipt status and order procurement projection
- Create: `functions/services/PurchaseOrderShortageClosureService.js`
  - Batch shortage-closing command for purchase-order items
- Create: `functions/services/__tests__/PurchaseOrderShortageClosureService.test.js`
  - Focused service tests for shortage closing
- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
  - Harden patch route, add shortage-closing route, adjust status-sync event payloads
- Modify: `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
  - Route coverage for patch hardening, shortage closing, and revised procurement-status sync behavior
- Modify: `functions/repositories/PurchaseOrderRepository.js`
  - Add item lookup helper, remove `variant_id` patch support, support shortage-closing reads if needed
- Modify: `functions/services/PurchaseOrderService.js`
  - Replace unsafe order procurement status cascade behavior and fix allocation / MAC quantity basis
- Modify: `functions/services/OrderProcurementDomainService.js`
  - Consume shared projection helpers
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`
  - Recompute order-line display status and consume shared projection helpers
- Modify: `functions/services/__tests__/PurchaseOrderService.procurement-status.test.js`
  - Cover non-destructive order procurement sync semantics
- Modify: `functions/services/__tests__/purchase-order-moving-average-cost.test.js`
  - Cover `received_qty`-based allocation and MAC updates
- Modify: `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
  - Cover order-line display-status rollback
- Modify: `src/composables/usePurchaseOrders.js`
  - Add shortage-closing client action
- Modify: `src/composables/__tests__/usePurchaseOrders.test.js`
  - Cover shortage-closing request path
- Modify: `src/views/PurchaseOrders.vue`
  - Add shortage-closing UI flow and align action affordances with new backend behavior
- Modify: `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
  - Cover shortage-closing affordance and updated action visibility

## Task 1: Harden Draft Item Updates

**Files:**
- Modify: `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
- Modify: `functions/repositories/PurchaseOrderRepository.js`
- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`

- [ ] **Step 1: Write the failing route tests**

Add focused tests in `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`:

```js
it('rejects purchase-order item patch when variant_id is supplied', async () => {
  const res = await app.request(
    'http://localhost/api/manage/purchase-orders/po-1/items/item-1',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant_id: 'var-2' }),
    },
    { DB: db }
  );

  expect(res.status).toBe(400);
});

it('re-validates quantity rules when patching a draft purchase-order item', async () => {
  mocks.repoFindItem.mockResolvedValueOnce({
    id: 'item-1',
    po_id: 'po-1',
    product_id: 'prod-1',
    variant_id: 'var-1',
    pre_order_id: 'order-1',
    quantity: 10,
    unit_cost: 5,
  });

  const res = await app.request(
    'http://localhost/api/manage/purchase-orders/po-1/items/item-1',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 3 }),
    },
    { DB: db }
  );

  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run the route test file to confirm failure**

Run:

```bash
pnpm test:unit functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js
```

Expected: FAIL because the patch route currently forwards the request directly to `repo.updateItem(...)`.

- [ ] **Step 3: Add item lookup support in the repository**

Update `functions/repositories/PurchaseOrderRepository.js`:

```js
async findItemById(poId, itemId) {
  return this.db
    .prepare(
      `SELECT id, po_id, product_id, variant_id, pre_order_id, quantity, unit_cost
       FROM purchase_order_items
       WHERE id = ? AND po_id = ?`
    )
    .bind(itemId, poId)
    .first();
}
```

Also remove `variant_id` from `updateItem(...)` so the repository only updates `quantity` and `unit_cost`.

- [ ] **Step 4: Re-validate merged item data in the patch route**

Update `functions/lib/hono/routes/manage/purchase-orders.js`:

```js
if (body.variant_id !== undefined) {
  throw new BadRequestError('现有采购明细不允许修改规格，请删除后重新添加');
}

const existingItem = await repo.findItemById(poId, c.req.param('itemId'));
if (!existingItem) throw new NotFoundError('明细不存在');

const mergedItem = {
  ...existingItem,
  quantity: body.quantity ?? existingItem.quantity,
  unit_cost: body.unit_cost ?? existingItem.unit_cost,
};

await validateVariantItems(c.env.DB, [mergedItem]);
await validatePreOrderBinding(c.env.DB, [mergedItem]);
```

Keep the draft-state guard in place before any mutation.

- [ ] **Step 5: Re-run the route tests**

Run:

```bash
pnpm test:unit functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/repositories/PurchaseOrderRepository.js functions/lib/hono/routes/manage/purchase-orders.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js
git commit -m "fix: harden draft purchase order item updates"
```

## Task 2: Share Projection Helpers And Fix Reversal Rollback Completeness

**Files:**
- Create: `functions/services/purchase-order-projection.js`
- Modify: `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`

- [ ] **Step 1: Write the failing reversal test**

Add a focused test in `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`:

```js
it('recomputes order-line display_status when reversing a receipt', async () => {
  const result = await service.reverseReceipt('po-1', 'receipt-1', { reversal_qty: 2 }, {
    idempotencyKey: 'reversal-key-1',
  });

  expect(result.reversal_qty).toBe(2);
  expect(harness.executedSql).toContain('display_status = ?');
});
```

If the harness already captures bound values, assert the next display status equals the projected rollback state, not just that SQL text contains the column.

- [ ] **Step 2: Run the reversal service tests to confirm failure**

Run:

```bash
pnpm test:unit functions/services/__tests__/OrderProcurementReceiptReversalService.test.js
```

Expected: FAIL because reversal currently updates only `received_qty` on `order_lines`.

- [ ] **Step 3: Extract shared projection helpers**

Create `functions/services/purchase-order-projection.js` with shared helpers such as:

```js
export function toNonNegativeInt(value) {
  return Math.max(0, Math.trunc(Number(value) || 0));
}

export function computePurchaseOrderRemainingReceivable(item = {}) {
  return Math.max(
    toNonNegativeInt(item.quantity) -
      toNonNegativeInt(item.received_qty) -
      toNonNegativeInt(item.cancelled_qty),
    0
  );
}

export function projectPurchaseOrderItemStatus(item = {}) { /* shared existing logic */ }

export function projectCompatibilityProcurementStatus(progress = {}) { /* shared existing logic */ }
```

Move the duplicated helper logic out of both procurement services into this shared file.

- [ ] **Step 4: Use the shared helpers in both receipt paths**

Update `functions/services/OrderProcurementDomainService.js` and `functions/services/OrderProcurementReceiptReversalService.js` to import from `purchase-order-projection.js`.

In `OrderProcurementReceiptReversalService.js`, compute and persist:

```js
const nextOrderLine = {
  ...orderLine,
  received_qty: nextOrderLineReceivedQty,
};
nextOrderLine.display_status = projectOrderLineStatus(nextOrderLine);
```

Then write both `received_qty` and `display_status` in the `UPDATE order_lines ...` statement.

- [ ] **Step 5: Re-run the reversal tests**

Run:

```bash
pnpm test:unit functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/OrderProcurementDomainService.test.js
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/services/purchase-order-projection.js functions/services/OrderProcurementDomainService.js functions/services/OrderProcurementReceiptReversalService.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js
git commit -m "fix: align receipt reversal projections with receipt flow"
```

## Task 3: Make Order Procurement Status Sync Non-Destructive

**Files:**
- Modify: `functions/services/__tests__/PurchaseOrderService.procurement-status.test.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
- Modify: `functions/services/PurchaseOrderService.js`
- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`

- [ ] **Step 1: Write failing service tests for the revised sync semantics**

Add focused tests in `functions/services/__tests__/PurchaseOrderService.procurement-status.test.js`:

```js
it('only seeds linked orders to ordered when they are still none', async () => {
  // expect SQL WHERE clause to protect advanced procurement states
});

it('does not force linked orders to arrived when a purchase order header enters arrived', async () => {
  const result = await service.updateStatus('po-1', 'arrived');
  expect(result.changedOrderStatuses).not.toContainEqual(
    expect.objectContaining({ procurementStatus: 'arrived' })
  );
});

it('does not downgrade partially_arrived orders when a linked purchase order moves to shipping', async () => {
  // assert SQL excludes advanced states or no-op behavior
});
```

Also add a route-layer expectation in `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js` that the emitted order events use per-order statuses rather than a single `targetProcurementStatus`.

- [ ] **Step 2: Run the service and route tests to confirm failure**

Run:

```bash
pnpm test:unit functions/services/__tests__/PurchaseOrderService.procurement-status.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js
```

Expected: FAIL because `PurchaseOrderService.updateStatus()` currently applies a flat PO-to-order status map.

- [ ] **Step 3: Replace the flat cascade with guarded sync rules**

Update `functions/services/PurchaseOrderService.js`:

```js
// ordered / shipping may seed only untouched orders
const seedOrdered = ['ordered', 'shipping'].includes(newStatus);

// arrived must never be inferred from PO header
const shouldSeedArrival = false;
```

Implement a return shape like:

```js
changedOrderStatuses: [
  { orderId: 'o-1', procurementStatus: 'ordered' },
]
```

Recommended behavior:

- for `ordered` and `shipping`, update linked orders to `ordered` only when current procurement status is `none`
- for `arrived`, do not write linked order procurement status from the PO header
- never downgrade `partially_arrived` or `arrived`

- [ ] **Step 4: Emit route events from the actual changed-order list**

Update `functions/lib/hono/routes/manage/purchase-orders.js`:

```js
if (Array.isArray(result?.changedOrderStatuses) && result.changedOrderStatuses.length > 0) {
  events.push(...result.changedOrderStatuses.map(({ orderId, procurementStatus }) => ({
    event_type: 'order_procurement_progressed',
    aggregate_type: 'order',
    aggregate_id: orderId,
    payload: {
      purchase_order_id: c.req.param('id'),
      order_id: orderId,
      procurement_status_after: procurementStatus,
      trigger: 'purchase_order_status_changed',
    },
  })));
}
```

Remove any dependence on a single shared `targetProcurementStatus`.

- [ ] **Step 5: Re-run the targeted tests**

Run:

```bash
pnpm test:unit functions/services/__tests__/PurchaseOrderService.procurement-status.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/services/PurchaseOrderService.js functions/services/__tests__/PurchaseOrderService.procurement-status.test.js functions/lib/hono/routes/manage/purchase-orders.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js
git commit -m "fix: stop purchase order headers from overstating order arrival"
```

## Task 4: Add Purchase-Order Shortage Closure

**Files:**
- Create: `functions/services/__tests__/PurchaseOrderShortageClosureService.test.js`
- Create: `functions/services/PurchaseOrderShortageClosureService.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Modify: `src/composables/__tests__/usePurchaseOrders.test.js`
- Modify: `src/composables/usePurchaseOrders.js`
- Modify: `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
- Modify: `src/views/PurchaseOrders.vue`

- [ ] **Step 1: Write the failing backend service tests**

Create `functions/services/__tests__/PurchaseOrderShortageClosureService.test.js` with cases like:

```js
it('closes remaining receivable quantity on purchase-order items without mutating order_lines', async () => {
  const result = await service.closeShortages('po-1', {
    items: [{ purchase_order_item_id: 'item-1', cancelled_qty: 2, note: 'supplier short-shipped' }],
  }, { idempotencyKey: 'shortage-key-1' });

  expect(result.closed_count).toBe(1);
  expect(harness.executedSql.some((sql) => sql.includes('UPDATE order_lines'))).toBe(false);
});

it('rejects closing more than the remaining receivable quantity', async () => {
  await expect(
    service.closeShortages('po-1', {
      items: [{ purchase_order_item_id: 'item-1', cancelled_qty: 99 }],
    }, { idempotencyKey: 'shortage-key-2' })
  ).rejects.toThrow(/待收|remaining|关闭/);
});
```

- [ ] **Step 2: Write the failing route and client tests**

Add route coverage in `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`:

```js
it('submits purchase-order shortage closures through POST /:id/shortage-closures', async () => {
  expect(res.status).toBe(201);
});
```

Add composable coverage in `src/composables/__tests__/usePurchaseOrders.test.js`:

```js
it('submits shortage-closure commands through the managed auth client', async () => {
  const result = await closeShortages('po-1', {
    items: [{ purchase_order_item_id: 'item-1', cancelled_qty: 2 }],
  });

  expect(fetchSpy).toHaveBeenCalledWith(
    API.MANAGE_PURCHASE_ORDER_SHORTAGE_CLOSURES('po-1'),
    expect.anything()
  );
});
```

- [ ] **Step 3: Write the failing Vue detail-shell test**

Add UI coverage in `src/views/__tests__/PurchaseOrders.detail-shell.test.js`:

```js
it('shows a shortage-closing action when receivable lines remain', async () => {
  expect(wrapper.text()).toContain('关闭待收');
});
```

Also add a negative case showing the action disappears when there is no remaining receivable quantity.

- [ ] **Step 4: Run the targeted tests to confirm failure**

Run:

```bash
pnpm test:unit functions/services/__tests__/PurchaseOrderShortageClosureService.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js src/composables/__tests__/usePurchaseOrders.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

Expected: FAIL because the shortage-closing command does not exist yet.

- [ ] **Step 5: Implement the backend shortage-closing command**

Create `functions/services/PurchaseOrderShortageClosureService.js` with logic like:

```js
for (const item of payload.items) {
  const poItem = await this.requirePurchaseOrderItem(poId, item.purchase_order_item_id);
  const remainingReceivable = computePurchaseOrderRemainingReceivable(poItem);
  if (item.cancelled_qty <= 0 || item.cancelled_qty > remainingReceivable) {
    throw new BadRequestError(`关闭数量超过当前待收数量: ${remainingReceivable}`);
  }

  const nextCancelledQty = toNonNegativeInt(poItem.cancelled_qty) + item.cancelled_qty;
  const nextDisplayStatus = projectPurchaseOrderItemStatus({
    ...poItem,
    cancelled_qty: nextCancelledQty,
  });

  statements.push(
    this.db.prepare(
      `UPDATE purchase_order_items
       SET cancelled_qty = ?, display_status = ?
       WHERE id = ? AND po_id = ?`
    ).bind(nextCancelledQty, nextDisplayStatus, poItem.id, poId)
  );
}
```

Return a response such as:

```js
{ purchase_order_id: poId, closed_count: results.length, items: results }
```

Do not mutate `order_lines` or `orders.procurement_status` in this phase.

- [ ] **Step 6: Expose the route and client action**

Add a new route in `functions/lib/hono/routes/manage/purchase-orders.js`:

```js
app.post('/:id/shortage-closures', async (c) => { /* call service, audit, outbox poller */ });
```

Add `closeShortages(poId, payload)` to `src/composables/usePurchaseOrders.js`.

Use the same fetch / toast conventions as receipts and reversals.

- [ ] **Step 7: Add the Vue shortage-closing flow**

Update `src/views/PurchaseOrders.vue`:

```js
const canCloseShortages = computed(() => receiptReceivableCount.value > 0 && ['ordered', 'shipping'].includes(detail.value?.status));
```

Add:

- a button near the receipt ledger actions
- a simple modal listing receivable lines
- quantity inputs limited to remaining receivable quantity
- submit handling through `closeShortages(...)`

Refresh detail and list after a successful close command just like receipt actions do.

- [ ] **Step 8: Re-run the targeted tests**

Run:

```bash
pnpm test:unit functions/services/__tests__/PurchaseOrderShortageClosureService.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js src/composables/__tests__/usePurchaseOrders.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add functions/services/PurchaseOrderShortageClosureService.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js functions/lib/hono/routes/manage/purchase-orders.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js src/composables/usePurchaseOrders.js src/composables/__tests__/usePurchaseOrders.test.js src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.detail-shell.test.js
git commit -m "feat: add purchase order shortage closure flow"
```

## Task 5: Rebase Landed Cost And MAC On Received Quantity

**Files:**
- Modify: `functions/services/__tests__/purchase-order-moving-average-cost.test.js`
- Modify: `functions/services/PurchaseOrderService.js`

- [ ] **Step 1: Write the failing accounting tests**

Extend `functions/services/__tests__/purchase-order-moving-average-cost.test.js`:

```js
it('allocates landed cost and MAC using received quantity instead of ordered quantity', async () => {
  service.repo = {
    getItemsForAllocation: vi.fn(async () => [
      {
        id: 'i-1',
        variant_id: 'v-1',
        quantity: 10,
        received_qty: 8,
        cancelled_qty: 2,
        unit_cost: 5,
      },
    ]),
    updateAllocations: vi.fn(async () => undefined),
  };

  await service.allocateCosts('po-1');

  expect(service.variantRepo.updateMovingAverageCost).toHaveBeenCalledWith('v-1', 8, 64);
});

it('skips MAC updates for items with zero received quantity', async () => {
  // expect no updateMovingAverageCost call
});
```

- [ ] **Step 2: Run the accounting tests to confirm failure**

Run:

```bash
pnpm test:unit functions/services/__tests__/purchase-order-moving-average-cost.test.js
```

Expected: FAIL because allocation currently uses `item.quantity`.

- [ ] **Step 3: Update allocation math to use effective received quantity**

Update `functions/services/PurchaseOrderService.js`:

```js
const effectiveQty = Math.max(0, Number(item.received_qty) || 0);
```

Use `effectiveQty` in:

- total quantity allocation basis
- total value allocation basis
- per-item landed cost total
- `variantRepo.updateMovingAverageCost(...)`

Skip zero-received items when building MAC updates.

- [ ] **Step 4: Re-run the accounting tests**

Run:

```bash
pnpm test:unit functions/services/__tests__/purchase-order-moving-average-cost.test.js
```

Expected: PASS

- [ ] **Step 5: Run the broader purchase-order regression slice**

Run:

```bash
pnpm test:unit functions/services/__tests__/PurchaseOrderService.procurement-status.test.js functions/services/__tests__/purchase-order-moving-average-cost.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js src/composables/__tests__/usePurchaseOrders.test.js
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/services/PurchaseOrderService.js functions/services/__tests__/purchase-order-moving-average-cost.test.js
git commit -m "fix: base purchase order landed cost on received quantity"
```

## Task 6: Final Verification

**Files:**
- No code changes required unless a regression is found

- [ ] **Step 1: Run the full targeted remediation suite**

Run:

```bash
pnpm test:unit functions/services/__tests__/PurchaseOrderShortageClosureService.test.js functions/services/__tests__/PurchaseOrderService.procurement-status.test.js functions/services/__tests__/purchase-order-moving-average-cost.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js src/composables/__tests__/usePurchaseOrders.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

Expected: PASS

- [ ] **Step 2: Smoke-check the purchase-order detail workflow manually**

Verify in the browser or local environment:

1. Draft item patch rejects invalid quantity or forbidden variant mutation
2. Receipt recording still works
3. Receipt reversal rolls back line status correctly
4. Shortage closure closes PO receivable quantity without altering order-line cancellation
5. `shipping -> arrived` becomes available only after receipts plus shortage closure reduce PO outstanding quantity to zero
6. Settlement after short shipment updates MAC using actual received quantity only

- [ ] **Step 3: Record any deviations before merge**

If any test or smoke check reveals mismatch between approved business rules and runtime behavior, update:

- `docs/superpowers/specs/2026-04-01-purchase-order-module-remediation-design.md`
- `docs/superpowers/plans/2026-04-01-purchase-order-module-remediation-plan.md`

before continuing execution.

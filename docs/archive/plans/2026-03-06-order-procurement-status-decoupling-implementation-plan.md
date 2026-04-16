# Order Procurement Status Decoupling (Phase 1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decouple purchase-order cascade from `orders.status`, introduce `orders.procurement_status`, and close the highest-risk integrity/concurrency loopholes in purchase-order flows.

**Architecture:** Add a dedicated procurement-status state utility and migrate purchase cascade logic to update `orders.procurement_status` only. Harden write paths with compare-and-set PO status transitions, PO item ownership checks, and `pre_order_id` consistency validation (order/product/variant alignment). Keep scope YAGNI: no event-bus/outbox in this phase; deliver a safe, backward-compatible baseline for production rollout.

**Tech Stack:** Cloudflare D1 SQL migrations, Hono routes, repository/service layer in Node ESM, Vue3 frontend (minimal touch), Vitest.

---

### Task 1: Procurement Status State Utility (TDD)

**Files:**
- Create: `functions/api/utils/order-procurement-state-machine.js`
- Test: `functions/api/utils/__tests__/order-procurement-state-machine.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import {
  PO_TO_PROCUREMENT_STATUS_MAP,
  isTerminalOrderStatus,
  canApplyProcurementStatus,
} from '../order-procurement-state-machine.js';

describe('order procurement state machine', () => {
  it('maps PO status to procurement status', () => {
    expect(PO_TO_PROCUREMENT_STATUS_MAP.ordered).toBe('ordered');
    expect(PO_TO_PROCUREMENT_STATUS_MAP.shipping).toBe('ordered');
    expect(PO_TO_PROCUREMENT_STATUS_MAP.arrived).toBe('arrived');
  });

  it('blocks terminal order status from auto cascade', () => {
    expect(isTerminalOrderStatus('delivered')).toBe(true);
    expect(canApplyProcurementStatus('void', 'ordered')).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/api/utils/__tests__/order-procurement-state-machine.test.js`
Expected: FAIL with module/function not found.

**Step 3: Write minimal implementation**

```js
export const PO_TO_PROCUREMENT_STATUS_MAP = Object.freeze({
  ordered: 'ordered',
  shipping: 'ordered',
  arrived: 'arrived',
});

const TERMINAL_ORDER_STATUSES = new Set(['delivered', 'void']);

export function isTerminalOrderStatus(status) {
  return TERMINAL_ORDER_STATUSES.has(String(status || '').toLowerCase());
}

export function canApplyProcurementStatus(orderStatus, nextProcurementStatus) {
  if (!nextProcurementStatus) return false;
  return !isTerminalOrderStatus(orderStatus);
}
```

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/api/utils/__tests__/order-procurement-state-machine.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/api/utils/order-procurement-state-machine.js functions/api/utils/__tests__/order-procurement-state-machine.test.js
git commit -m "test+feat: add procurement status mapping utility"
```

---

### Task 2: PurchaseOrderRepository Safety Guards (TDD)

**Files:**
- Modify: `functions/repositories/PurchaseOrderRepository.js`
- Test: `functions/repositories/__tests__/purchase-order-repository-safety.test.js`

**Step 1: Write the failing test**

```js
it('updateStatusIfCurrent only updates when current status matches', async () => {
  // expect false when CAS fails and true when matches
});

it('removeItem/updateItem must be scoped by po_id', async () => {
  // expect SQL contains WHERE id = ? AND po_id = ?
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/repositories/__tests__/purchase-order-repository-safety.test.js`
Expected: FAIL with missing methods/SQL mismatch.

**Step 3: Write minimal implementation**

```js
async updateStatusIfCurrent(id, currentStatus, nextStatus) {
  const result = await this.db.prepare(
    `UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ? AND status = ?`
  ).bind(nextStatus, Date.now(), id, currentStatus).run();
  return (result.meta?.changes || 0) > 0;
}

async removeItem(poId, itemId) {
  const result = await this.db.prepare(
    `DELETE FROM purchase_order_items WHERE id = ? AND po_id = ?`
  ).bind(itemId, poId).run();
  return (result.meta?.changes || 0) > 0;
}

async updateItem(poId, itemId, updates) {
  // ... existing field collection
  const sql = `UPDATE purchase_order_items SET ${fields.join(', ')} WHERE id = ? AND po_id = ?`;
}
```

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/repositories/__tests__/purchase-order-repository-safety.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/repositories/PurchaseOrderRepository.js functions/repositories/__tests__/purchase-order-repository-safety.test.js
git commit -m "fix: add po status CAS and po item ownership guards"
```

---

### Task 3: Service Cascade Decoupling to procurement_status (TDD)

**Files:**
- Modify: `functions/services/PurchaseOrderService.js`
- Create: `functions/services/__tests__/PurchaseOrderService.procurement-status.test.js`

**Step 1: Write the failing test**

```js
it('updates linked orders procurement_status without changing orders.status', async () => {
  // assert SQL updates procurement_status and never writes orders.status
});

it('skips delivered/void linked orders during auto cascade', async () => {
  // assert filtering logic excludes terminal statuses
});

it('throws conflict when po status CAS fails (concurrent transition)', async () => {
  // updateStatusIfCurrent returns false -> expect error
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/services/__tests__/PurchaseOrderService.procurement-status.test.js`
Expected: FAIL with old cascade behavior.

**Step 3: Write minimal implementation**

```js
const targetProcurementStatus = PO_TO_PROCUREMENT_STATUS_MAP[newStatus];
const updated = await this.repo.updateStatusIfCurrent(poId, po.status, newStatus);
if (!updated) throw new BadRequestError('采购单状态已变化，请刷新后重试');

// update orders.procurement_status only
this.db.prepare(
  `UPDATE orders SET procurement_status = ?, updated_at = ?
   WHERE id = ? AND (status NOT IN ('delivered', 'void'))
     AND COALESCE(procurement_status, 'none') != ?`
)
```

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/services/__tests__/PurchaseOrderService.procurement-status.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/services/PurchaseOrderService.js functions/services/__tests__/PurchaseOrderService.procurement-status.test.js
git commit -m "fix: decouple purchase cascade from order main status"
```

---

### Task 4: Route-Level Input Integrity Hardening (TDD)

**Files:**
- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Create: `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`

**Step 1: Write the failing test**

```js
it('rejects adding item when pre_order_id product/variant mismatch', async () => {
  // POST /:id/items -> 400
});

it('rejects updating item outside current po scope', async () => {
  // PATCH /:id/items/:itemId with foreign item -> 404
});

it('rejects deleting item outside current po scope', async () => {
  // DELETE /:id/items/:itemId with foreign item -> 404
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
Expected: FAIL with current permissive behavior.

**Step 3: Write minimal implementation**

```js
async function validatePreOrderBinding(db, items) {
  // for each pre_order_id validate order exists, variant_id/product_id match, and order status in allowed set
}

await validateVariantItems(c.env.DB, body.items);
await validatePreOrderBinding(c.env.DB, body.items);

const updated = await repo.updateItem(poId, itemId, body);
const removed = await repo.removeItem(poId, itemId);
```

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/purchase-orders.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js
git commit -m "fix: enforce pre-order binding integrity and po item scope"
```

---

### Task 5: Database Migration for orders.procurement_status

**Files:**
- Create: `migrations/0048_add_orders_procurement_status.sql`
- Modify: `docs/DATABASE_SCHEMA.md`

**Step 1: Write migration SQL with backfill**

```sql
ALTER TABLE orders ADD COLUMN procurement_status TEXT DEFAULT 'none' CHECK(procurement_status IN (
  'none', 'planned', 'ordered', 'partially_arrived', 'arrived'
));

UPDATE orders
SET procurement_status = CASE
  WHEN status IN ('production', 'shipping') THEN 'ordered'
  WHEN status IN ('arrived', 'delivered') THEN 'arrived'
  ELSE 'none'
END
WHERE procurement_status IS NULL OR procurement_status = '';

CREATE INDEX IF NOT EXISTS idx_orders_procurement_status ON orders(procurement_status);
```

**Step 2: Run migration prefix validation**

Run: `pnpm db:migrations:check-prefix`
Expected: PASS.

**Step 3: Document schema change**

Update order table section with new `procurement_status` field and enum definitions.

**Step 4: Apply migration in preview environment**

Run: `pnpm db:migrate:preview`
Expected: migration applied successfully.

**Step 5: Commit**

```bash
git add migrations/0048_add_orders_procurement_status.sql docs/DATABASE_SCHEMA.md
git commit -m "feat: add procurement_status to orders"
```

---

### Task 6: API Contract + Frontend Regression Coverage

**Files:**
- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Modify: `src/composables/usePurchaseOrders.js`
- Modify: `src/composables/__tests__/usePurchaseOrders.test.js`

**Step 1: Write failing frontend/composable test**

```js
it('shows backend cascade message from status update API', async () => {
  // mock PATCH response contains message with procurement cascade count
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/composables/__tests__/usePurchaseOrders.test.js`
Expected: FAIL (if message contract differs).

**Step 3: Update API response wording and keep backward compatibility**

```js
message: result.cascadedOrders > 0
  ? `状态已更新，同步更新了 ${result.cascadedOrders} 个预订单采购状态`
  : '状态已更新'
```

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/composables/__tests__/usePurchaseOrders.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/purchase-orders.js src/composables/usePurchaseOrders.js src/composables/__tests__/usePurchaseOrders.test.js
git commit -m "test+chore: align purchase status update message contract"
```

---

### Task 7: End-to-End Verification and Release Checklist

**Files:**
- Modify: `docs/plans/2026-03-06-order-procurement-status-decoupling-implementation-plan.md` (append verification output links)

**Step 1: Run targeted unit and route tests**

Run:
```bash
node node_modules/vitest/vitest.mjs run \
  functions/api/utils/__tests__/order-procurement-state-machine.test.js \
  functions/repositories/__tests__/purchase-order-repository-safety.test.js \
  functions/services/__tests__/PurchaseOrderService.procurement-status.test.js \
  functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js \
  src/composables/__tests__/usePurchaseOrders.test.js
```
Expected: all PASS.

**Step 2: Run lint for touched layers**

Run: `pnpm lint`
Expected: PASS (or pre-existing unrelated warnings only).

**Step 3: Manual smoke test in preview**

- Create draft PO with linked pre-order.
- Transition `draft -> ordered -> shipping -> arrived`.
- Verify `orders.status` unchanged and `orders.procurement_status` updated.
- Verify inventory increments once on `arrived` under repeated click attempts.

**Step 4: Prepare rollout steps**

- Merge backend first.
- Apply preview migration, then production migration.
- Deploy frontend after backend contract is live.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-06-order-procurement-status-decoupling-implementation-plan.md
git commit -m "docs: add verification checklist for procurement status decoupling"
```

---

## Phase 2 (Follow-up, separate plan)

1. Introduce `po_item_allocations` (many-to-many between order line and PO item).
2. Add `inbound_receipts` for partial receiving and receipt-level audit.
3. Move order procurement progress from item-level direct link to allocation aggregation.

## Phase 3 (Reliability hardening, separate plan)

1. Add `inventory_ledger` as source of truth and projection updater.
2. Add `outbox_events` + idempotent consumers.
3. Add force-transition audit pipeline (`reason`, `ticket_id`, `actor`, immutable log).

---

## Execution Notes (2026-03-06)

- ✅ Targeted tests passed:
  - `functions/api/utils/__tests__/order-procurement-state-machine.test.js`
  - `functions/repositories/__tests__/purchase-order-repository-safety.test.js`
  - `functions/services/__tests__/PurchaseOrderService.procurement-status.test.js`
  - `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
  - `src/composables/__tests__/usePurchaseOrders.test.js`
- ✅ Migration prefix validation passed:
  - `pnpm db:migrations:check-prefix`
- ⚠️ `pnpm lint` failed due pre-existing repository-wide issues (not introduced by this change set), including existing `vue/multi-word-component-names` and `no-undef` violations in unrelated files.

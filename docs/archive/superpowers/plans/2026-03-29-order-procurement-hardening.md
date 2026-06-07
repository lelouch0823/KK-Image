# Order Procurement Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate inventory corruption and stale read-model behavior in the order/procurement refactor, then align the system with multi-line order semantics.

**Architecture:** First remove duplicate stock mutation paths and add strict receipt guardrails so inventory correctness is restored immediately. Next replace all "first order line wins" compatibility logic with explicit line-aware or aggregated projections. Finally align compatibility read models and procurement status projections so old consumers remain coherent during migration.

**Tech Stack:** Cloudflare D1/SQLite, Hono routes, repository/service layer JS modules, Vitest

---

## File Map

**Critical inventory and receipt boundary**

- Modify: `functions/services/PurchaseOrderService.js`
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Test: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Test: `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
- Test: `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`

**Multi-line order compatibility boundary**

- Modify: `functions/services/InventoryService.js`
- Modify: `functions/services/DemandService.js`
- Modify: `functions/repositories/order/mutations.js`
- Modify: `functions/repositories/order/queries.js`
- Modify: `functions/repositories/order/helpers.js`
- Test: `functions/services/__tests__/InventoryService.test.js`
- Test: `functions/services/__tests__/DemandService.test.js`
- Test: `functions/repositories/__tests__/order-mutations.test.js`
- Test: `functions/repositories/__tests__/order-queries.display-model.test.js`

**Read-model consistency**

- Modify: `functions/repositories/GoodsOverviewRepository.js`
- Modify: `functions/repositories/PurchaseOrderRepository.js`
- Modify: `functions/lib/hono/routes/_shared/variant-replenishment.js`
- Test: `functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js`
- Test: `functions/repositories/__tests__/PurchaseOrderRepository.read-model.test.js`
- Test: `functions/lib/hono/routes/_shared/__tests__/variant-replenishment.test.js`

### Task 1: Stop Duplicate Inventory Inbound Paths

**Files:**

- Modify: `functions/services/PurchaseOrderService.js`
- Test: `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
- Test: `functions/services/__tests__/OrderProcurementDomainService.test.js`

- [ ] **Step 1: Write the failing test**

```js
it('does not increment stock again when po status moves to arrived after receipts already posted', async () => {
  // expect no purchase_order-level increment path on arrived
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
Expected: FAIL because `updateStatus()` still calls `_updateInventory(..., 'increment')` on `arrived`

- [ ] **Step 3: Write minimal implementation**

Implementation notes:

- Remove purchase-order-level stock increment from `PurchaseOrderService.updateStatus()`
- Keep receipt-driven inbound stock as the single source of truth
- Decide whether rollback on `cancelled` from `arrived` should be deleted entirely or guarded behind explicit reversal flow

- [ ] **Step 4: Run focused tests**

Run: `pnpm test:unit functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js functions/services/__tests__/OrderProcurementDomainService.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/services/PurchaseOrderService.js functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js functions/services/__tests__/OrderProcurementDomainService.test.js
git commit -m "fix: remove duplicate purchase arrival inventory path"
```

### Task 2: Enforce Receipt Guardrails

**Files:**

- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Test: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Test: `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`

- [ ] **Step 1: Write failing tests for illegal receipt cases**

```js
it('rejects receipts on draft cancelled or completed purchase orders', async () => {});
it('rejects receipt quantities beyond remaining open quantity', async () => {});
it('returns the remaining quantity error through the route', async () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test:unit functions/services/__tests__/OrderProcurementDomainService.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
Expected: FAIL because the domain only checks `received_qty > 0`

- [ ] **Step 3: Write minimal implementation**

Implementation notes:

- Load purchase order header status before accepting receipts
- Allow receipts only when PO status is `ordered` or `shipping`
- Compute `remainingReceivable = max(quantity - received_qty - cancelled_qty, 0)`
- Reject any receipt where `received_qty > remainingReceivable`
- Return explicit business errors, not generic 500s

- [ ] **Step 4: Run focused tests**

Run: `pnpm test:unit functions/services/__tests__/OrderProcurementDomainService.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/services/OrderProcurementDomainService.js functions/lib/hono/routes/manage/purchase-orders.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js
git commit -m "fix: enforce purchase receipt state and quantity guards"
```

### Task 3: Restore Compatibility Procurement Status After Receipts

**Files:**

- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/repositories/order/queries.js`
- Test: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Test: `functions/repositories/__tests__/order-queries.display-model.test.js`

- [ ] **Step 1: Write the failing test**

```js
it('projects compatibility procurement_status after partial and full receipts', async () => {});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit functions/services/__tests__/OrderProcurementDomainService.test.js functions/repositories/__tests__/order-queries.display-model.test.js`
Expected: FAIL because receipt flow does not update `orders.procurement_status`

- [ ] **Step 3: Write minimal implementation**

Implementation notes:

- After item-level receipt update, compute linked order compatibility procurement status
- Use `partially_arrived` when some but not all linked quantity is received
- Use `arrived` only when outstanding linked quantity reaches zero
- Keep legacy field until all consumers migrate

- [ ] **Step 4: Run focused tests**

Run: `pnpm test:unit functions/services/__tests__/OrderProcurementDomainService.test.js functions/repositories/__tests__/order-queries.display-model.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/services/OrderProcurementDomainService.js functions/repositories/order/queries.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/repositories/__tests__/order-queries.display-model.test.js
git commit -m "fix: sync compatibility procurement status after receipts"
```

### Task 4: Remove First-Line Assumptions From Inventory and Demand Events

**Files:**

- Modify: `functions/services/InventoryService.js`
- Modify: `functions/services/DemandService.js`
- Modify: `functions/services/OrderProcurementDomainService.js`
- Test: `functions/services/__tests__/InventoryService.test.js`
- Test: `functions/services/__tests__/DemandService.test.js`
- Test: `functions/services/__tests__/OrderProcurementDomainService.test.js`

- [ ] **Step 1: Write failing tests for explicit line-aware behavior**

```js
it('requires orderLineId for line-scoped inventory mutations when multiple lines exist', async () => {});
it('does not silently resolve the first order line for demand events', async () => {});
it('receipt flow updates only the linked order line instead of all order lines', async () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test:unit functions/services/__tests__/InventoryService.test.js functions/services/__tests__/DemandService.test.js functions/services/__tests__/OrderProcurementDomainService.test.js`
Expected: FAIL because services still pick `ORDER BY created_at ASC LIMIT 1`

- [ ] **Step 3: Write minimal implementation**

Implementation notes:

- Replace `resolveOrderLineId(orderId)` fallback with explicit `orderLineId` when line-scoped mutation is required
- If only legacy `orderId` is available, either aggregate safely or reject ambiguous multi-line cases
- Update receipt linkage to target the actual linked line rather than `WHERE order_id = ?`

- [ ] **Step 4: Run focused tests**

Run: `pnpm test:unit functions/services/__tests__/InventoryService.test.js functions/services/__tests__/DemandService.test.js functions/services/__tests__/OrderProcurementDomainService.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/services/InventoryService.js functions/services/DemandService.js functions/services/OrderProcurementDomainService.js functions/services/__tests__/InventoryService.test.js functions/services/__tests__/DemandService.test.js functions/services/__tests__/OrderProcurementDomainService.test.js
git commit -m "fix: remove first-line fallback from order event projections"
```

### Task 5: Remove Whole-Order Updates Against `order_lines`

**Files:**

- Modify: `functions/repositories/order/mutations.js`
- Modify: `functions/repositories/order/queries.js`
- Modify: `functions/repositories/order/helpers.js`
- Test: `functions/repositories/__tests__/order-mutations.test.js`
- Test: `functions/repositories/__tests__/order-queries.display-model.test.js`

- [ ] **Step 1: Write failing tests**

```js
it('does not update every line when syncing compatibility snapshot for an order edit', async () => {});
it('aggregates order display status across lines instead of taking the first line', async () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test:unit functions/repositories/__tests__/order-mutations.test.js functions/repositories/__tests__/order-queries.display-model.test.js`
Expected: FAIL because current SQL uses `WHERE order_id = ?` and list/detail read `LIMIT 1`

- [ ] **Step 3: Write minimal implementation**

Implementation notes:

- Stop treating compatibility sync as “update every line for this order”
- Introduce explicit aggregation helper for order header `displayStatus`
- Keep details returning `lines`, but make list/detail header status aggregated deterministically

- [ ] **Step 4: Run focused tests**

Run: `pnpm test:unit functions/repositories/__tests__/order-mutations.test.js functions/repositories/__tests__/order-queries.display-model.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/repositories/order/mutations.js functions/repositories/order/queries.js functions/repositories/order/helpers.js functions/repositories/__tests__/order-mutations.test.js functions/repositories/__tests__/order-queries.display-model.test.js
git commit -m "fix: aggregate order display state instead of first-line fallbacks"
```

### Task 6: Align Goods Overview Summary and Filters With Remaining Demand

**Files:**

- Modify: `functions/repositories/GoodsOverviewRepository.js`
- Test: `functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js`

- [ ] **Step 1: Write failing tests**

```js
it('excludes zero-remaining-demand lines from available filters', async () => {});
it('counts only variants with remaining demand in summary totals', async () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test:unit functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js`
Expected: FAIL because `getAvailableFilters()` and `getSummary()` currently include active zero-remaining lines

- [ ] **Step 3: Write minimal implementation**

Implementation notes:

- Apply `REMAINING_DEMAND_EXPR > 0` consistently to list, filters, and summary
- Keep order-count semantics explicit: distinct order count vs variant count

- [ ] **Step 4: Run focused tests**

Run: `pnpm test:unit functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/repositories/GoodsOverviewRepository.js functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js
git commit -m "fix: align goods overview filters and summary with remaining demand"
```

### Task 7: Add Transaction and Concurrency Protection to Receipt Writes

**Files:**

- Modify: `functions/services/OrderProcurementDomainService.js`
- Test: `functions/services/__tests__/OrderProcurementDomainService.test.js`

- [ ] **Step 1: Write failing tests**

```js
it('does not over-apply concurrent receipt increments', async () => {});
it('fails without partial persistence when downstream write errors', async () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test:unit functions/services/__tests__/OrderProcurementDomainService.test.js`
Expected: FAIL because writes are currently read-then-write and non-transactional

- [ ] **Step 3: Write minimal implementation**

Implementation notes:

- Prefer atomic SQL update pattern with remaining-cap guard
- If D1 transaction support in this repo pattern is limited, at minimum reorder writes to validate and reserve update before creating receipt row
- Add explicit compensating behavior or fail-fast strategy so partial persistence is impossible or detectable

- [ ] **Step 4: Run focused tests**

Run: `pnpm test:unit functions/services/__tests__/OrderProcurementDomainService.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/services/OrderProcurementDomainService.js functions/services/__tests__/OrderProcurementDomainService.test.js
git commit -m "fix: harden receipt writes against concurrency and partial persistence"
```

### Task 8: Full Regression Pass

**Files:**

- Verify only: existing touched files above

- [ ] **Step 1: Run procurement and order regression suite**

Run: `pnpm test:unit scripts/__tests__/backfill-order-lines.test.js scripts/__tests__/check-migration-prefixes.test.js scripts/__tests__/init-database-bootstrap-consistency.test.js functions/repositories/__tests__/order-mutations.test.js functions/repositories/__tests__/order-inventory-flow.test.js functions/repositories/__tests__/order-helpers.procurement-status.test.js functions/repositories/__tests__/order-queries.display-model.test.js functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js functions/repositories/__tests__/PurchaseOrderRepository.read-model.test.js functions/services/__tests__/OrderStatusProjectionService.test.js functions/services/__tests__/InventoryProjectionService.test.js functions/services/__tests__/DemandService.test.js functions/services/__tests__/DemandReservationProjection.test.js functions/services/__tests__/InventoryService.test.js functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/lib/hono/routes/_shared/__tests__/variant-replenishment.test.js`
Expected: PASS with zero failed tests

- [ ] **Step 2: Review residual risks**

Checklist:

- No duplicate inbound stock source remains
- Illegal receipts are rejected
- Multi-line orders no longer use first-line fallbacks
- Compatibility order header fields are still coherent
- Goods overview counts match list semantics

- [ ] **Step 3: Commit final stabilization batch**

```bash
git add functions/services/PurchaseOrderService.js functions/services/OrderProcurementDomainService.js functions/services/InventoryService.js functions/services/DemandService.js functions/repositories/order/mutations.js functions/repositories/order/queries.js functions/repositories/order/helpers.js functions/repositories/GoodsOverviewRepository.js functions/repositories/PurchaseOrderRepository.js functions/lib/hono/routes/manage/purchase-orders.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js functions/services/__tests__/InventoryService.test.js functions/services/__tests__/DemandService.test.js functions/repositories/__tests__/order-mutations.test.js functions/repositories/__tests__/order-queries.display-model.test.js functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js functions/repositories/__tests__/PurchaseOrderRepository.read-model.test.js
git commit -m "fix: harden order procurement projections and receipts"
```

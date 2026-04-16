# Purchase Order Arrived Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce that a purchase order can enter `arrived` only when its receivable quantity is fully closed, and hide the `arrived` transition in the admin UI while outstanding quantity remains.

**Architecture:** Keep the backend as the source of truth by validating `shipping -> arrived` inside `PurchaseOrderService.updateStatus()` using the purchase-order aggregate quantities already returned by `PurchaseOrderRepository.findById()`. Mirror that same rule in `PurchaseOrders.vue` so the UI does not offer an invalid transition when `outstanding_qty > 0`, while still relying on backend rejection for safety.

**Tech Stack:** JavaScript, Vue 3 Composition API, Vitest, Hono service layer

---

## File Structure

- Modify: `functions/services/PurchaseOrderService.js`
  - Add the business guard for `shipping -> arrived`
  - Reuse existing aggregate progress fields when available
- Modify: `functions/services/__tests__/PurchaseOrderService.procurement-status.test.js`
  - Add focused service-level tests for the new arrived gate
- Modify: `src/views/PurchaseOrders.vue`
  - Prevent the `arrived` action from appearing while outstanding quantity remains
- Modify: `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
  - Add UI tests covering the hidden/shown transition affordance

### Task 1: Enforce Arrival Gate In The Service

**Files:**
- Modify: `functions/services/__tests__/PurchaseOrderService.procurement-status.test.js`
- Modify: `functions/services/PurchaseOrderService.js`

- [ ] **Step 1: Write the failing test**

Add focused tests in `functions/services/__tests__/PurchaseOrderService.procurement-status.test.js`:

```js
it('rejects shipping -> arrived when outstanding quantity remains', async () => {
  const db = createDb();
  const service = new PurchaseOrderService(db);
  service.repo = {
    findById: vi.fn(async () => ({
      id: 'po-1',
      status: 'shipping',
      ordered_qty: 10,
      received_qty: 4,
      cancelled_qty: 1,
      outstanding_qty: 5,
      items: [],
    })),
    updateStatus: vi.fn(async () => true),
    updateStatusIfCurrent: vi.fn(async () => true),
    getLinkedOrderIds: vi.fn(async () => []),
  };

  await expect(service.updateStatus('po-1', 'arrived')).rejects.toThrow(/待收|outstanding|未收/);
});

it('allows shipping -> arrived when outstanding quantity is zero after receipt closure', async () => {
  const db = createDb();
  const service = new PurchaseOrderService(db);
  service.repo = {
    findById: vi.fn(async () => ({
      id: 'po-1',
      status: 'shipping',
      ordered_qty: 10,
      received_qty: 8,
      cancelled_qty: 2,
      outstanding_qty: 0,
      items: [],
    })),
    updateStatus: vi.fn(async () => true),
    updateStatusIfCurrent: vi.fn(async () => true),
    getLinkedOrderIds: vi.fn(async () => []),
  };

  await expect(service.updateStatus('po-1', 'arrived')).resolves.toMatchObject({
    success: true,
    targetProcurementStatus: 'arrived',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test:unit functions/services/__tests__/PurchaseOrderService.procurement-status.test.js
```

Expected: FAIL because `updateStatus()` currently allows `shipping -> arrived` without checking `outstanding_qty`.

- [ ] **Step 3: Write minimal implementation**

Update `functions/services/PurchaseOrderService.js` to guard the transition before the CAS update:

```js
function resolveOutstandingQty(po = {}) {
  if (po.outstanding_qty != null) return Math.max(Number(po.outstanding_qty) || 0, 0);

  return Math.max(
    (Number(po.ordered_qty) || 0) - (Number(po.received_qty) || 0) - (Number(po.cancelled_qty) || 0),
    0
  );
}

if (po.status === 'shipping' && newStatus === 'arrived') {
  const outstandingQty = resolveOutstandingQty(po);
  if (outstandingQty > 0) {
    throw new BadRequestError(`采购单仍有待收数量 ${outstandingQty}，不能标记为已入库`);
  }
}
```

Keep the check local to the service. Do not move status validation into the route.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm test:unit functions/services/__tests__/PurchaseOrderService.procurement-status.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/services/PurchaseOrderService.js functions/services/__tests__/PurchaseOrderService.procurement-status.test.js
git commit -m "fix: gate purchase order arrival on receipt closure"
```

### Task 2: Hide The Invalid Arrived Action In The Admin UI

**Files:**
- Modify: `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
- Modify: `src/views/PurchaseOrders.vue`

- [ ] **Step 1: Write the failing test**

Add UI coverage in `src/views/__tests__/PurchaseOrders.detail-shell.test.js`:

```js
it('does not offer arrived transition while the purchase order still has outstanding quantity', () => {
  mocks.detailState.detailLoading = false;
  mocks.detailState.detail = {
    id: 'po-1',
    po_no: 'PO-20260312-001',
    status: 'shipping',
    outstanding_qty: 5,
    ordered_qty: 10,
    received_qty: 4,
    cancelled_qty: 1,
    items: [],
    receipts: [],
  };

  const wrapper = mountPurchaseOrders();

  expect(wrapper.text()).not.toContain('已入库待结算');
});

it('offers arrived transition once outstanding quantity is zero', () => {
  mocks.detailState.detailLoading = false;
  mocks.detailState.detail = {
    id: 'po-1',
    po_no: 'PO-20260312-001',
    status: 'shipping',
    outstanding_qty: 0,
    ordered_qty: 10,
    received_qty: 8,
    cancelled_qty: 2,
    items: [],
    receipts: [],
  };

  const wrapper = mountPurchaseOrders();

  expect(wrapper.text()).toContain('已入库待结算');
});
```

If introducing a small local `mountPurchaseOrders()` helper reduces duplication in the test file, keep it scoped to this file only.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test:unit src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

Expected: FAIL because `nextStatuses` currently always exposes `arrived` for `shipping`.

- [ ] **Step 3: Write minimal implementation**

Update `src/views/PurchaseOrders.vue` so `nextStatuses` uses the current detail progress:

```js
const canAdvanceToArrived = computed(() => {
  if (!detail.value) return false;
  return Number(detail.value.outstanding_qty || 0) <= 0;
});

const nextStatuses = computed(() => {
  if (!detail.value) return [];
  if (detail.value.status === 'shipping') {
    return canAdvanceToArrived.value ? ['arrived'] : [];
  }
  const map = {
    draft: ['ordered', 'cancelled'],
    ordered: ['shipping', 'cancelled'],
    arrived: ['completed'],
  };
  return map[detail.value.status] || [];
});
```

Do not add frontend-only semantics that diverge from the backend. The UI rule should match the same `outstanding_qty == 0` rule.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm test:unit src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.detail-shell.test.js
git commit -m "fix: hide arrived transition until receipts close"
```

### Task 3: Run Focused Regression Verification

**Files:**
- Modify: none
- Test: `functions/services/__tests__/PurchaseOrderService.procurement-status.test.js`
- Test: `src/views/__tests__/PurchaseOrders.detail-shell.test.js`

- [ ] **Step 1: Run the focused backend and frontend tests together**

Run:

```bash
pnpm test:unit functions/services/__tests__/PurchaseOrderService.procurement-status.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

Expected: PASS

- [ ] **Step 2: Check for unintended breakage in purchase-order read-model expectations**

Run:

```bash
pnpm test:unit functions/repositories/__tests__/PurchaseOrderRepository.read-model.test.js
```

Expected: PASS because this change relies on existing aggregate progress fields rather than redefining them.

- [ ] **Step 3: Review the diff for accidental scope creep**

Run:

```bash
git diff -- functions/services/PurchaseOrderService.js functions/services/__tests__/PurchaseOrderService.procurement-status.test.js src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

Expected: only the arrival gate, matching tests, and the UI affordance changes.

- [ ] **Step 4: Commit verification-only cleanups if needed**

```bash
git add functions/services/PurchaseOrderService.js functions/services/__tests__/PurchaseOrderService.procurement-status.test.js src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.detail-shell.test.js
git commit -m "test: cover purchase order arrival gating"
```

## Notes

- Follow `@superpowers:test-driven-development`: no production change before the failing test is observed.
- Before claiming completion, follow `@superpowers:verification-before-completion` and include the exact commands that passed.
- Keep this change intentionally narrow. Do not add a new settlement state model in this patch.

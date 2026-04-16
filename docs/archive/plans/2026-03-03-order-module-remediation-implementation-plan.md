# Order Module Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce "no insufficient-stock delivery" and convert order-module findings into shippable fixes with atomic write safety, API/UI consistency, and an executable remediation checklist.

**Architecture:** Add a stock-sufficiency guard at repository mutation level so every status change path (single and batch) blocks invalid `delivered` transitions. Refactor the order update workflow to execute core order writes in one batch operation, then perform timeline/notification as post-write side effects. Align admin order patch API response with frontend optimistic update to prevent client/server divergence.

**Tech Stack:** Cloudflare Pages Functions (Hono), D1 SQL, Vitest, Vue 3 composables.

---

### Task 1: Block Insufficient Stock Before `delivered`

**Files:**
- Modify: `functions/repositories/order/mutations.js`
- Test: `functions/repositories/__tests__/order-inventory-flow.test.js`

**Skill refs:** `@superpowers:test-driven-development` `@superpowers:verification-before-completion`

**Step 1: Write the failing tests**

```javascript
it('rejects delivered transition when variant stock is lower than order quantity', async () => {
  const db = createMockDb({
    singleOrder: { status: 'pending', variant_id: 'v-1', quantity: 3 },
    variantStockById: { 'v-1': 2 },
  });

  await expect(updateStatus(db, 'o-1', 'delivered', 'admin'))
    .rejects.toThrow(/insufficient variant stock/i);
});

it('rejects batch status update when any delivered transition is short on stock', async () => {
  const db = createMockDb({
    batchOrders: [
      { id: 'o-1', status: 'pending', variant_id: 'v-1', quantity: 5 },
      { id: 'o-2', status: 'pending', variant_id: 'v-2', quantity: 1 },
    ],
    variantStockById: { 'v-1': 4, 'v-2': 10 },
  });

  await expect(batchUpdateStatus(db, timelineRepo, ['o-1', 'o-2'], 'delivered'))
    .rejects.toThrow(/insufficient variant stock/i);
  expect(db.batch).not.toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run functions/repositories/__tests__/order-inventory-flow.test.js`
Expected: FAIL with missing insufficient-stock guard.

**Step 3: Write minimal implementation**

```javascript
const INSUFFICIENT_VARIANT_STOCK_ERROR = 'insufficient variant stock for delivery';

async function assertVariantStockSufficient(db, variantId, requiredQty) {
  const row = await db.prepare('SELECT stock_quantity FROM product_variants WHERE id = ?').bind(variantId).first();
  const stock = Math.max(0, Number(row?.stock_quantity) || 0);
  if (stock < requiredQty) throw new Error(INSUFFICIENT_VARIANT_STOCK_ERROR);
}

// in updateStatus: before deducting on delivered transition
if (oldStatus !== 'delivered' && newStatus === 'delivered' && currentOrder?.variant_id) {
  await assertVariantStockSufficient(db, currentOrder.variant_id, safeQty);
}

// in batchUpdateStatus: preflight all rows that will transition into delivered
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run functions/repositories/__tests__/order-inventory-flow.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/repositories/order/mutations.js functions/repositories/__tests__/order-inventory-flow.test.js
git commit -m "fix(order): block delivered transition when variant stock is insufficient"
```

### Task 2: Map Stock Guard Errors to 400 in Admin Status APIs

**Files:**
- Modify: `functions/lib/hono/routes/manage/orders/detail.js`
- Modify: `functions/lib/hono/routes/manage/orders/create.js`
- Test: `functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js`
- Test: `functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js`

**Skill refs:** `@superpowers:test-driven-development` `@superpowers:verification-before-completion`

**Step 1: Write the failing route tests**

```javascript
it('returns 400 when PATCH /:id/status tries delivered with insufficient stock', async () => {
  mocks.updateStatus.mockRejectedValue(new Error('insufficient variant stock for delivery'));
  const res = await app.request('http://localhost/api/manage/orders/order-1/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'delivered' }),
  }, env, ctx);
  expect(res.status).toBe(400);
});

it('returns 400 when batch action transitions to delivered with insufficient stock', async () => {
  mocks.batchUpdateStatus.mockRejectedValue(new Error('insufficient variant stock for delivery'));
  const res = await app.request('http://localhost/api/manage/orders/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: ['o-1'], action: 'status', value: 'delivered' }),
  }, env, ctx);
  expect(res.status).toBe(400);
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js`
Expected: FAIL, current code bubbles generic error.

**Step 3: Write minimal implementation**

```javascript
const isInsufficientStockError = (err) =>
  String(err?.message || '').includes('insufficient variant stock');

try {
  await repo.updateStatus(id, status, 'admin');
} catch (error) {
  if (isInsufficientStockError(error)) {
    throw new BadRequestError('Insufficient stock: cannot mark order as delivered');
  }
  throw error;
}
```

Apply same handling around `batchUpdateStatus` in `/batch` route.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/orders/detail.js functions/lib/hono/routes/manage/orders/create.js functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js
git commit -m "fix(order): return 400 for insufficient-stock delivered transitions"
```

### Task 3: Make `processOrderUpdate` Core Writes Atomic

**Files:**
- Modify: `functions/repositories/order/mutations.js`
- Modify: `functions/repositories/OrderRepository.js`
- Modify: `functions/api/utils/order-utils.js`
- Test: `functions/api/utils/__tests__/order-utils.test.js`
- Test: `functions/repositories/__tests__/order-mutations.test.js`

**Skill refs:** `@superpowers:test-driven-development` `@superpowers:verification-before-completion`

**Step 1: Write failing tests for partial-write prevention**

```javascript
it('does not send notification when core order write batch fails', async () => {
  vi.spyOn(OrderRepository.prototype, 'updateComposite').mockRejectedValue(new Error('db failed'));
  await expect(processOrderUpdate(options)).rejects.toThrow('db failed');
  expect(createOrderNotificationSpy).not.toHaveBeenCalled();
});

it('calls one composite write for status+data+binding+files', async () => {
  const spy = vi.spyOn(OrderRepository.prototype, 'updateComposite').mockResolvedValue({ success: true });
  await processOrderUpdate(optionsWithStatusAndFiles);
  expect(spy).toHaveBeenCalledTimes(1);
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run functions/api/utils/__tests__/order-utils.test.js functions/repositories/__tests__/order-mutations.test.js`
Expected: FAIL because `updateComposite` path does not exist.

**Step 3: Write minimal implementation**

```javascript
// mutations.js
export async function updateComposite(db, payload) {
  const statements = [];
  // optional status update statement
  // main order update statement for current_data + quantity + product_id + variant_id + unread + updated_at
  // optional order_files replace + main_image_id update statements
  await db.batch(statements);
}

// OrderRepository.js
async updateComposite(payload) {
  return mutations.updateComposite(this.db, payload);
}

// order-utils.js
await orderRepo.updateComposite({ ...computedChanges });
// only after success: timeline + notification
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run functions/api/utils/__tests__/order-utils.test.js functions/repositories/__tests__/order-mutations.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/repositories/order/mutations.js functions/repositories/OrderRepository.js functions/api/utils/order-utils.js functions/api/utils/__tests__/order-utils.test.js functions/repositories/__tests__/order-mutations.test.js
git commit -m "refactor(order): execute core order patch writes in one composite batch"
```

### Task 4: Align Admin PATCH Response with Frontend State Replacement

**Files:**
- Modify: `functions/lib/hono/routes/manage/orders/detail.js`
- Modify: `src/composables/useOrders.js`
- Test: `functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js`
- Test: `src/composables/__tests__/useOrders.update-order.test.js`

**Skill refs:** `@superpowers:test-driven-development` `@superpowers:verification-before-completion`

**Step 1: Write failing tests for response contract + UI replacement**

```javascript
it('PATCH /:id returns updated order data payload', async () => {
  mocks.findById
    .mockResolvedValueOnce(existingOrder)
    .mockResolvedValueOnce(updatedOrder);
  const res = await app.request('http://localhost/api/manage/orders/order-1', patchReq, env, ctx);
  const body = await res.json();
  expect(body.data).toMatchObject({ id: 'order-1', status: 'confirmed' });
});

it('updateOrder replaces optimistic item with server data when present', async () => {
  mocks.authFetch.mockResolvedValue({ json: async () => ({ success: true, data: { id: 'o-1', name: 'server' } }) });
  await updateOrder('o-1', { name: 'optimistic' }, 'reason');
  expect(mocks.resource.items.value[0].name).toBe('server');
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js src/composables/__tests__/useOrders.update-order.test.js`
Expected: FAIL because response has no `data` and frontend does not replace with server payload.

**Step 3: Write minimal implementation**

```javascript
// detail.js after successful processOrderUpdate
const updatedOrder = await orderRepo.findById(id);
return c.json({ success: true, message: MSG.ORDER.UPDATE_SUCCESS, data: updatedOrder });

// useOrders.js
if (res.success && res.data && idx !== -1) {
  resource.items.value[idx] = res.data;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js src/composables/__tests__/useOrders.update-order.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/orders/detail.js src/composables/useOrders.js functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js src/composables/__tests__/useOrders.update-order.test.js
git commit -m "feat(order): return updated order on patch and sync optimistic UI with server payload"
```

### Task 5: Rewrite Review Doc into Executable Remediation Checklist

**Files:**
- Modify: `docs/reviews/order-module-logic-issues.md`
- Modify: `docs/plans/2026-03-03-order-module-remediation-implementation-plan.md` (if scope changes during implementation)

**Skill refs:** `@superpowers:verification-before-completion`

**Step 1: Convert report sections to execution format**

```markdown
## P0 (Must Fix Before Release)
- [ ] Block insufficient-stock delivered transitions
  - Files: ...
  - Tests: ...
  - Done when: ...
```

**Step 2: Add acceptance criteria per item**

```markdown
### Acceptance
- API returns 400 with clear message when stock < quantity and status=delivered.
- No stock deduction SQL runs for blocked transition.
```

**Step 3: Add verification command matrix**

```markdown
- `npx vitest run functions/repositories/__tests__/order-inventory-flow.test.js`
- `npx vitest run functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js`
- `npx vitest run functions/api/utils/__tests__/order-utils.test.js src/composables/__tests__/useOrders.update-order.test.js`
```

**Step 4: Validate docs consistency**

Run: `rg -n "L3|L4|事务|库存扣减" docs/reviews/order-module-logic-issues.md`
Expected: No stale "already correct" wording for unresolved P0 items.

**Step 5: Commit**

```bash
git add docs/reviews/order-module-logic-issues.md docs/plans/2026-03-03-order-module-remediation-implementation-plan.md
git commit -m "docs(order): convert review findings into executable remediation checklist"
```

---

## Final Verification Gate

Run full verification before closing implementation:

```bash
npx vitest run functions/repositories/__tests__/order-inventory-flow.test.js functions/repositories/__tests__/order-mutations.test.js functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js functions/api/utils/__tests__/order-utils.test.js src/composables/__tests__/useOrders.update-order.test.js
```

Expected: all tests PASS, no new failures.

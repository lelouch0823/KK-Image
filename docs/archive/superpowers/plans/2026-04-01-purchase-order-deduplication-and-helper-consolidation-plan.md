# Purchase Order Deduplication And Helper Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the duplicate purchase-order helper logic introduced or exposed by the current remediation work so backend services, purchase-order routes, and purchase-order frontend screens all derive the same behavior from one local source per runtime.

**Architecture:** Keep this pass tightly scoped to the purchase-order remediation surface. Extract one backend shared helper module for order-procurement command services, one frontend shared progress helper module for the purchase-order screen, and one frontend request-helper module for purchase-order fetch/idempotency behavior. Do not broaden this pass into cross-runtime shared packages or repo-wide generic request abstraction work.

**Tech Stack:** JavaScript, Hono, Vue 3 Composition API, Vitest, Cloudflare D1, ESLint

---

## File Structure

- Create: `functions/services/order-procurement-shared.js`
  - Shared backend helpers for replay parsing, command cleanup statements, order-line lookup, and compatibility procurement aggregation
- Create: `functions/services/__tests__/order-procurement-shared.test.js`
  - Focused unit coverage for the extracted backend helper module
- Modify: `functions/services/OrderProcurementDomainService.js`
  - Remove duplicated helper definitions and consume the shared backend helper module
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`
  - Remove duplicated helper definitions and consume the shared backend helper module
- Modify: `functions/services/PurchaseOrderShortageClosureService.js`
  - Reuse shared replay/cleanup helpers instead of keeping local copies
- Modify: `functions/services/__tests__/OrderProcurementDomainService.test.js`
  - Keep receipt-recording coverage green after helper extraction
- Modify: `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
  - Keep reversal preflight/replay coverage green after helper extraction
- Modify: `functions/services/__tests__/PurchaseOrderShortageClosureService.test.js`
  - Keep finalize-failure rollback and replay coverage green after helper extraction
- Create: `src/utils/purchase-order-progress.js`
  - Shared progress calculators for purchase-order detail gating and display summaries
- Create: `src/utils/__tests__/purchase-order-progress.test.js`
  - Pure helper tests for ordered/received/outstanding progress calculations
- Create: `src/utils/purchase-order-request.js`
  - Purchase-order-local cache-bust and idempotent JSON header helpers
- Create: `src/utils/__tests__/purchase-order-request.test.js`
  - Pure helper tests for cache-busting and idempotency header generation
- Modify: `src/composables/usePurchaseOrders.js`
  - Replace local cache-bust/idempotency helpers with imports from `src/utils/purchase-order-request.js`
- Modify: `src/composables/__tests__/usePurchaseOrders.test.js`
  - Keep purchase-order request behavior covered after helper extraction
- Modify: `src/views/PurchaseOrders.vue`
  - Replace duplicate local progress helpers with imports from `src/utils/purchase-order-progress.js` and remove the now-unused `loadStats` destructure
- Modify: `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
  - Keep status-gating and detail refresh coverage green after helper extraction

## Task 1: Extract Backend Order-Procurement Shared Helpers

**Files:**

- Create: `functions/services/__tests__/order-procurement-shared.test.js`
- Create: `functions/services/order-procurement-shared.js`

- [ ] **Step 1: Write the failing backend helper tests**

Create `functions/services/__tests__/order-procurement-shared.test.js` with focused tests like:

```js
import { describe, expect, it, vi } from 'vitest';
import {
  buildDeleteCommandStatement,
  parseStoredResponse,
  queryCompatibilityProcurementAggregate,
  requireOrderLine,
} from '../order-procurement-shared.js';

describe('order-procurement-shared', () => {
  it('parses stored command responses defensively', () => {
    expect(parseStoredResponse('{"ok":true}')).toEqual({ ok: true });
    expect(parseStoredResponse('not-json')).toBeNull();
    expect(parseStoredResponse('')).toBeNull();
  });

  it('builds the command cleanup statement against command_idempotency', () => {
    const bind = vi.fn(() => ({ sql: 'bound' }));
    const prepare = vi.fn(() => ({ bind }));
    buildDeleteCommandStatement({ prepare }, 'cmd-1');
    expect(prepare).toHaveBeenCalledWith('DELETE FROM command_idempotency WHERE command_id = ?');
  });

  it('loads one order line scoped by order id', async () => {
    const first = vi.fn(async () => ({ id: 'line-1', order_id: 'order-1' }));
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first })) })) };
    await expect(requireOrderLine(db, 'order-1', 'line-1')).resolves.toMatchObject({
      id: 'line-1',
    });
  });

  it('aggregates compatibility procurement counters for one order', async () => {
    const first = vi.fn(async () => ({
      ordered_qty: 10,
      procured_qty: 10,
      received_qty: 4,
      cancelled_qty: 1,
    }));
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first })) })) };
    await expect(queryCompatibilityProcurementAggregate(db, 'order-1')).resolves.toEqual({
      ordered_qty: 10,
      procured_qty: 10,
      received_qty: 4,
      cancelled_qty: 1,
    });
  });
});
```

- [ ] **Step 2: Run the new backend helper tests to verify RED**

Run:

```bash
pnpm vitest run functions/services/__tests__/order-procurement-shared.test.js
```

Expected: FAIL because `functions/services/order-procurement-shared.js` does not exist yet.

- [ ] **Step 3: Implement the shared backend helper module**

Create `functions/services/order-procurement-shared.js`:

```js
import { NotFoundError } from '../lib/hono/errors.js';
import { toNonNegativeInt } from './purchase-order-projection.js';

export function parseStoredResponse(responseJson) {
  if (!responseJson) return null;
  try {
    return JSON.parse(responseJson);
  } catch {
    return null;
  }
}

export function buildDeleteCommandStatement(db, commandId) {
  return db.prepare('DELETE FROM command_idempotency WHERE command_id = ?').bind(commandId);
}

export async function requireOrderLine(db, orderId, orderLineId) {
  const row = await db
    .prepare(
      `SELECT id, order_id, product_id, variant_id, ordered_qty, procured_qty, received_qty, reserved_qty, shipped_qty, cancelled_qty
       FROM order_lines
       WHERE id = ? AND order_id = ?`
    )
    .bind(orderLineId, orderId)
    .first();

  if (!row) throw new NotFoundError('关联订单行不存在');
  return row;
}

export async function queryCompatibilityProcurementAggregate(db, orderId) {
  const progress = await db
    .prepare(
      `SELECT
          COALESCE(SUM(ordered_qty), 0) AS ordered_qty,
          COALESCE(SUM(procured_qty), 0) AS procured_qty,
          COALESCE(SUM(received_qty), 0) AS received_qty,
          COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty
       FROM order_lines
       WHERE order_id = ?`
    )
    .bind(orderId)
    .first();

  return {
    ordered_qty: toNonNegativeInt(progress?.ordered_qty),
    procured_qty: toNonNegativeInt(progress?.procured_qty),
    received_qty: toNonNegativeInt(progress?.received_qty),
    cancelled_qty: toNonNegativeInt(progress?.cancelled_qty),
  };
}
```

- [ ] **Step 4: Re-run the backend helper tests to verify GREEN**

Run:

```bash
pnpm vitest run functions/services/__tests__/order-procurement-shared.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/services/order-procurement-shared.js functions/services/__tests__/order-procurement-shared.test.js
git commit -m "refactor: extract shared order procurement helpers"
```

## Task 2: Rewire Purchase-Order Command Services To The Shared Backend Module

**Files:**

- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`
- Modify: `functions/services/PurchaseOrderShortageClosureService.js`
- Modify: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Modify: `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
- Modify: `functions/services/__tests__/PurchaseOrderShortageClosureService.test.js`

- [ ] **Step 1: Add regression assertions that the services no longer depend on private duplicate helpers**

Extend the existing service tests with assertions that still exercise replay parsing and cleanup paths after extraction. Keep the focus behavioral, for example:

```js
expect(
  harness.calls.runStatements.some((statement) =>
    statement.sql.includes('DELETE FROM command_idempotency')
  )
).toBe(true);
```

For the reversal/domain harnesses, keep one assertion around the order-line aggregate path so the shared aggregate helper is exercised through real service behavior.

- [ ] **Step 2: Run the targeted service suites to verify RED**

Run:

```bash
pnpm vitest run \
  functions/services/__tests__/OrderProcurementDomainService.test.js \
  functions/services/__tests__/OrderProcurementReceiptReversalService.test.js \
  functions/services/__tests__/PurchaseOrderShortageClosureService.test.js
```

Expected: at least one suite FAILS once the new assertions reference behavior not yet wired through the extracted helper.

- [ ] **Step 3: Replace duplicated local helpers with imports**

Update `functions/services/OrderProcurementDomainService.js`:

```js
import {
  buildDeleteCommandStatement,
  parseStoredResponse,
  queryCompatibilityProcurementAggregate,
  requireOrderLine,
} from './order-procurement-shared.js';
```

Then:

- remove the local `parseStoredResponse(...)`
- remove the local `buildDeleteCommandStatement(...)`
- remove the class method `requireOrderLine(...)`
- remove the class method `queryCompatibilityProcurementAggregate(...)`
- replace calls such as `await this.requireOrderLine(...)` with `await requireOrderLine(this.db, ...)`
- replace calls such as `await this.queryCompatibilityProcurementAggregate(...)` with `await queryCompatibilityProcurementAggregate(this.db, ...)`

Apply the same pattern in `functions/services/OrderProcurementReceiptReversalService.js`.

In `functions/services/PurchaseOrderShortageClosureService.js`, import only:

```js
import { buildDeleteCommandStatement, parseStoredResponse } from './order-procurement-shared.js';
```

and remove the local duplicate implementations.

- [ ] **Step 4: Re-run the targeted service suites to verify GREEN**

Run:

```bash
pnpm vitest run \
  functions/services/__tests__/order-procurement-shared.test.js \
  functions/services/__tests__/OrderProcurementDomainService.test.js \
  functions/services/__tests__/OrderProcurementReceiptReversalService.test.js \
  functions/services/__tests__/PurchaseOrderShortageClosureService.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add \
  functions/services/order-procurement-shared.js \
  functions/services/OrderProcurementDomainService.js \
  functions/services/OrderProcurementReceiptReversalService.js \
  functions/services/PurchaseOrderShortageClosureService.js \
  functions/services/__tests__/order-procurement-shared.test.js \
  functions/services/__tests__/OrderProcurementDomainService.test.js \
  functions/services/__tests__/OrderProcurementReceiptReversalService.test.js \
  functions/services/__tests__/PurchaseOrderShortageClosureService.test.js
git commit -m "refactor: dedupe purchase order command service helpers"
```

## Task 3: Extract Shared Purchase-Order Progress Helpers For The Frontend

**Files:**

- Create: `src/utils/__tests__/purchase-order-progress.test.js`
- Create: `src/utils/purchase-order-progress.js`

- [ ] **Step 1: Write the failing progress-helper tests**

Create `src/utils/__tests__/purchase-order-progress.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  getPurchaseOrderOrderedQty,
  getPurchaseOrderOutstandingQty,
  getPurchaseOrderReceivedQty,
} from '../purchase-order-progress.js';

describe('purchase-order-progress', () => {
  it('prefers aggregated outstanding_qty when present', () => {
    expect(
      getPurchaseOrderOutstandingQty({
        outstanding_qty: 3,
        ordered_qty: 10,
        received_qty: 9,
        cancelled_qty: 0,
      })
    ).toBe(3);
  });

  it('falls back to ordered minus received minus cancelled', () => {
    expect(
      getPurchaseOrderOutstandingQty({
        ordered_qty: 10,
        received_qty: 4,
        cancelled_qty: 1,
      })
    ).toBe(5);
  });

  it('sums received quantity from items when header data is absent', () => {
    expect(
      getPurchaseOrderReceivedQty({
        items: [{ received_qty: 2 }, { received_qty: 3 }],
      })
    ).toBe(5);
  });

  it('uses quantity for item rows and ordered_qty for header rows', () => {
    expect(getPurchaseOrderOrderedQty({ quantity: 7 })).toBe(7);
    expect(getPurchaseOrderOrderedQty({ ordered_qty: 9 })).toBe(9);
  });
});
```

- [ ] **Step 2: Run the helper tests to verify RED**

Run:

```bash
pnpm vitest run src/utils/__tests__/purchase-order-progress.test.js
```

Expected: FAIL because `src/utils/purchase-order-progress.js` does not exist yet.

- [ ] **Step 3: Implement the shared progress helper module**

Create `src/utils/purchase-order-progress.js`:

```js
function toProgressNumber(value) {
  return Number(value || 0);
}

export function getPurchaseOrderOrderedQty(record = {}) {
  return toProgressNumber(record.quantity ?? record.ordered_qty);
}

export function getPurchaseOrderOutstandingQty(record = {}) {
  if (record.outstanding_qty != null) {
    return Math.max(toProgressNumber(record.outstanding_qty), 0);
  }

  return Math.max(
    getPurchaseOrderOrderedQty(record) -
      toProgressNumber(record.received_qty) -
      toProgressNumber(record.cancelled_qty),
    0
  );
}

export function getPurchaseOrderReceivedQty(record = {}) {
  if (record.received_qty != null) return Math.max(toProgressNumber(record.received_qty), 0);
  if (Array.isArray(record.items)) {
    return record.items.reduce(
      (sum, item) => sum + Math.max(toProgressNumber(item?.received_qty), 0),
      0
    );
  }
  return 0;
}
```

- [ ] **Step 4: Re-run the helper tests to verify GREEN**

Run:

```bash
pnpm vitest run src/utils/__tests__/purchase-order-progress.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/purchase-order-progress.js src/utils/__tests__/purchase-order-progress.test.js
git commit -m "refactor: extract purchase order progress helpers"
```

## Task 4: Rewire The Purchase-Order View To The Shared Progress Helpers

**Files:**

- Modify: `src/views/PurchaseOrders.vue`
- Modify: `src/views/__tests__/PurchaseOrders.detail-shell.test.js`

- [ ] **Step 1: Add or tighten failing detail-shell coverage around the extracted progress logic**

In `src/views/__tests__/PurchaseOrders.detail-shell.test.js`, keep coverage on:

- ordered purchase orders with partial receipts hiding `cancelled`
- completed purchase orders hiding receipt reversal actions
- arrived purchase orders exposing only valid footer actions

If needed, add one focused test that proves the footer still derives next actions from received/outstanding quantities after helper extraction.

- [ ] **Step 2: Run the detail-shell suite to verify RED**

Run:

```bash
pnpm vitest run src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

Expected: FAIL after tightening assertions if `PurchaseOrders.vue` still uses duplicate local calculations.

- [ ] **Step 3: Replace local duplicate calculators in the view**

Update `src/views/PurchaseOrders.vue`:

```js
import {
  getPurchaseOrderOrderedQty,
  getPurchaseOrderOutstandingQty,
  getPurchaseOrderReceivedQty,
} from '@/utils/purchase-order-progress';
```

Then:

- remove `getOutstandingQtyForStatusGate(...)`
- remove the local `getReceivedQtyForStatusGate(...)`
- remove the local `getOrderedQty(...)`
- remove the local `getOutstandingQty(...)`
- use `getPurchaseOrderOutstandingQty(detail.value)` for shipping-to-arrived gating
- use `getPurchaseOrderReceivedQty(detail.value)` for ordered-to-cancelled gating
- use `getPurchaseOrderOrderedQty(...)` and `getPurchaseOrderOutstandingQty(...)` inside receipt/progress summary rendering
- remove the now-unused `loadStats` destructure from the composable import block

- [ ] **Step 4: Re-run the detail-shell suite to verify GREEN**

Run:

```bash
pnpm vitest run \
  src/utils/__tests__/purchase-order-progress.test.js \
  src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add \
  src/utils/purchase-order-progress.js \
  src/utils/__tests__/purchase-order-progress.test.js \
  src/views/PurchaseOrders.vue \
  src/views/__tests__/PurchaseOrders.detail-shell.test.js
git commit -m "refactor: reuse shared purchase order progress helpers"
```

## Task 5: Extract Purchase-Order Request Helpers And Rewire The Composable

**Files:**

- Create: `src/utils/__tests__/purchase-order-request.test.js`
- Create: `src/utils/purchase-order-request.js`
- Modify: `src/composables/usePurchaseOrders.js`
- Modify: `src/composables/__tests__/usePurchaseOrders.test.js`

- [ ] **Step 1: Write the failing request-helper tests**

Create `src/utils/__tests__/purchase-order-request.test.js`:

```js
import { describe, expect, it, vi } from 'vitest';
import {
  appendPurchaseOrderCacheBust,
  buildPurchaseOrderIdempotentJsonHeaders,
} from '../purchase-order-request.js';

describe('purchase-order-request helpers', () => {
  it('appends _ts only when forceRefresh is true', () => {
    expect(appendPurchaseOrderCacheBust('/api/manage/purchase-orders')).toBe(
      '/api/manage/purchase-orders'
    );
    expect(
      appendPurchaseOrderCacheBust('/api/manage/purchase-orders?page=1', {
        forceRefresh: true,
        now: () => 123,
      })
    ).toBe('/api/manage/purchase-orders?page=1&_ts=123');
  });

  it('builds idempotent json headers from crypto uuid', () => {
    expect(buildPurchaseOrderIdempotentJsonHeaders({ createId: () => 'idem-1' })).toEqual({
      'Content-Type': 'application/json',
      'Idempotency-Key': 'idem-1',
    });
  });
});
```

- [ ] **Step 2: Run the helper tests to verify RED**

Run:

```bash
pnpm vitest run src/utils/__tests__/purchase-order-request.test.js
```

Expected: FAIL because `src/utils/purchase-order-request.js` does not exist yet.

- [ ] **Step 3: Implement the request-helper module and rewire the composable**

Create `src/utils/purchase-order-request.js`:

```js
export function appendPurchaseOrderCacheBust(
  url,
  { forceRefresh = false, now = () => Date.now() } = {}
) {
  if (!forceRefresh) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_ts=${now()}`;
}

export function buildPurchaseOrderIdempotentJsonHeaders({
  createId = () =>
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
} = {}) {
  return {
    'Content-Type': 'application/json',
    'Idempotency-Key': createId(),
  };
}
```

Update `src/composables/usePurchaseOrders.js` to import these helpers and remove the local `withCacheBust(...)` and `buildIdempotentJsonHeaders(...)` functions.

- [ ] **Step 4: Re-run the composable and helper tests to verify GREEN**

Run:

```bash
pnpm vitest run \
  src/utils/__tests__/purchase-order-request.test.js \
  src/composables/__tests__/usePurchaseOrders.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add \
  src/utils/purchase-order-request.js \
  src/utils/__tests__/purchase-order-request.test.js \
  src/composables/usePurchaseOrders.js \
  src/composables/__tests__/usePurchaseOrders.test.js
git commit -m "refactor: extract purchase order request helpers"
```

## Task 6: Run Focused End-To-End Regression For The Deduplication Pass

**Files:**

- Modify: none
- Test: `functions/services/__tests__/order-procurement-shared.test.js`
- Test: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Test: `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
- Test: `functions/services/__tests__/PurchaseOrderShortageClosureService.test.js`
- Test: `src/utils/__tests__/purchase-order-progress.test.js`
- Test: `src/utils/__tests__/purchase-order-request.test.js`
- Test: `src/composables/__tests__/usePurchaseOrders.test.js`
- Test: `src/views/__tests__/PurchaseOrders.detail-shell.test.js`

- [ ] **Step 1: Run the full targeted Vitest regression set**

Run:

```bash
pnpm vitest run \
  functions/services/__tests__/order-procurement-shared.test.js \
  functions/services/__tests__/OrderProcurementDomainService.test.js \
  functions/services/__tests__/OrderProcurementReceiptReversalService.test.js \
  functions/services/__tests__/PurchaseOrderShortageClosureService.test.js \
  src/utils/__tests__/purchase-order-progress.test.js \
  src/utils/__tests__/purchase-order-request.test.js \
  src/composables/__tests__/usePurchaseOrders.test.js \
  src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

Expected: PASS

- [ ] **Step 2: Run focused lint on the touched modules**

Run:

```bash
pnpm eslint \
  functions/services/order-procurement-shared.js \
  functions/services/OrderProcurementDomainService.js \
  functions/services/OrderProcurementReceiptReversalService.js \
  functions/services/PurchaseOrderShortageClosureService.js \
  src/utils/purchase-order-progress.js \
  src/utils/purchase-order-request.js \
  src/composables/usePurchaseOrders.js \
  src/views/PurchaseOrders.vue
```

Expected: no new `no-unused-vars` or duplicate-definition warnings introduced by this refactor. If `PurchaseOrders.vue` still emits pre-existing Tailwind class-order warnings, record them separately and do not mix them into this refactor unless they block CI.

- [ ] **Step 3: Verify the diff only removes duplication and preserves behavior**

Check:

```bash
git diff --stat
git diff -- functions/services/OrderProcurementDomainService.js functions/services/OrderProcurementReceiptReversalService.js functions/services/PurchaseOrderShortageClosureService.js src/composables/usePurchaseOrders.js src/views/PurchaseOrders.vue
```

Expected: helper extraction, import rewiring, and dead-code removal only. No API contract, schema, or route-path changes.

- [ ] **Step 4: Commit the final verification checkpoint**

```bash
git add -A
git commit -m "refactor: consolidate purchase order duplicate helpers"
```

## Notes

- Keep this pass out of the existing frontend/backend `purchase-order-constraints.js` duplication unless the implementation work proves it is directly blocking the scoped refactor. That is a larger cross-runtime deduplication problem and should not be smuggled into this plan.
- Do not rewrite the purchase-order route layer around generic abstractions in this pass. The goal is local source-of-truth consolidation, not framework churn.
- When in doubt, prefer small pure helper files over widening existing large files further.

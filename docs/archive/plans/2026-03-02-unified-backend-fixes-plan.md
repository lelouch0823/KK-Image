# Backend Unified Fixes and Refactors Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close remaining backend logic loopholes (variant UPSERT stock overwrite and purchase-order moving-average cost correctness) and complete high-value deduplication refactors (binding validation, sales auth, pagination, SQL placeholder helpers).

**Architecture:**
1. **Business Correctness First:** Keep delivered-status inventory deduction in `repositories/order/mutations.js` as the single source of truth, then fix remaining correctness gaps: variant UPSERT must not overwrite stock, and PO MAC must be calculated with pre-arrival stock semantics.
2. **Refactor Second:** Extract repeated product/variant binding checks, salesperson auth flow, pagination parsing, and SQL placeholder generation into shared utilities to reduce drift and improve maintainability.

**Tech Stack:** Cloudflare Workers, Hono, Cloudflare D1 (SQLite), Vitest

**Execution Skills:** `@superpowers/test-driven-development` + `@superpowers/verification-before-completion`

**Execution Notes:**
- All commands below are single-line and directly runnable in PowerShell and bash.
- For "failing test" steps, acceptable failure includes "file not found" for newly created test files.

---

### Task 0: Baseline and Scope Lock

**Files:**
- Verify only (no edits)

**Step 1: Run current baseline tests (must pass before changes)**

Run:
```bash
pnpm vitest run functions/repositories/__tests__/order-inventory-flow.test.js functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js
```
Expected: PASS (confirms delivered-stock transitions and active/status validation are already covered).

**Step 2: Confirm unresolved items from this plan**
- `ProductVariantRepository.syncVariants` still updates `stock_quantity = excluded.stock_quantity`.
- `PurchaseOrderService.allocateCosts` still does not update variant `cost_price` with a robust MAC formula.
- `functions/api/utils/validation.js` and `functions/api/utils/sql.js` do not exist.
- `manage/orders/list.js` still manually parses query pagination.
- `middleware/sales-auth.js` still duplicates auth logic from `api/utils/salesperson-auth.js`.

---

### Task 1: Fix Variant UPSERT Stock Overwrite (Atomic Inventory Safety)

**Files:**
- Modify: `functions/repositories/ProductVariantRepository.js`
- Create: `functions/repositories/__tests__/product-variant-upsert-stock.test.js`

**Step 1: Write failing test**
- Add a test for `syncVariants(...)` that asserts UPSERT SQL does **not** contain `stock_quantity = excluded.stock_quantity`.
- Add a test that new insert still sets `stock_quantity` from payload.

**Step 2: Run test to confirm failure**

Run:
```bash
pnpm vitest run functions/repositories/__tests__/product-variant-upsert-stock.test.js
```
Expected: FAIL.

**Step 3: Implement minimal fix**
- In `syncVariants` UPSERT `DO UPDATE SET`, remove the `stock_quantity = excluded.stock_quantity` assignment.
- Keep insert-side `stock_quantity` binding unchanged.
- Do not change existing `adjustStock(...)` behavior.

**Step 4: Re-run tests**

Run:
```bash
pnpm vitest run functions/repositories/__tests__/product-variant-upsert-stock.test.js functions/repositories/__tests__/order-inventory-flow.test.js
```
Expected: PASS.

**Step 5: Commit**
```bash
git add functions/repositories/ProductVariantRepository.js functions/repositories/__tests__/product-variant-upsert-stock.test.js && git commit -m "fix: prevent variant upsert from overwriting stock quantity"
```

---

### Task 2: Implement Correct Moving Average Cost on PO Completion

**Files:**
- Modify: `functions/repositories/ProductVariantRepository.js`
- Modify: `functions/services/PurchaseOrderService.js`
- Create: `functions/services/__tests__/purchase-order-moving-average-cost.test.js`

**Step 1: Write failing tests**
- Test `ProductVariantRepository.updateMovingAverageCost(...)` with edge cases:
  - no incoming qty -> no update
  - current cost null -> treated as 0
  - pre-arrival stock computed as `max(current_stock - arrived_qty, 0)`
- Test `PurchaseOrderService.allocateCosts(...)` triggers MAC update in completed flow.

**Step 2: Run tests to confirm failure**

Run:
```bash
pnpm vitest run functions/services/__tests__/purchase-order-moving-average-cost.test.js
```
Expected: FAIL.

**Step 3: Implement repository method**
- Add `updateMovingAverageCost(variantId, newlyArrivedQuantity, totalArrivedCost)` in `ProductVariantRepository`:
  - Read current `stock_quantity` and `cost_price`.
  - Compute `preArrivalQty = max(stock_quantity - newlyArrivedQuantity, 0)`.
  - Compute `denominator = preArrivalQty + newlyArrivedQuantity`; if `<= 0`, skip.
  - Compute `newCost = ((preArrivalQty * currentCost) + totalArrivedCost) / denominator`.
  - Update `cost_price` and `updated_at`.

**Step 4: Wire MAC update in service**
- In `PurchaseOrderService.allocateCosts`, after `updateAllocations(allocations)` completes, compute landed total for each item:
  - `itemTotalLandedCost = (unit_cost + allocated_freight + allocated_tariff) * quantity`
- Call `updateMovingAverageCost(variant_id, quantity, itemTotalLandedCost)` per variant item.
- Skip rows without `variant_id`.

**Step 5: Re-run tests**

Run:
```bash
pnpm vitest run functions/services/__tests__/purchase-order-moving-average-cost.test.js functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js
```
Expected: PASS.

**Step 6: Commit**
```bash
git add functions/repositories/ProductVariantRepository.js functions/services/PurchaseOrderService.js functions/services/__tests__/purchase-order-moving-average-cost.test.js && git commit -m "feat: apply moving average cost when purchase order completes"
```

---

### Task 3: Centralize Product/Variant Binding Validation

**Files:**
- Create: `functions/api/utils/validation.js`
- Create: `functions/api/utils/__tests__/validation.test.js`
- Create: `functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js`
- Modify: `functions/lib/hono/routes/manage/orders/create.js`
- Modify: `functions/lib/hono/routes/manage/orders/detail.js`
- Modify: `functions/lib/hono/routes/manage/spaces/crud.js`
- Modify: `functions/lib/hono/routes/sales/orders.js`
- Modify: `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`

**Step 1: Write failing tests for utility and route integration**
- Test `validateProductVariantBinding(db, productId, variantId, { checkActive })` for:
  - missing pair (product only / variant only)
  - variant not belonging to product
  - archived product/variant when `checkActive = true`
  - valid active binding
- Add/adjust route tests for sales orders and spaces CRUD to verify validation behavior is preserved after refactor.

**Step 2: Run tests to confirm failure**

Run:
```bash
pnpm vitest run functions/api/utils/__tests__/validation.test.js functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js
```
Expected: FAIL.

**Step 3: Implement utility**
- In `validation.js`, implement shared validation with consistent `BadRequestError` messages.
- Return `{ product, variant, normalizedVariantId }` to avoid duplicate fetches in routes.

**Step 4: Refactor routes**
- Replace duplicated manual checks in the target routes with utility calls.
- Keep existing route-specific behavior (for example field overwrite logic in order detail) unchanged.

**Step 5: Re-run tests**

Run:
```bash
pnpm vitest run functions/api/utils/__tests__/validation.test.js functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js
```
Expected: PASS.

**Step 6: Commit**
```bash
git add functions/api/utils/validation.js functions/api/utils/__tests__/validation.test.js functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js functions/lib/hono/routes/manage/orders/create.js functions/lib/hono/routes/manage/orders/detail.js functions/lib/hono/routes/manage/spaces/crud.js functions/lib/hono/routes/sales/orders.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js && git commit -m "refactor: centralize product variant binding validation"
```

---

### Task 4: Consolidate Salesperson Auth and Pagination Parsing

**Files:**
- Create: `functions/lib/hono/middleware/__tests__/sales-auth.test.js`
- Create: `functions/lib/hono/routes/manage/__tests__/order-list-routes.test.js`
- Modify: `functions/api/utils/salesperson-auth.js`
- Modify: `functions/lib/hono/middleware/sales-auth.js`
- Modify: `functions/lib/hono/routes/manage/orders/list.js`

**Step 1: Write failing tests**
- Add `sales-auth` middleware tests:
  - accepts valid cookie JWT + path token
  - accepts valid bearer JWT + path token
  - rejects disabled salesperson
  - rejects mismatched access token
- Add order list route tests for pagination parsing boundary behavior (`page >= 1`, `1 <= limit <= 100`).

**Step 2: Run tests to confirm failure**

Run:
```bash
pnpm vitest run functions/lib/hono/middleware/__tests__/sales-auth.test.js functions/lib/hono/routes/manage/__tests__/order-list-routes.test.js
```
Expected: FAIL.

**Step 3: Refactor middleware to reuse utility**
- In `sales-auth.js`, call `authenticateSalesperson(c.req.raw, c.env, accessToken)`.
- Map thrown messages to HTTP status codes consistently (`401/403/404`).
- Keep existing response shape `{ success: false, error: ... }`.

**Step 4: Clean utility implementation**
- Remove speculative comments in `salesperson-auth.js`.
- Keep behavior deterministic and documented.

**Step 5: Replace manual pagination parsing in admin order list**
- In `manage/orders/list.js`, import and use `parsePagination(c)` from `functions/lib/hono/_shared/route-helpers.js`.
- Keep other filters (`salesperson`, `status`, `search`, `startTime`, `endTime`) unchanged.

**Step 6: Re-run tests**

Run:
```bash
pnpm vitest run functions/lib/hono/middleware/__tests__/sales-auth.test.js functions/lib/hono/routes/manage/__tests__/order-list-routes.test.js
```
Expected: PASS.

**Step 7: Commit**
```bash
git add functions/api/utils/salesperson-auth.js functions/lib/hono/middleware/sales-auth.js functions/lib/hono/middleware/__tests__/sales-auth.test.js functions/lib/hono/routes/manage/orders/list.js functions/lib/hono/routes/manage/__tests__/order-list-routes.test.js && git commit -m "refactor: unify salesperson auth middleware and pagination parsing"
```

---

### Task 5: Centralize SQL Placeholder Helpers and Apply Broadly

**Files:**
- Create: `functions/api/utils/sql.js`
- Create: `functions/api/utils/__tests__/sql.test.js`
- Create: `functions/lib/hono/_shared/__tests__/route-helpers.salesperson-token.test.js`
- Modify: `functions/_shared/utils.js`
- Modify: `functions/lib/hono/_shared/route-helpers.js`
- Modify: `functions/repositories/FileRepository.js`
- Modify: `functions/repositories/FolderRepository.js`

**Step 1: Write failing helper tests**
- Test `placeholders(arr, char='?')`:
  - empty array -> `''`
  - length 3 -> `'?,?,?'`
- Test `inClause(arr, char='?')`:
  - empty array -> `'(NULL)'` (safe no-match semantics)
  - length 2 -> `'(?,?)'`
- Add route-helper test to verify `getSalespersonAccessTokens` still works with deduped ids and dynamic placeholder generation.

**Step 2: Run tests to confirm failure**

Run:
```bash
pnpm vitest run functions/api/utils/__tests__/sql.test.js functions/lib/hono/_shared/__tests__/route-helpers.salesperson-token.test.js
```
Expected: FAIL.

**Step 3: Implement SQL helpers and export**
- Add helper functions in `functions/api/utils/sql.js`.
- Re-export from `functions/_shared/utils.js`.

**Step 4: Refactor usages**
- Replace manual `map(() => '?').join(',')` in:
  - `FileRepository.js`
  - `FolderRepository.js`
  - `lib/hono/_shared/route-helpers.js` (`getSalespersonAccessTokens`)

**Step 5: Re-run tests**

Run:
```bash
pnpm vitest run functions/api/utils/__tests__/sql.test.js functions/lib/hono/_shared/__tests__/route-helpers.salesperson-token.test.js functions/repositories/__tests__/order-mutations.test.js
```
Expected: PASS.

**Step 6: Commit**
```bash
git add functions/api/utils/sql.js functions/api/utils/__tests__/sql.test.js functions/lib/hono/_shared/__tests__/route-helpers.salesperson-token.test.js functions/_shared/utils.js functions/lib/hono/_shared/route-helpers.js functions/repositories/FileRepository.js functions/repositories/FolderRepository.js && git commit -m "refactor: centralize sql placeholder generation"
```

---

### Task 6: Final Verification Gate (Required Before Completion)

**Files:**
- Verify only (no edits)

**Step 1: Run focused regression suite**

Run:
```bash
pnpm vitest run functions/repositories/__tests__/order-inventory-flow.test.js functions/repositories/__tests__/product-variant-upsert-stock.test.js functions/services/__tests__/purchase-order-moving-average-cost.test.js functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js functions/lib/hono/routes/manage/__tests__/order-list-routes.test.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js functions/lib/hono/middleware/__tests__/sales-auth.test.js functions/api/utils/__tests__/validation.test.js functions/api/utils/__tests__/sql.test.js functions/lib/hono/_shared/__tests__/route-helpers.salesperson-token.test.js
```
Expected: PASS.

**Step 2: Run lint for touched backend files**

Run:
```bash
pnpm lint
```
Expected: no new errors in touched files.

**Step 3: Sanity-check no unintended changes**

Run:
```bash
git status --short
```
Expected: only intended files.

# Backend Logic Review Follow-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix confirmed follow-up backend logic issues from the multi-agent review and commit only related backend changes.

**Architecture:** Keep fixes narrow at existing route/service/repository boundaries. Add regression coverage first, then make the smallest production changes that preserve current API response shapes while adding missing authorization, cache/projection side effects, active-order guards, and atomic balance checks.

**Tech Stack:** Cloudflare Pages Functions, Hono, D1-style SQL repositories, Vitest.

---

### Task 1: Product Dimensions Cache/Projection Side Effects

**Files:**
- Modify: `functions/services/product-catalog/patch.js`
- Modify: `functions/services/ProductCatalogService.js`
- Modify: `functions/lib/hono/routes/manage/products/[id]/index.js`
- Test: `functions/services/__tests__/ProductCatalogService.put-boundaries.test.js`

- [ ] Add a failing test showing dimensions-only `patchProduct` refreshes product projection and schedules product cache invalidation.
- [ ] Run `node node_modules/vitest/vitest.mjs functions/services/__tests__/ProductCatalogService.put-boundaries.test.js --run`; expected failure because dimensions-only returns no side-effect signal.
- [ ] Return `dimensionsUpdated` from `executeProductCatalogPatch`.
- [ ] Include `dimensionsUpdated` in `ProductCatalogService.patchProduct` refresh/cache condition.
- [ ] Include `dimensionsUpdated` in product route idempotent response and publish condition.
- [ ] Re-run the focused test; expected pass.

### Task 2: Upload Order Context Permission

**Files:**
- Modify: `functions/lib/hono/routes/manage/upload.js`
- Test: `functions/lib/hono/routes/manage/__tests__/upload-route.test.js`

- [ ] Add a failing route test where `files:write` without `orders:manage` posts `?orderId=` and receives `403` before `storeFile`.
- [ ] Run `node node_modules/vitest/vitest.mjs functions/lib/hono/routes/manage/__tests__/upload-route.test.js --run`; expected failure because order uploads only require `files:write`.
- [ ] Add an `orders:manage` permission check in the `orderId` branch before querying the order.
- [ ] Re-run the focused test; expected pass.

### Task 3: AI Route Test Mock

**Files:**
- Modify: `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`

- [ ] Use existing failing test output as RED: the test suite fails because the `ai-tool-executor` mock omits `filterAIToolsForUser`.
- [ ] Add `filterAIToolsForUser` to the test mock, returning the provided tools unchanged unless a test overrides it later.
- [ ] Run `node node_modules/vitest/vitest.mjs functions/lib/hono/routes/manage/__tests__/ai-routes.test.js --run`; expected pass.

### Task 4: Procurement Writes Must Guard Active Orders

**Files:**
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`
- Modify: `functions/services/PurchaseOrderShortageClosureService.js`
- Test: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Test: `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
- Test: `functions/services/__tests__/PurchaseOrderShortageClosureService.test.js`

- [ ] Add failing tests asserting receipt, reversal, and shortage-closure order line projection statements include `EXISTS ... orders ... archived_at IS NULL`.
- [ ] Add failing tests/assertions that guarded order-line projection writes have a following `changes()` assertion and are checked before finalize side effects succeed.
- [ ] Run the three focused service suites; expected failure on missing active-order guard and missing receipt/reversal guard tracking.
- [ ] Pass `{ guardProjectionState: true, guardActiveOrder: true }` for receipt/reversal/shortage order line projections.
- [ ] Track guarded order-line and order-status statement indexes in receipt/reversal flows, and convert mismatches to the existing refresh-and-retry `BadRequestError`.
- [ ] Re-run the three focused service suites; expected pass.

### Task 5: Atomic Payment Creation Guard

**Files:**
- Modify: `functions/repositories/PaymentRepository.js`
- Modify: `functions/lib/hono/routes/manage/orders/payments.js`
- Test: `functions/repositories/__tests__/PaymentRepository.test.js`

- [ ] Add a failing repository test proving payment insertion SQL is guarded by active order status and by remaining balance in the same write.
- [ ] Run `node node_modules/vitest/vitest.mjs functions/repositories/__tests__/PaymentRepository.test.js --run`; expected failure because `create` uses unconditional `INSERT`.
- [ ] Add `PaymentRepository.createIfWithinRemaining` using `INSERT ... SELECT ... WHERE EXISTS (...)` with `orders.archived_at IS NULL`, non-void/rejected status, and aggregate paid total <= order amount.
- [ ] Make the route call the guarded create method and return a 400 when it returns `null`.
- [ ] Re-run the focused test; expected pass.

### Task 6: Profit Queries Prefer `purchase_order_items.order_line_id`

**Files:**
- Modify: `functions/repositories/ProfitRepository.js`
- Modify: `functions/repositories/OrderStatsRepository.js`
- Test: `functions/repositories/__tests__/ProfitRepository.test.js` or a new focused repository SQL test
- Test: `functions/repositories/__tests__/OrderStatsRepository.full.test.js`

- [ ] Add failing SQL-shape tests requiring profit joins to prefer `poi.order_line_id = ol.id` and only legacy-fallback on composite keys when `poi.order_line_id IS NULL`.
- [ ] Run focused repository tests; expected failure because joins only use product/variant composite keys.
- [ ] Replace repeated profit join clauses with line-aware join clauses in both repositories.
- [ ] Re-run focused repository tests; expected pass.

### Task 7: Archived-Order Race Guards For Delivery, Logistics, Returns

**Files:**
- Modify: `functions/repositories/OrderRepository.js`
- Modify: `functions/services/OrderDeliveryService.js`
- Modify: `functions/lib/hono/routes/manage/orders/detail/logistics.js`
- Modify: `functions/services/OrderLineFulfillmentService/index.js`
- Test: `functions/services/__tests__/OrderDeliveryService.test.js`
- Test: `functions/services/__tests__/OrderLineFulfillmentService.test.js`
- Test: add or extend a logistics route test if one exists; otherwise add SQL-shape coverage in a route test.

- [ ] Add failing tests showing guarded order updates fail when `changes() !== 1` or missing `archived_at IS NULL`.
- [ ] Run focused tests; expected failure on missing change assertion or missing active-order condition.
- [ ] Have `markDelivered` report/update success and make delivery service reject stale archived writes before timeline/outbox.
- [ ] Add `archived_at IS NULL` plus `changes()` assertion to logistics and return status updates.
- [ ] Re-run focused tests; expected pass.

### Task 8: Order Create Failed Resume Side Effects

**Files:**
- Modify: `functions/lib/hono/routes/manage/orders/create-order.js`
- Modify: `functions/lib/hono/routes/manage/orders/create.js`
- Test: `functions/lib/hono/routes/manage/orders/__tests__/create-routes.test.js`

- [ ] Add a failing route test for failed idempotency resume containing `fileIds`: retry must archive files, schedule order cache invalidation, publish the order-created event, finalize as committed, and omit internal `fileIds` from the response.
- [ ] Run `node node_modules/vitest/vitest.mjs functions/lib/hono/routes/manage/orders/__tests__/create-routes.test.js --run`; expected failure because resume only publishes/finalizes.
- [ ] Extract/reuse route-side post-create side effects so normal and failed-resume paths both archive files and schedule cache invalidation.
- [ ] Re-run the focused test; expected pass.

### Task 9: Commit Dependency Closure

**Files:**
- Add to commit: `functions/services/_shared/cache-urls.js`
- Add to commit: `functions/services/_shared/currency.js`
- Add to commit: `functions/services/_shared/product-schema.js`
- Add to commit: `functions/services/_shared/v1-cache-urls.js`
- Add to commit: `functions/services/_shared/variant-image-folders.js`
- Add to commit: `functions/services/_shared/variant-image-sync.js`
- Add to commit: `functions/services/_shared/variant-normalizers.js`

- [ ] Verify the helper files are staged with the backend refactor files that import/re-export them.
- [ ] Run a backend module-load smoke import.
- [ ] Run targeted Vitest suites for all modified backend areas.
- [ ] Run `git diff --check`.
- [ ] Commit only the relevant backend/test/plan/helper files, leaving unrelated frontend worktree changes unstaged.

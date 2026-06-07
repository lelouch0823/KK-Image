# Core Batch Safety And Outbox Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the procurement hardening work into the remaining core repositories so high-volume writes stop risking Cloudflare D1 batch-limit failures and order-facing read models stay coherent through outbox propagation.

**Architecture:** Reuse the same safety pattern already proven in the procurement flow: write the failing scale test first, introduce a small local `executeBatchChunks()` helper where needed, and only broaden outbox payloads when a downstream cache or notification consumer is actually missing business context. Finish with a focused regression sweep over notifications, order mutations, product writes, and shared consumers.

**Tech Stack:** Cloudflare D1/SQLite, Hono routes, repository/service layer JS modules, Vitest, real API workflow tests

---

## File Map

**Notification fan-out boundary**

- Modify: `functions/repositories/NotificationRepository.js`
- Test: `functions/repositories/__tests__/NotificationRepository.test.js`
- Test: `functions/services/__tests__/DomainOutboxConsumers.notifications.test.js`

**Order mutation boundary**

- Modify: `functions/repositories/order/mutations.js`
- Test: `functions/repositories/__tests__/order-mutations.test.js`
- Test: `functions/repositories/__tests__/order-queries.display-model.test.js`
- Test: `functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js`

**Product variant write boundary**

- Modify: `functions/repositories/ProductVariantRepository.js`
- Test: `functions/repositories/__tests__/product-variant-upsert-stock.test.js`
- Test: `test/manage-products-batch.test.js`
- Test: `test/manage-products-workflow.test.js`

**Product dimension write boundary**

- Modify: `functions/repositories/ProductDimensionRepository.js`
- Test: `functions/repositories/__tests__/product-dimension-repository.test.js`
- Test: `functions/lib/hono/routes/manage/products/__tests__/batch-routes.test.js`

**Cross-cutting verification**

- Modify: `functions/services/DomainOutboxPublisher.js` only if a new shared helper extraction becomes justified
- Test: `functions/services/__tests__/DomainOutboxPublisher.test.js`
- Test: `functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js`
- Test: `test/notifications-real-api.test.js`
- Test: `test/manage-products-batch.test.js`

### Task 1: Harden Notification Repository Batch Writes

**Files:**

- Modify: `functions/repositories/NotificationRepository.js`
- Test: `functions/repositories/__tests__/NotificationRepository.test.js`
- Test: `functions/services/__tests__/DomainOutboxConsumers.notifications.test.js`

- [ ] **Step 1: Write the failing tests**

```js
it('chunks large notification inserts into D1-safe batches', async () => {});
it('chunks legacy mirror writes without changing notification dedupe behavior', async () => {});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:unit functions/repositories/__tests__/NotificationRepository.test.js functions/services/__tests__/DomainOutboxConsumers.notifications.test.js`
Expected: FAIL because `NotificationRepository` still sends large `db.batch(statements)` arrays directly.

- [ ] **Step 3: Write minimal implementation**

Implementation notes:

- Add a local `chunkArray()` plus `executeBatchChunks()` helper in `NotificationRepository.js`
- Convert both primary notification writes and legacy compatibility writes to the helper
- Preserve current dedupe semantics and return shape
- Do not extract a shared helper unless at least one second repository in this wave needs the exact same shape

- [ ] **Step 4: Run focused tests**

Run: `pnpm test:unit functions/repositories/__tests__/NotificationRepository.test.js functions/services/__tests__/DomainOutboxConsumers.notifications.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/repositories/NotificationRepository.js functions/repositories/__tests__/NotificationRepository.test.js functions/services/__tests__/DomainOutboxConsumers.notifications.test.js
git commit -m "fix: chunk notification repository batch writes"
```

### Task 2: Harden Order Mutation Batch Writes And Keep Order Read Models Fresh

**Files:**

- Modify: `functions/repositories/order/mutations.js`
- Test: `functions/repositories/__tests__/order-mutations.test.js`
- Test: `functions/repositories/__tests__/order-queries.display-model.test.js`
- Test: `functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js`

- [ ] **Step 1: Write the failing tests**

```js
it('chunks large order mutation batches into D1-safe sizes', async () => {});
it('keeps outbox payload order identifiers sufficient for cache invalidation after batched order mutations', async () => {});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:unit functions/repositories/__tests__/order-mutations.test.js functions/repositories/__tests__/order-queries.display-model.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js`
Expected: FAIL because one or more order mutation paths still call `db.batch(statements)` directly and/or omit cache-critical payload fields in bulk flows.

- [ ] **Step 3: Write minimal implementation**

Implementation notes:

- Identify the high-volume paths first: batched status changes, comment fan-out, line sync, and any mass update helpers in `order/mutations.js`
- Replace direct large `db.batch(...)` calls with chunked execution while preserving atomic expectations per logical unit
- If a mutation publishes outbox events, ensure payload keeps `order_id`, `salesperson_id`, and any scope ids needed by cache consumers
- Avoid opportunistic refactors outside the hot paths found by the tests

- [ ] **Step 4: Run focused tests**

Run: `pnpm test:unit functions/repositories/__tests__/order-mutations.test.js functions/repositories/__tests__/order-queries.display-model.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/repositories/order/mutations.js functions/repositories/__tests__/order-mutations.test.js functions/repositories/__tests__/order-queries.display-model.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js
git commit -m "fix: chunk order mutation batch writes"
```

### Task 3: Harden Product Variant Bulk Writes

**Files:**

- Modify: `functions/repositories/ProductVariantRepository.js`
- Test: `functions/repositories/__tests__/product-variant-upsert-stock.test.js`
- Test: `test/manage-products-batch.test.js`
- Test: `test/manage-products-workflow.test.js`

- [ ] **Step 1: Write the failing tests**

```js
it('chunks large product variant upsert batches into D1-safe sizes', async () => {});
it('preserves variant identity and stock semantics after chunked bulk writes', async () => {});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:unit functions/repositories/__tests__/product-variant-upsert-stock.test.js`
Expected: FAIL because one or more bulk variant write paths still batch all statements at once.

- [ ] **Step 3: Write minimal implementation**

Implementation notes:

- Patch only the bulk write entry points in `ProductVariantRepository.js`
- Keep the recent identity-preserving behavior untouched
- Reuse the same D1-safe chunk size already established elsewhere in the repo
- Confirm no change to single-variant behavior or return payloads

- [ ] **Step 4: Run focused tests**

Run: `pnpm test:unit functions/repositories/__tests__/product-variant-upsert-stock.test.js`
Expected: PASS

- [ ] **Step 5: Run real API product regressions**

Run: `BASE_URL=http://127.0.0.1:8788 RUN_REAL_API_TESTS=1 node node_modules/vitest/vitest.mjs --maxWorkers 1 test/manage-products-batch.test.js test/manage-products-workflow.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/repositories/ProductVariantRepository.js functions/repositories/__tests__/product-variant-upsert-stock.test.js
git commit -m "fix: chunk product variant bulk writes"
```

### Task 4: Harden Product Dimension Bulk Writes

**Files:**

- Modify: `functions/repositories/ProductDimensionRepository.js`
- Test: `functions/repositories/__tests__/product-dimension-repository.test.js`
- Test: `functions/lib/hono/routes/manage/products/__tests__/batch-routes.test.js`

- [ ] **Step 1: Write the failing tests**

```js
it('chunks large product dimension writes into D1-safe batches', async () => {});
it('keeps dimension ordering and archive semantics stable after chunking', async () => {});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:unit functions/repositories/__tests__/product-dimension-repository.test.js functions/lib/hono/routes/manage/products/__tests__/batch-routes.test.js`
Expected: FAIL because dimension create/update/archive flows still send oversized statement arrays directly.

- [ ] **Step 3: Write minimal implementation**

Implementation notes:

- Patch only the dimension-level bulk write sections in `ProductDimensionRepository.js`
- Preserve existing ordering rules and archive/restore semantics
- Keep route behavior unchanged except for eliminating D1-size failure risk

- [ ] **Step 4: Run focused tests**

Run: `pnpm test:unit functions/repositories/__tests__/product-dimension-repository.test.js functions/lib/hono/routes/manage/products/__tests__/batch-routes.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/repositories/ProductDimensionRepository.js functions/repositories/__tests__/product-dimension-repository.test.js functions/lib/hono/routes/manage/products/__tests__/batch-routes.test.js
git commit -m "fix: chunk product dimension bulk writes"
```

### Task 5: Verification Sweep Across Shared Outbox And Real API Flows

**Files:**

- Verify: `functions/services/DomainOutboxPublisher.js`
- Verify: `functions/services/DomainOutboxConsumers.js`
- Verify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Verify: `functions/repositories/NotificationRepository.js`
- Verify: `functions/repositories/order/mutations.js`
- Verify: `functions/repositories/ProductVariantRepository.js`
- Verify: `functions/repositories/ProductDimensionRepository.js`
- Test: `functions/services/__tests__/DomainOutboxPublisher.test.js`
- Test: `functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js`
- Test: `functions/services/__tests__/DomainOutboxConsumers.notifications.test.js`
- Test: `test/notifications-real-api.test.js`
- Test: `test/manage-products-batch.test.js`
- Test: `test/purchase-receipts-real-api.test.js`

- [ ] **Step 1: Run repository and service regression suite**

Run: `pnpm test:unit functions/services/__tests__/DomainOutboxPublisher.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js functions/services/__tests__/DomainOutboxConsumers.notifications.test.js functions/repositories/__tests__/NotificationRepository.test.js functions/repositories/__tests__/order-mutations.test.js functions/repositories/__tests__/product-variant-upsert-stock.test.js functions/repositories/__tests__/product-dimension-repository.test.js`
Expected: PASS

- [ ] **Step 2: Run real API regression suite for outward-facing flows**

Run: `BASE_URL=http://127.0.0.1:8788 RUN_REAL_API_TESTS=1 node node_modules/vitest/vitest.mjs --maxWorkers 1 test/notifications-real-api.test.js test/manage-products-batch.test.js test/purchase-receipts-real-api.test.js`
Expected: PASS

- [ ] **Step 3: Final audit sweep**

Audit checklist:

- No newly introduced direct `db.batch(stmts)` on known high-volume core paths
- Outbox payloads still carry the IDs cache consumers and notifications need
- No route falls back to direct cache invalidation where outbox is already the source of truth

- [ ] **Step 4: Final commit**

```bash
git add functions/services/DomainOutboxPublisher.js functions/services/DomainOutboxConsumers.js functions/repositories/NotificationRepository.js functions/repositories/order/mutations.js functions/repositories/ProductVariantRepository.js functions/repositories/ProductDimensionRepository.js
git commit -m "test: verify core batch safety and outbox regressions"
```

## Execution Order

1. Notification repository
2. Order mutations
3. Product variants
4. Product dimensions
5. Shared verification sweep

## Risk Notes

- `NotificationRepository` and `order/mutations.js` are the highest-value next targets because they combine core-path writes with natural fan-out.
- `ProductVariantRepository` must preserve the recent identity/stock fix; do not rework variant matching while doing batch safety.
- `ProductDimensionRepository` is lower business risk than notifications or orders, so it comes after them even if it has more direct `db.batch(...)` sites.
- `OrderProcurementReceiptReversalService` is intentionally excluded from this next wave because its command shape is single-receipt and already guarded by the new database uniqueness constraint.

## Notes

- This plan was written from current codebase context after procurement hardening commit `09a6bf4`.
- Plan review loop via subagent was not executed here because this session is not authorized to spawn subagents unless explicitly requested by the user.

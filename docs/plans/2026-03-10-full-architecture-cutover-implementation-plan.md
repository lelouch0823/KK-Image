# Full Architecture Cutover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move all in-scope modules to the new product/inventory/demand architecture, perform one-time cutover migration, and delete all compatibility-layer code.

**Architecture:** First finish refactoring all runtime paths onto `ProductCatalogService`, `InventoryService`, `DemandService`, and ledger-backed inventory projection. Then add migration/reconciliation scripts, switch read models, remove legacy stock and shortage semantics, and run a full cutover verification matrix before deleting old architecture code.

**Tech Stack:** Cloudflare D1/SQLite, Hono, Vue 3, Vitest, Mocha, migration SQL, repository/service architecture

---

### Task 1: Inventory old-architecture usage and lock deletion targets into tests

**Files:**
- Create: `docs/plans/2026-03-10-full-architecture-cutover-deletion-checklist.md`
- Create: `functions/services/__tests__/legacy-stock-paths.test.js`
- Create: `functions/services/__tests__/legacy-shortage-paths.test.js`

**Step 1: Write a failing deletion-checklist doc**

List all known old-architecture targets:

- direct stock SQL writes
- legacy shortage aggregations
- batch product route orchestration
- `stock_quantity` truth ownership

**Step 2: Write a failing repository-wide test for legacy stock write paths**

Assert repo search output still finds old direct stock mutation paths outside `InventoryService`.

**Step 3: Run the legacy stock path test to verify it fails**

Run: `pnpm test:unit functions/services/__tests__/legacy-stock-paths.test.js`
Expected: FAIL

**Step 4: Write a failing repository-wide test for legacy shortage calculation paths**

Assert old local demand/shortage SQL still exists outside approved boundaries.

**Step 5: Run the legacy shortage test to verify it fails**

Run: `pnpm test:unit functions/services/__tests__/legacy-shortage-paths.test.js`
Expected: FAIL

**Step 6: Commit**

```bash
git add docs/plans/2026-03-10-full-architecture-cutover-deletion-checklist.md functions/services/__tests__/legacy-stock-paths.test.js functions/services/__tests__/legacy-shortage-paths.test.js
git commit -m "test(cutover): lock old architecture deletion targets"
```

### Task 2: Move product batch orchestration into ProductCatalogService

**Files:**
- Modify: `functions/lib/hono/routes/manage/products/batch.js`
- Modify: `functions/services/ProductCatalogService.js`
- Test: `functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js`
- Test: `functions/repositories/__tests__/product-import-merge.test.js`

**Step 1: Write a failing batch-route test that asserts service-owned orchestration**

Add a test that batch import delegates product create/update behavior through catalog service boundaries rather than route-local rollback logic.

**Step 2: Run the targeted tests to verify they fail**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js functions/repositories/__tests__/product-import-merge.test.js`
Expected: FAIL

**Step 3: Implement minimal batch refactor**

- move import orchestration into `ProductCatalogService`
- keep route focused on payload parsing and response aggregation
- remove route-local rollback branches duplicated from service code

**Step 4: Run the targeted tests**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js functions/repositories/__tests__/product-import-merge.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/products/batch.js functions/services/ProductCatalogService.js functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js functions/repositories/__tests__/product-import-merge.test.js
git commit -m "refactor(products): move batch orchestration into catalog service"
```

### Task 3: Introduce ledger schema and projection migration assets

**Files:**
- Create: `migrations/00xx_inventory_ledger.sql`
- Create: `scripts/inventory/backfill_ledger.js`
- Create: `scripts/inventory/reconcile_balances.js`
- Create: `functions/services/__tests__/inventory-ledger-projection.test.js`

**Step 1: Write a failing test for ledger projection invariants**

Cover:

- append-only ledger events
- `on_hand`
- `reserved`
- `available = max(on_hand - reserved, 0)`

**Step 2: Run the ledger test to verify it fails**

Run: `pnpm test:unit functions/services/__tests__/inventory-ledger-projection.test.js`
Expected: FAIL

**Step 3: Add migration SQL and backfill/reconciliation scripts**

- create `inventory_ledger`
- create `inventory_balances`
- add indexes required for variant reads and replay
- script backfills balances from current variant stock and active orders

**Step 4: Implement minimal projection test support**

Add just enough code or helper logic to validate the invariant path.

**Step 5: Run the ledger test**

Run: `pnpm test:unit functions/services/__tests__/inventory-ledger-projection.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add migrations/00xx_inventory_ledger.sql scripts/inventory/backfill_ledger.js scripts/inventory/reconcile_balances.js functions/services/__tests__/inventory-ledger-projection.test.js
git commit -m "feat(inventory): add ledger schema and projection tooling"
```

### Task 4: Route all order stock deductions through InventoryService

**Files:**
- Modify: `functions/repositories/order/mutations.js`
- Modify: `functions/repositories/OrderRepository.js`
- Modify: `functions/services/InventoryService.js`
- Test: `functions/repositories/__tests__/order-inventory-flow.test.js`
- Test: `functions/repositories/__tests__/order-mutations.test.js`

**Step 1: Write a failing test that forbids direct stock SQL in order mutations**

Assert order status transitions use `InventoryService` instead of local `UPDATE product_variants` SQL.

**Step 2: Run order inventory tests to verify they fail**

Run: `pnpm test:unit functions/repositories/__tests__/order-inventory-flow.test.js functions/repositories/__tests__/order-mutations.test.js`
Expected: FAIL

**Step 3: Implement the order stock write refactor**

- remove direct stock mutation SQL from order mutation flow
- delegate stock changes through `InventoryService`
- preserve insufficient-stock behavior

**Step 4: Run order inventory tests**

Run: `pnpm test:unit functions/repositories/__tests__/order-inventory-flow.test.js functions/repositories/__tests__/order-mutations.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/repositories/order/mutations.js functions/repositories/OrderRepository.js functions/services/InventoryService.js functions/repositories/__tests__/order-inventory-flow.test.js functions/repositories/__tests__/order-mutations.test.js
git commit -m "refactor(orders): route stock deductions through inventory service"
```

### Task 5: Move demand semantics from minimal boundary to reservation-backed projection

**Files:**
- Modify: `functions/services/DemandService.js`
- Create: `functions/services/__tests__/DemandReservationProjection.test.js`
- Modify: `functions/lib/hono/routes/manage/orders/detail.js`
- Modify: `functions/lib/hono/routes/sales/orders.js`

**Step 1: Write a failing reservation projection test**

Cover:

- confirmed creates reserved quantity
- rejected/void/cancelled releases reserved quantity
- delivered consumes reservation and triggers shipment semantics

**Step 2: Run the demand reservation test**

Run: `pnpm test:unit functions/services/__tests__/DemandReservationProjection.test.js`
Expected: FAIL

**Step 3: Implement reservation-backed demand state**

- move from transition-only logic to balance-aware semantics
- align with ledger/projection model

**Step 4: Run demand and order route tests**

Run: `pnpm test:unit functions/services/__tests__/DemandReservationProjection.test.js functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/services/DemandService.js functions/services/__tests__/DemandReservationProjection.test.js functions/lib/hono/routes/manage/orders/detail.js functions/lib/hono/routes/sales/orders.js
git commit -m "feat(demand): add reservation-backed projection semantics"
```

### Task 6: Switch procurement and goods overview reads to projection-backed semantics

**Files:**
- Modify: `functions/services/PurchaseOrderService.js`
- Modify: `functions/repositories/GoodsOverviewRepository.js`
- Modify: `functions/lib/hono/routes/manage/goods-overview.js`
- Test: `functions/services/__tests__/purchase-suggestions-inventory-semantics.test.js`
- Test: `functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js`

**Step 1: Write a failing test for projection-backed reads**

Assert procurement suggestions and goods overview read balances/demand projections rather than old stock-truth SQL.

**Step 2: Run the targeted tests**

Run: `pnpm test:unit functions/services/__tests__/purchase-suggestions-inventory-semantics.test.js functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js`
Expected: FAIL

**Step 3: Implement projection-backed reads**

- source on-hand/reserved/available from balances
- source demand from demand boundary
- remove old shortage arithmetic from local SQL

**Step 4: Run the targeted tests**

Run: `pnpm test:unit functions/services/__tests__/purchase-suggestions-inventory-semantics.test.js functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js functions/services/__tests__/variant-pricing-strategy.test.js functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/services/PurchaseOrderService.js functions/repositories/GoodsOverviewRepository.js functions/lib/hono/routes/manage/goods-overview.js functions/services/__tests__/purchase-suggestions-inventory-semantics.test.js functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js
git commit -m "refactor(reporting): move procurement and overview reads to balances"
```

### Task 7: Migrate AI, import/export, and frontend consumers to new inventory semantics

**Files:**
- Modify: `functions/lib/hono/routes/manage/ai.js`
- Modify: `functions/lib/hono/routes/manage/products/export.js`
- Modify: `src/views/PurchaseOrders.vue`
- Modify: `src/components/order/ProductBindingSection.vue`
- Modify: `src/components/product/ProductTable.vue`
- Modify: `src/components/product/ProductDetail.vue`
- Test: related existing route/component suites

**Step 1: Write failing tests for representative consumers**

Cover:

- AI reads new stock/demand semantics
- export emits projection-backed inventory values
- sales/product UI displays correct `available` or mapped inventory values

**Step 2: Run targeted consumer tests**

Run the smallest relevant route/component suites that fail on old semantics.
Expected: FAIL

**Step 3: Implement consumer migration**

- stop direct legacy stock truth reads where new semantics are required
- map projection data into existing UI/API contracts only where explicitly intended

**Step 4: Run targeted consumer tests**

Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/ai.js functions/lib/hono/routes/manage/products/export.js src/views/PurchaseOrders.vue src/components/order/ProductBindingSection.vue src/components/product/ProductTable.vue src/components/product/ProductDetail.vue
git commit -m "refactor(consumers): migrate ai export and ui to new inventory semantics"
```

### Task 8: Remove legacy stock truth ownership and compatibility fields from runtime paths

**Files:**
- Modify: `functions/repositories/ProductVariantRepository.js`
- Modify: `functions/repositories/ProductRepository.js`
- Modify: all remaining modules found by deletion checklist
- Test: `functions/services/__tests__/legacy-stock-paths.test.js`
- Test: `functions/services/__tests__/legacy-shortage-paths.test.js`

**Step 1: Update deletion tests to express final forbidden patterns**

Assert no direct business stock writes remain outside approved ledger/projection internals.

**Step 2: Run deletion tests to verify they fail**

Run: `pnpm test:unit functions/services/__tests__/legacy-stock-paths.test.js functions/services/__tests__/legacy-shortage-paths.test.js`
Expected: FAIL

**Step 3: Remove remaining compatibility code**

- remove direct stock write paths
- remove legacy shortage SQL
- remove obsolete helpers and fallbacks
- remove old truth-ownership comments and code branches

**Step 4: Run deletion tests**

Run: `pnpm test:unit functions/services/__tests__/legacy-stock-paths.test.js functions/services/__tests__/legacy-shortage-paths.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/repositories/ProductVariantRepository.js functions/repositories/ProductRepository.js functions/services/__tests__/legacy-stock-paths.test.js functions/services/__tests__/legacy-shortage-paths.test.js
git commit -m "refactor(cutover): remove legacy stock and shortage paths"
```

### Task 9: Add cutover runbook, migration steps, and reconciliation docs

**Files:**
- Create: `docs/plans/2026-03-10-full-architecture-cutover-runbook.md`
- Create: `docs/plans/2026-03-10-full-architecture-cutover-reconciliation.md`
- Modify: `docs/plans/2026-03-10-full-architecture-cutover-design.md`

**Step 1: Write the runbook**

Document:

- pre-cutover checks
- downtime order of operations
- migration commands
- validation sequence
- rollback trigger points

**Step 2: Write reconciliation doc**

Document:

- stock reconciliation queries
- reservation reconciliation queries
- procurement reconciliation queries
- pass/fail criteria

**Step 3: Review docs for YAGNI**

Keep them focused on operational cutover, not future roadmap.

**Step 4: Commit**

```bash
git add docs/plans/2026-03-10-full-architecture-cutover-runbook.md docs/plans/2026-03-10-full-architecture-cutover-reconciliation.md docs/plans/2026-03-10-full-architecture-cutover-design.md
git commit -m "docs(cutover): add cutover runbook and reconciliation plan"
```

### Task 10: Final full-repo verification before deleting old architecture branch

**Files:**
- Verify only

**Step 1: Run targeted backend architecture suites**

Run:

```bash
pnpm test:unit functions/repositories/__tests__/product-variant-upsert-stock.test.js functions/repositories/__tests__/order-inventory-flow.test.js functions/repositories/__tests__/order-mutations.test.js functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js functions/lib/hono/routes/manage/products/__tests__/variant-audit-routes.test.js functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js functions/services/__tests__/InventoryService.test.js functions/services/__tests__/DemandService.test.js functions/services/__tests__/purchase-suggestions-inventory-semantics.test.js
```

Expected: PASS

**Step 2: Run targeted frontend suites**

Run:

```bash
pnpm test:unit src/components/product/__tests__/ProductCreateModal.inventory-ownership.test.js src/components/product/__tests__/ProductCreateModal.variant-first.test.js src/components/product/__tests__/ProductCreateModal.external-codes.test.js src/components/order/__tests__/ProductBindingSection.variant-status.test.js
```

Expected: PASS

**Step 3: Run real workflow suites if environment is available**

Run:

```bash
pnpm test:unit test/manage-products-workflow.test.js
```

Expected: PASS or SKIPPED when real API mode is disabled

**Step 4: Run deletion tests**

Run:

```bash
pnpm test:unit functions/services/__tests__/legacy-stock-paths.test.js functions/services/__tests__/legacy-shortage-paths.test.js
```

Expected: PASS

**Step 5: Inspect final diff scope**

Run:

```bash
git diff --stat
```

Expected: only architecture-cutover files changed

**Step 6: Commit final stabilization if needed**

```bash
git add .
git commit -m "chore(cutover): finalize full architecture migration"
```

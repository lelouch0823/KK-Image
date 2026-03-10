# Product Module SOTA Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate product-module data corruption risks, separate catalog editing from inventory facts, and establish a staged path toward closed-loop product, inventory, order, and purchase behavior.

**Architecture:** First harden the existing product stack in place by removing unsafe stock overwrites and tightening transactional boundaries. Then introduce explicit catalog and inventory service boundaries, followed by demand/reservation and inventory-ledger evolution. This plan assumes incremental refactoring, not a rewrite.

**Tech Stack:** Cloudflare D1/SQLite, Hono, Vue 3, Vitest, real API regression tests

---

### Task 1: Lock current failure modes into tests

**Files:**
- Modify: `functions/repositories/__tests__/product-variant-upsert-stock.test.js`
- Create: `functions/lib/hono/routes/manage/products/__tests__/product-create-transactional.test.js`
- Create: `functions/lib/hono/routes/manage/products/__tests__/product-patch-rollback-boundary.test.js`

**Step 1: Write a failing repository test for existing variant stock protection**

Add a test that asserts `syncVariants()` must not update `stock_quantity` in the `ON CONFLICT ... DO UPDATE` clause for existing variants.

**Step 2: Run the repository test to verify it fails**

Run: `pnpm test:unit functions/repositories/__tests__/product-variant-upsert-stock.test.js`
Expected: FAIL because SQL still contains `stock_quantity = excluded.stock_quantity`

**Step 3: Write a failing route/service regression test for create rollback boundaries**

Add a test covering product create failure after product row insert but before full completion, asserting no residual catalog rows remain.

**Step 4: Write a failing route/service regression test for patch rollback boundaries**

Add a test covering patch failure after variant sync started, asserting rollback does not revert unrelated inventory facts.

**Step 5: Run the new product route tests**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-create-transactional.test.js functions/lib/hono/routes/manage/products/__tests__/product-patch-rollback-boundary.test.js`
Expected: FAIL on current behavior

**Step 6: Commit**

```bash
git add functions/repositories/__tests__/product-variant-upsert-stock.test.js functions/lib/hono/routes/manage/products/__tests__/product-create-transactional.test.js functions/lib/hono/routes/manage/products/__tests__/product-patch-rollback-boundary.test.js
git commit -m "test(products): lock stock overwrite and rollback regressions"
```

### Task 2: Remove unsafe stock overwrite from variant sync

**Files:**
- Modify: `functions/repositories/ProductVariantRepository.js`
- Modify: `functions/repositories/__tests__/product-variant-upsert-stock.test.js`

**Step 1: Update the failing test to express desired behavior clearly**

Assert:

- insert bindings still include initial `stock_quantity`
- update clause no longer sets `stock_quantity = excluded.stock_quantity`

**Step 2: Run the repository test to verify it still fails**

Run: `pnpm test:unit functions/repositories/__tests__/product-variant-upsert-stock.test.js`
Expected: FAIL on missing implementation

**Step 3: Implement the minimal repository change**

In `syncVariants()`:

- keep `stock_quantity` in the insert column list
- remove `stock_quantity` from the `ON CONFLICT(id) DO UPDATE SET` clause

Do not change `createBatch()` insert semantics for new variants.

**Step 4: Run the repository test to verify it passes**

Run: `pnpm test:unit functions/repositories/__tests__/product-variant-upsert-stock.test.js`
Expected: PASS

**Step 5: Run adjacent variant repository tests**

Run: `pnpm test:unit functions/repositories/__tests__/variant-external-codes.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add functions/repositories/ProductVariantRepository.js functions/repositories/__tests__/product-variant-upsert-stock.test.js
git commit -m "fix(products): prevent syncVariants from overwriting stock"
```

### Task 3: Introduce catalog-level service boundary

**Files:**
- Create: `functions/services/ProductCatalogService.js`
- Modify: `functions/lib/hono/routes/manage/products/create-product.js`
- Modify: `functions/lib/hono/routes/manage/products/[id].js`
- Test: `functions/lib/hono/routes/manage/products/__tests__/product-create-transactional.test.js`
- Test: `functions/lib/hono/routes/manage/products/__tests__/product-patch-rollback-boundary.test.js`

**Step 1: Write a failing service-oriented test for create orchestration**

Add a test that exercises create through a single service entry point and asserts dependent writes are coordinated together.

**Step 2: Write a failing service-oriented test for patch orchestration**

Add a test asserting patch orchestration no longer performs broad snapshot replay rollback.

**Step 3: Run the targeted tests to verify they fail**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-create-transactional.test.js functions/lib/hono/routes/manage/products/__tests__/product-patch-rollback-boundary.test.js`
Expected: FAIL

**Step 4: Implement `ProductCatalogService`**

Move orchestration logic out of routes:

- validate product payload
- create/update product core fields
- sync dimensions
- sync variants
- sync variant images
- schedule audit/caching at boundary points

Route files should keep only request parsing and HTTP error mapping.

**Step 5: Replace broad rollback with scoped compensation**

On create:

- track created IDs for product-owned records during the current operation
- only roll back records created in this operation

On patch:

- stop replaying stale pre-operation stock snapshots
- limit rollback to catalog mutations introduced by the failed operation

**Step 6: Run the service/route tests**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-create-transactional.test.js functions/lib/hono/routes/manage/products/__tests__/product-patch-rollback-boundary.test.js`
Expected: PASS

**Step 7: Run key product route regressions**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js functions/lib/hono/routes/manage/products/__tests__/variant-audit-routes.test.js`
Expected: PASS

**Step 8: Commit**

```bash
git add functions/services/ProductCatalogService.js functions/lib/hono/routes/manage/products/create-product.js functions/lib/hono/routes/manage/products/[id].js functions/lib/hono/routes/manage/products/__tests__/product-create-transactional.test.js functions/lib/hono/routes/manage/products/__tests__/product-patch-rollback-boundary.test.js
git commit -m "refactor(products): move catalog orchestration into service"
```

### Task 4: Make product form catalog-only for existing variants

**Files:**
- Modify: `src/composables/useProductForm.js`
- Modify: `src/components/product/ProductCreateModal.vue`
- Create: `src/components/product/__tests__/ProductCreateModal.inventory-ownership.test.js`

**Step 1: Write a failing frontend test for edit-mode inventory protection**

Add a test asserting edit mode does not submit mutable `stock_quantity` updates for existing variants as authoritative inventory changes.

**Step 2: Run the frontend test to verify it fails**

Run: `pnpm test:unit src/components/product/__tests__/ProductCreateModal.inventory-ownership.test.js`
Expected: FAIL

**Step 3: Implement minimal UI/composable behavior**

In edit mode:

- existing variant stock fields become read-only or informational
- submit payload must not imply authority over real inventory

In create mode:

- keep initial stock entry for brand-new variants

**Step 4: Run the new frontend test**

Run: `pnpm test:unit src/components/product/__tests__/ProductCreateModal.inventory-ownership.test.js`
Expected: PASS

**Step 5: Run adjacent product form tests**

Run: `pnpm test:unit src/components/product/__tests__/ProductCreateModal.variant-first.test.js src/components/product/__tests__/ProductCreateModal.external-codes.test.js src/components/product/__tests__/ProductCreateModal.variant-images.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add src/composables/useProductForm.js src/components/product/ProductCreateModal.vue src/components/product/__tests__/ProductCreateModal.inventory-ownership.test.js
git commit -m "fix(products-ui): separate catalog editing from inventory facts"
```

### Task 5: Centralize inventory mutations

**Files:**
- Create: `functions/services/InventoryService.js`
- Modify: `functions/services/PurchaseOrderService.js`
- Modify: `functions/repositories/ProductVariantRepository.js`
- Create: `functions/services/__tests__/InventoryService.test.js`
- Modify: `functions/services/__tests__/purchase-order-moving-average-cost.test.js`

**Step 1: Write a failing inventory service test**

Cover:

- increment stock
- decrement stock
- reject invalid mutation payloads
- preserve non-negative stock floor

**Step 2: Run the inventory service test to verify it fails**

Run: `pnpm test:unit functions/services/__tests__/InventoryService.test.js`
Expected: FAIL because service does not exist yet

**Step 3: Implement `InventoryService`**

Provide a single API for:

- `purchase_arrival`
- `manual_adjustment`
- future `order_shipment`
- future `reservation_release`

Internally call repository-level atomic stock mutation.

**Step 4: Update `PurchaseOrderService` to depend on `InventoryService`**

Replace direct SQL/batch inventory mutation with the new service.

**Step 5: Run the inventory and purchase tests**

Run: `pnpm test:unit functions/services/__tests__/InventoryService.test.js functions/services/__tests__/purchase-order-moving-average-cost.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add functions/services/InventoryService.js functions/services/PurchaseOrderService.js functions/repositories/ProductVariantRepository.js functions/services/__tests__/InventoryService.test.js functions/services/__tests__/purchase-order-moving-average-cost.test.js
git commit -m "refactor(inventory): centralize inventory mutations in service"
```

### Task 6: Unify product validation semantics

**Files:**
- Create: `functions/lib/hono/routes/manage/products/product-schema.js`
- Modify: `functions/lib/hono/routes/manage/products/create-product.js`
- Modify: `functions/lib/hono/routes/manage/products/[id].js`
- Modify: `src/composables/useProductForm.js`
- Create: `functions/lib/hono/routes/manage/products/__tests__/product-validation-rules.test.js`

**Step 1: Write failing backend validation tests**

Cover:

- invalid currency rejected
- negative price rejected
- negative stock rejected for initial create payload
- invalid status rejected
- empty variant list rejected

**Step 2: Run the validation test to verify it fails**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-validation-rules.test.js`
Expected: FAIL

**Step 3: Implement shared backend validation**

Move product payload validation into one backend schema/helper used by both create and patch paths.

**Step 4: Remove silent frontend coercion where semantics are dangerous**

Front-end can still default empty currency for new form initialization, but submitted invalid user input must not silently mask errors as authoritative domain behavior.

**Step 5: Run validation tests**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-validation-rules.test.js`
Expected: PASS

**Step 6: Run related product route tests**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js`
Expected: PASS

**Step 7: Commit**

```bash
git add functions/lib/hono/routes/manage/products/product-schema.js functions/lib/hono/routes/manage/products/create-product.js functions/lib/hono/routes/manage/products/[id].js src/composables/useProductForm.js functions/lib/hono/routes/manage/products/__tests__/product-validation-rules.test.js
git commit -m "feat(products): unify validation rules across create and edit"
```

### Task 7: Establish demand/reservation groundwork

**Files:**
- Modify: `functions/lib/hono/routes/sales/orders.js`
- Modify: `functions/lib/hono/routes/manage/orders/create-order.js`
- Modify: `functions/lib/hono/routes/manage/orders/detail.js`
- Create: `functions/services/DemandService.js`
- Create: `functions/services/__tests__/DemandService.test.js`
- Modify: `functions/services/PurchaseOrderService.js`

**Step 1: Write failing tests for reservation or demand accounting**

Cover:

- confirmed order creates demand
- void/cancel/reject releases demand
- delivered/shipped path is prepared for later stock deduction integration

**Step 2: Run the demand tests to verify they fail**

Run: `pnpm test:unit functions/services/__tests__/DemandService.test.js`
Expected: FAIL

**Step 3: Implement minimal `DemandService`**

Do not build full ledger yet. Establish one boundary that computes and updates demand/reservation state consistently.

**Step 4: Wire order lifecycle transitions into demand handling**

Hook managed and sales order mutation points into the service.

**Step 5: Run demand and order tests**

Run: `pnpm test:unit functions/services/__tests__/DemandService.test.js functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add functions/services/DemandService.js functions/services/__tests__/DemandService.test.js functions/lib/hono/routes/sales/orders.js functions/lib/hono/routes/manage/orders/create-order.js functions/lib/hono/routes/manage/orders/detail.js functions/services/PurchaseOrderService.js
git commit -m "feat(demand): establish order demand lifecycle boundary"
```

### Task 8: Rework purchase suggestion calculations around unified inventory semantics

**Files:**
- Modify: `functions/services/PurchaseOrderService.js`
- Modify: `functions/repositories/GoodsOverviewRepository.js`
- Create: `functions/services/__tests__/purchase-suggestions-inventory-semantics.test.js`

**Step 1: Write a failing purchase suggestion test**

Add a test showing suggestion calculations must respect unified stock and demand semantics instead of raw ad hoc SQL subtraction.

**Step 2: Run the test to verify it fails**

Run: `pnpm test:unit functions/services/__tests__/purchase-suggestions-inventory-semantics.test.js`
Expected: FAIL

**Step 3: Implement the calculation update**

Refactor suggestion logic to use the new demand/inventory boundary rather than scattered assumptions.

**Step 4: Run the purchase suggestion test**

Run: `pnpm test:unit functions/services/__tests__/purchase-suggestions-inventory-semantics.test.js`
Expected: PASS

**Step 5: Run goods overview tests**

Run: `pnpm test:unit functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add functions/services/PurchaseOrderService.js functions/repositories/GoodsOverviewRepository.js functions/services/__tests__/purchase-suggestions-inventory-semantics.test.js
git commit -m "fix(procurement): align suggestions with inventory semantics"
```

### Task 9: Define P2 inventory ledger migration path

**Files:**
- Create: `docs/plans/2026-03-10-product-module-inventory-ledger-followup.md`
- Modify: `docs/plans/2026-03-10-product-module-sota-design.md`

**Step 1: Write the follow-up technical note**

Document:

- proposed inventory ledger schema
- `on_hand / reserved / available` model
- migration sequencing from current `stock_quantity`
- compatibility strategy for existing reports and APIs

**Step 2: Review the note for YAGNI**

Keep it to schema, invariants, migration sequencing, and compatibility only.

**Step 3: Commit**

```bash
git add docs/plans/2026-03-10-product-module-inventory-ledger-followup.md docs/plans/2026-03-10-product-module-sota-design.md
git commit -m "docs(products): define inventory ledger follow-up path"
```

### Task 10: Final verification before merge

**Files:**
- Verify only

**Step 1: Run targeted unit suites**

Run: `pnpm test:unit functions/repositories/__tests__/product-variant-upsert-stock.test.js functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js functions/lib/hono/routes/manage/products/__tests__/variant-audit-routes.test.js functions/services/__tests__/InventoryService.test.js functions/services/__tests__/DemandService.test.js`
Expected: PASS

**Step 2: Run targeted frontend suites**

Run: `pnpm test:unit src/components/product/__tests__/ProductCreateModal.inventory-ownership.test.js src/components/product/__tests__/ProductCreateModal.variant-first.test.js src/components/product/__tests__/ProductCreateModal.external-codes.test.js`
Expected: PASS

**Step 3: Run real API product workflow regression if environment is available**

Run: `pnpm test -- test/manage-products-workflow.test.js`
Expected: PASS

**Step 4: Inspect diff for accidental scope creep**

Run: `git diff --stat`
Expected: only product, inventory, demand, and related test/doc files changed

**Step 5: Commit final stabilization if needed**

```bash
git add .
git commit -m "chore(products): finalize sota remediation"
```

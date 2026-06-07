# Variant Governance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce a strict variant-first workflow and add enterprise variant controls: availability status, unified display naming, replenishment constraints, variant pricing references, external codes, batch variant generation, and variant audit logs.

**Architecture:** Keep relational integrity on `product_variants` as the source of truth, extend schema for operational fields (`moq/pack/order_step/barcode/supplier_sku/suggested_price`), and centralize variant display/availability logic in shared helpers used by backend and frontend. Write-paths must emit audit records; read-paths must expose normalized variant metadata for purchase/order/space flows.

**Tech Stack:** Cloudflare D1 (SQLite), Cloudflare Workers + Hono, Vue 3 Composition API, Vitest, Tailwind.

---

### Task 1: DB Schema for Variant Ops Fields

**Files:**

- Create: `migrations/0044_variant_ops_fields.sql`
- Test/Verify: local D1 schema checks via Wrangler

**Step 1: Write failing schema expectation checks**

Run:
`npx wrangler d1 execute DB --local --command "PRAGMA table_info(product_variants);"`

Expected: no `moq`, `pack_size`, `order_step`, `suggested_purchase_price`, `barcode`, `supplier_sku`.

**Step 2: Add migration**

Add columns with safe defaults:

- `moq INTEGER NOT NULL DEFAULT 1`
- `pack_size INTEGER NOT NULL DEFAULT 1`
- `order_step INTEGER NOT NULL DEFAULT 1`
- `suggested_purchase_price REAL NOT NULL DEFAULT 0`
- `barcode TEXT`
- `supplier_sku TEXT`

Add constraints/indexes:

- check `moq >= 1`, `pack_size >= 1`, `order_step >= 1`
- unique index for non-empty `barcode`
- index for `supplier_sku`

**Step 3: Apply migration**

Run:
`npx wrangler d1 migrations apply DB --local`

Expected: `0044_variant_ops_fields.sql` applied.

**Step 4: Verify schema**

Run:
`npx wrangler d1 execute DB --local --command "PRAGMA table_info(product_variants);"`

Expected: new columns present with expected defaults.

**Step 5: Commit**

```bash
git add migrations/0044_variant_ops_fields.sql
git commit -m "feat(db): add variant operational fields for replenishment and external codes"
```

### Task 2: DB Schema for Variant Audit Log

**Files:**

- Create: `migrations/0045_variant_audit_logs.sql`
- Test/Verify: local D1 table/trigger checks

**Step 1: Write failing table existence check**

Run:
`npx wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE name='variant_audit_logs';"`

Expected: no row.

**Step 2: Add migration**

Create `variant_audit_logs`:

- `id`, `variant_id`, `product_id`, `actor_type`, `actor_id`, `action`, `changes_json`, `created_at`
- indexes on `(variant_id, created_at)` and `(product_id, created_at)`

**Step 3: Apply migration**

Run:
`npx wrangler d1 migrations apply DB --local`

Expected: `0045_variant_audit_logs.sql` applied.

**Step 4: Verify table**

Run:
`npx wrangler d1 execute DB --local --command "PRAGMA table_info(variant_audit_logs);"`

Expected: columns exist.

**Step 5: Commit**

```bash
git add migrations/0045_variant_audit_logs.sql
git commit -m "feat(db): add variant audit logs table"
```

### Task 3: Shared Variant Naming and Availability Logic (TDD)

**Files:**

- Create: `src/utils/variant-meta.js`
- Create: `src/utils/__tests__/variant-meta.test.js`
- Create: `functions/lib/utils/variant-meta.js`
- Create: `functions/lib/utils/__tests__/variant-meta.test.js`

**Step 1: Write failing tests**

Cover:

- fixed label order: `color / material / size`
- fallback key normalization (`Color`, `颜色`, etc.)
- availability state:
  - archived => `disabled_archived`
  - stock `<= 0` => `disabled_out_of_stock`
  - stock `<= alert_threshold` => `low_stock`
  - else `available`

**Step 2: Run tests (RED)**

Run:

- `pnpm test:unit src/utils/__tests__/variant-meta.test.js`
- `pnpm test:unit functions/lib/utils/__tests__/variant-meta.test.js`

Expected: FAIL.

**Step 3: Implement minimal helpers**

Implement:

- `normalizeVariantOptions(raw)`
- `buildVariantDisplayName(raw)`
- `getVariantAvailabilityState(variant)`

**Step 4: Run tests (GREEN)**

Run same two test commands.

Expected: PASS.

**Step 5: Commit**

```bash
git add src/utils/variant-meta.js src/utils/__tests__/variant-meta.test.js functions/lib/utils/variant-meta.js functions/lib/utils/__tests__/variant-meta.test.js
git commit -m "feat(variant): add shared display-name and availability helpers"
```

### Task 4: Wire Feature #2 and #3 Into GoodsOverview/Purchase/Order/Space (TDD)

**Files:**

- Modify: `functions/repositories/GoodsOverviewRepository.js`
- Modify: `functions/services/PurchaseOrderService.js`
- Modify: `src/components/order/ProductBindingSection.vue`
- Modify: `src/views/GoodsOverview.vue`
- Modify: `src/views/PurchaseOrders.vue`
- Modify: `src/components/OrderCreateModal.vue`
- Modify: `src/components/OrderEditModal.vue`
- Modify: `src/components/SpaceCreateModal.vue`
- Modify: `src/components/SpaceProductEditor.vue`
- Test: `functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js`
- Test: `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
- Create: `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`

**Step 1: Write failing tests**

Add assertions:

- display name uses unified helper order
- unavailable variants rendered disabled
- low stock variants show warning state

**Step 2: Run tests (RED)**

Run:

- `pnpm test:unit functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js`
- `pnpm test:unit functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
- `pnpm test:unit src/components/order/__tests__/ProductBindingSection.variant-status.test.js`

Expected: FAIL.

**Step 3: Implement minimal wiring**

Use shared helper output in backend row mappers and frontend selectors.

**Step 4: Run tests (GREEN)**

Run same commands.

Expected: PASS.

**Step 5: Commit**

```bash
git add functions/repositories/GoodsOverviewRepository.js functions/services/PurchaseOrderService.js src/components/order/ProductBindingSection.vue src/views/GoodsOverview.vue src/views/PurchaseOrders.vue src/components/OrderCreateModal.vue src/components/OrderEditModal.vue src/components/SpaceCreateModal.vue src/components/SpaceProductEditor.vue src/components/order/__tests__/ProductBindingSection.variant-status.test.js functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js
git commit -m "feat(variant): enforce availability states and unified display naming across flows"
```

### Task 5: Feature #4 Replenishment Rules (MOQ/Pack/Step) (TDD)

**Files:**

- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Modify: `functions/repositories/PurchaseOrderRepository.js`
- Modify: `functions/services/PurchaseOrderService.js`
- Modify: `src/views/PurchaseOrders.vue`
- Create: `functions/services/__tests__/purchase-order-constraints.test.js`
- Create: `src/views/__tests__/PurchaseOrders.constraints.test.js`

**Step 1: Write failing tests**

Rules:

- quantity `< moq` rejected
- `(quantity - moq) % order_step !== 0` rejected
- quantity not aligned to `pack_size` warns + suggests nearest value

**Step 2: Run tests (RED)**

Run:

- `pnpm test:unit functions/services/__tests__/purchase-order-constraints.test.js`
- `pnpm test:unit src/views/__tests__/PurchaseOrders.constraints.test.js`

Expected: FAIL.

**Step 3: Implement minimal validation + suggestion**

Backend hard validation; frontend pre-check and recommendation text.

**Step 4: Run tests (GREEN)**

Run same commands.

Expected: PASS.

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/purchase-orders.js functions/repositories/PurchaseOrderRepository.js functions/services/PurchaseOrderService.js src/views/PurchaseOrders.vue functions/services/__tests__/purchase-order-constraints.test.js src/views/__tests__/PurchaseOrders.constraints.test.js
git commit -m "feat(purchase): enforce variant moq/pack/step replenishment rules"
```

### Task 6: Feature #5 Variant Pricing Strategy (TDD)

**Files:**

- Modify: `functions/services/PurchaseOrderService.js`
- Modify: `functions/repositories/PurchaseOrderRepository.js`
- Modify: `src/views/PurchaseOrders.vue`
- Create: `functions/services/__tests__/variant-pricing-strategy.test.js`

**Step 1: Write failing tests**

Need response fields:

- `variant_cost_price`
- `suggested_purchase_price`
- `last_purchase_price`
- `price_delta`

**Step 2: Run tests (RED)**

Run:
`pnpm test:unit functions/services/__tests__/variant-pricing-strategy.test.js`

Expected: FAIL.

**Step 3: Implement minimal aggregation**

Use last completed PO item per variant for `last_purchase_price`.

**Step 4: Run tests (GREEN)**

Run same command.

Expected: PASS.

**Step 5: Commit**

```bash
git add functions/services/PurchaseOrderService.js functions/repositories/PurchaseOrderRepository.js src/views/PurchaseOrders.vue functions/services/__tests__/variant-pricing-strategy.test.js
git commit -m "feat(pricing): add variant-level suggested and last purchase price comparisons"
```

### Task 7: Feature #6 External Codes (barcode/supplier_sku) (TDD)

**Files:**

- Modify: `functions/repositories/ProductVariantRepository.js`
- Modify: `functions/lib/hono/routes/manage/products/[id].js`
- Modify: `src/components/product/ProductCreateModal.vue`
- Create: `functions/repositories/__tests__/variant-external-codes.test.js`
- Create: `src/components/product/__tests__/ProductCreateModal.external-codes.test.js`

**Step 1: Write failing tests**

Cover:

- save/read barcode + supplier_sku
- barcode unique validation

**Step 2: Run tests (RED)**

Run:

- `pnpm test:unit functions/repositories/__tests__/variant-external-codes.test.js`
- `pnpm test:unit src/components/product/__tests__/ProductCreateModal.external-codes.test.js`

Expected: FAIL.

**Step 3: Implement minimal fields**

Expose fields in API payload and UI form rows.

**Step 4: Run tests (GREEN)**

Run same commands.

Expected: PASS.

**Step 5: Commit**

```bash
git add functions/repositories/ProductVariantRepository.js functions/lib/hono/routes/manage/products/[id].js src/components/product/ProductCreateModal.vue functions/repositories/__tests__/variant-external-codes.test.js src/components/product/__tests__/ProductCreateModal.external-codes.test.js
git commit -m "feat(variant): support barcode and supplier_sku fields"
```

### Task 8: Feature #7 Batch Variant Builder (TDD)

**Files:**

- Create: `src/components/product/VariantBatchBuilderModal.vue`
- Modify: `src/components/product/ProductCreateModal.vue`
- Create: `src/components/product/__tests__/VariantBatchBuilderModal.test.js`

**Step 1: Write failing tests**

Cover:

- generate matrix from `颜色 x 材质 x 尺码`
- dedupe existing combinations
- batch apply price/stock/status

**Step 2: Run tests (RED)**

Run:
`pnpm test:unit src/components/product/__tests__/VariantBatchBuilderModal.test.js`

Expected: FAIL.

**Step 3: Implement minimal generator**

Generate deterministic `variant_code`, `options_values`, defaults.

**Step 4: Run tests (GREEN)**

Run same command.

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/product/VariantBatchBuilderModal.vue src/components/product/ProductCreateModal.vue src/components/product/__tests__/VariantBatchBuilderModal.test.js
git commit -m "feat(ui): add batch variant matrix builder"
```

### Task 9: Feature #8 Variant Audit Logging (TDD)

**Files:**

- Create: `functions/repositories/VariantAuditRepository.js`
- Modify: `functions/lib/hono/routes/manage/products/[id].js`
- Modify: `functions/repositories/ProductVariantRepository.js`
- Create: `functions/repositories/__tests__/variant-audit.test.js`
- Create: `functions/lib/hono/routes/manage/products/__tests__/variant-audit-routes.test.js`

**Step 1: Write failing tests**

Cover audit creation on:

- variant create
- variant price/stock/status update
- variant archive/delete

**Step 2: Run tests (RED)**

Run:

- `pnpm test:unit functions/repositories/__tests__/variant-audit.test.js`
- `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/variant-audit-routes.test.js`

Expected: FAIL.

**Step 3: Implement minimal audit writes**

Record before/after diff JSON in one row per action.

**Step 4: Run tests (GREEN)**

Run same commands.

Expected: PASS.

**Step 5: Commit**

```bash
git add functions/repositories/VariantAuditRepository.js functions/lib/hono/routes/manage/products/[id].js functions/repositories/ProductVariantRepository.js functions/repositories/__tests__/variant-audit.test.js functions/lib/hono/routes/manage/products/__tests__/variant-audit-routes.test.js
git commit -m "feat(audit): add variant operation audit trails"
```

### Task 10: Final Verification and QA Notes

**Files:**

- Modify: `docs/plans/2026-02-25-variant-images-design.md`
- Create/Modify: `docs/plans/2026-02-25-variant-governance-qa.md`

**Step 1: Run full targeted suite**

Run:

- `pnpm test:unit functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js`
- `pnpm test:unit functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
- `pnpm test:unit functions/repositories/__tests__/PurchaseOrderRepository.variant-required.test.js`
- `pnpm test:unit functions/repositories/__tests__/variant-external-codes.test.js`
- `pnpm test:unit functions/repositories/__tests__/variant-audit.test.js`
- `pnpm test:unit src/components/order/__tests__/ProductBindingSection.variant-status.test.js`
- `pnpm test:unit src/components/product/__tests__/VariantBatchBuilderModal.test.js`

Expected: all pass.

**Step 2: Manual smoke**

Run:
`pnpm run dev:all`

Check:

- variant selector blocks archived/out-of-stock
- display labels consistent (`颜色 / 材质 / 尺码`)
- replenishment quantity suggestion works
- audit records visible in DB

**Step 3: Update QA docs**

Record executed commands + screenshots + known limitations.

**Step 4: Commit**

```bash
git add docs/plans/2026-02-25-variant-images-design.md docs/plans/2026-02-25-variant-governance-qa.md
git commit -m "docs(qa): record variant governance verification evidence"
```

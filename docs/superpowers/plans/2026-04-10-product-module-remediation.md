# Product Module Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

## Execution Status

- Completed on 2026-04-10.
- All 7 remediation tasks were implemented and committed in sequence.
- Final regression sweep passed: 23 test files, 128 tests.
- Final remediation commits:
  - `a849ceb` / `c4272f7` variant image invariant hardening
  - `4895358` sales variant availability enforcement
  - `38d0279` duplicate procurement guardrails
  - `c6bc3c3` space binding validation hardening
  - `3f70954` export semantics alignment
  - `4c3099b` product selector image normalization

**Goal:** Close all confirmed product-module audit findings in a safe order, starting with data integrity and order/procurement correctness, then UI/error-semantics, then lower-risk cleanup.

**Architecture:** Fixes are grouped by business boundary, not by technical layer. Each phase first adds regression coverage, then tightens backend invariants, then aligns frontend and mini-program consumers to the same semantics so validation, projection, and UI states do not drift again.

**Tech Stack:** Vue 3, Hono, Cloudflare D1, Vitest

---

## Repair Order

1. Variant image invariant hardening
2. Sales binding stock policy enforcement
3. Procurement duplicate-order guardrails
4. Space binding validation hardening
5. Export/error semantics alignment
6. Low-risk cleanup and consistency fixes

---

### Task 1: Variant Image Repository Invariants

**Files:**
- Modify: `functions/repositories/VariantImageRepository.js`
- Test: `functions/repositories/__tests__/variant-image-repository.test.js`

- [x] **Step 1: Add failing repository tests for duplicate image insertion**
- [x] **Step 2: Add failing repository tests for primary-image uniqueness on insert**
- [x] **Step 3: Add failing repository test for `setPrimary()` with nonexistent `imageId`**
- [x] **Step 4: Update `addImage()` so duplicate `image_id` under the same variant is rejected or no-op with explicit behavior**
- [x] **Step 5: Update `addImage()` so `isPrimary=true` clears previous primaries atomically before insert**
- [x] **Step 6: Update `setPrimary()` to verify the target image exists before demoting existing primaries**
- [x] **Step 7: Run targeted tests**

Run:
```bash
pnpm vitest run functions/repositories/__tests__/variant-image-repository.test.js
```

- [x] **Step 8: Run product image related regression tests**

Run:
```bash
pnpm vitest run src/components/product/__tests__/VariantImageManagerModal.test.js src/utils/__tests__/product-image.test.js
```

- [x] **Step 9: Commit**

```bash
git add functions/repositories/VariantImageRepository.js functions/repositories/__tests__/variant-image-repository.test.js src/components/product/__tests__/VariantImageManagerModal.test.js src/utils/__tests__/product-image.test.js
git commit -m "fix: enforce variant image invariants"
```

### Task 2: Enforce Sales-Side In-Stock Variant Policy

**Files:**
- Modify: `functions/api/utils/validation.js`
- Modify: `functions/lib/hono/routes/sales/orders.js`
- Modify: `src/components/order/ProductBindingSection.vue`
- Modify: `src/views/sales/SalesFormView.vue`
- Modify: `minisales/miniprogram/components/sales/product-binding/index.ts`
- Test: `functions/api/utils/__tests__/validation.test.js`
- Test: `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`
- Test: `src/views/sales/__tests__/SalesFormView.resilience.test.js`

- [x] **Step 1: Add failing backend tests for rejecting out-of-stock variants in sales create/update flows**
- [x] **Step 2: Extend validation helper to support policy-aware checks**
- [x] **Step 3: Use strict sales policy in sales create/update routes**
- [x] **Step 4: Update `ProductBindingSection` so success is emitted only when a selectable variant is actually resolved**
- [x] **Step 5: Emit a concrete “variant required / no selectable variant” error when all variants are filtered out**
- [x] **Step 6: Mirror the same empty-selectable handling in mini-program sales binding**
- [x] **Step 7: Add/adjust component tests for false-success regression**
- [x] **Step 8: Run targeted tests**

Run:
```bash
pnpm vitest run functions/api/utils/__tests__/validation.test.js src/components/order/__tests__/ProductBindingSection.variant-status.test.js src/views/sales/__tests__/SalesFormView.resilience.test.js src/components/order/__tests__/sales-order-flow-contract.test.js
```

- [x] **Step 9: Commit**

```bash
git add functions/api/utils/validation.js functions/lib/hono/routes/sales/orders.js src/components/order/ProductBindingSection.vue src/views/sales/SalesFormView.vue minisales/miniprogram/components/sales/product-binding/index.ts functions/api/utils/__tests__/validation.test.js src/components/order/__tests__/ProductBindingSection.variant-status.test.js src/views/sales/__tests__/SalesFormView.resilience.test.js src/components/order/__tests__/sales-order-flow-contract.test.js
git commit -m "fix: enforce sales variant availability policy"
```

### Task 3: Prevent Duplicate Procurement of the Same Pre-Order

**Files:**
- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Modify: `functions/services/PurchaseOrderService.js`
- Modify: `functions/repositories/PurchaseOrderRepository.js`
- Modify: `src/components/purchase-order/OrderPickerModal.vue`
- Test: `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
- Test: `functions/repositories/__tests__/purchase-order-repository-safety.test.js`
- Test: `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`

- [x] **Step 1: Add failing route/service tests for reusing the same `pre_order_id` in another active purchase order**
- [x] **Step 2: Add repository query/helper to detect active purchase-order bindings for pre-orders**
- [x] **Step 3: Harden `validatePreOrderBinding()` to reject already-procured or already-linked pre-orders**
- [x] **Step 4: Harden `createFromOrders()` to filter/reject orders already in procurement**
- [x] **Step 5: Update `OrderPickerModal` filtering to hide orders already linked or already in procurement when the data is available**
- [x] **Step 6: Ensure error messages are explicit enough for operators to resolve duplicates**
- [x] **Step 7: Run targeted tests**

Run:
```bash
pnpm vitest run functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js functions/repositories/__tests__/purchase-order-repository-safety.test.js src/components/purchase-order/__tests__/OrderPickerModal.detail-workflow.test.js
```

- [x] **Step 8: Commit**

```bash
git add functions/lib/hono/routes/manage/purchase-orders.js functions/services/PurchaseOrderService.js functions/repositories/PurchaseOrderRepository.js src/components/purchase-order/OrderPickerModal.vue functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js functions/repositories/__tests__/purchase-order-repository-safety.test.js src/components/purchase-order/__tests__/OrderPickerModal.detail-workflow.test.js
git commit -m "fix: block duplicate procurement bindings"
```

### Task 4: Harden Space Product/Variant Binding Validity

**Files:**
- Modify: `functions/lib/hono/routes/manage/spaces/crud.js`
- Modify: `functions/api/utils/validation.js`
- Modify: `src/components/SpaceCreateModal.vue`
- Test: `functions/lib/hono/routes/manage/spaces/__tests__/subspaces-routes.test.js`
- Test: `functions/lib/hono/routes/manage/spaces/__tests__/transformers.test.js`
- Test: `src/components/__tests__/SpaceProductEditor.contract.test.js`

- [x] **Step 1: Add failing tests for rejecting nonexistent product/variant bindings on create/update**
- [x] **Step 2: Change space create/update to use existence validation instead of pair-only validation**
- [x] **Step 3: Decide and document whether archived products/variants are allowed for existing spaces; implement the chosen rule consistently**
- [x] **Step 4: Fix `SpaceCreateModal.unbindProduct()` to clear both `productId` and `variantId`**
- [x] **Step 5: Verify space edit/create flows still preserve valid bound-product state**
- [x] **Step 6: Run targeted tests**

Run:
```bash
pnpm vitest run functions/lib/hono/routes/manage/spaces/__tests__/subspaces-routes.test.js functions/lib/hono/routes/manage/spaces/__tests__/transformers.test.js src/components/__tests__/SpaceProductEditor.contract.test.js
```

- [x] **Step 7: Commit**

```bash
git add functions/lib/hono/routes/manage/spaces/crud.js functions/api/utils/validation.js src/components/SpaceCreateModal.vue functions/lib/hono/routes/manage/spaces/__tests__/subspaces-routes.test.js functions/lib/hono/routes/manage/spaces/__tests__/transformers.test.js src/components/__tests__/SpaceProductEditor.contract.test.js
git commit -m "fix: validate space product bindings"
```

### Task 5: Align Product Export Failure and Payload Semantics

**Files:**
- Modify: `functions/lib/hono/routes/manage/products/export.js`
- Modify: `src/components/product/ProductExportModal.vue`
- Modify: `src/components/product/export/export-utils.js`
- Test: `src/components/product/__tests__/ProductExportModal.filters.test.js`
- Test: `src/components/product/export/__tests__/export-utils.test.js`

- [x] **Step 1: Add failing tests for export filter propagation and non-200 failure handling**
- [x] **Step 2: Decide whether legacy route should be upgraded or deprecated behind frontend-only flow; prefer one canonical export path**
- [x] **Step 3: Update route to return proper HTTP failure semantics instead of CSV-embedded error text**
- [x] **Step 4: Ensure route output matches the frontend’s expected variant-level export contract, or remove the stale call path entirely**
- [x] **Step 5: Run targeted tests**

Run:
```bash
pnpm vitest run src/components/product/__tests__/ProductExportModal.filters.test.js src/components/product/export/__tests__/export-utils.test.js
```

- [x] **Step 6: Commit**

```bash
git add functions/lib/hono/routes/manage/products/export.js src/components/product/ProductExportModal.vue src/components/product/export/export-utils.js src/components/product/__tests__/ProductExportModal.filters.test.js src/components/product/export/__tests__/export-utils.test.js
git commit -m "fix: align product export semantics"
```

### Task 6: Low-Risk Consistency Cleanup

**Files:**
- Modify: `src/components/product/ProductSelect.vue`
- Modify: `src/utils/product-image.js`
- Test: `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`
- Test: `src/composables/__tests__/useProducts.cache.test.js`
- Test: `src/utils/__tests__/product-image.test.js`

- [x] **Step 1: Add failing test for sales product selector handling absolute image URLs**
- [x] **Step 2: Route sales selector image rendering through shared image normalization instead of raw `/file/` concatenation**
- [x] **Step 3: Run targeted tests**

Run:
```bash
pnpm vitest run src/utils/__tests__/product-image.test.js src/composables/__tests__/useProducts.cache.test.js src/components/order/__tests__/ProductBindingSection.variant-status.test.js
```

- [x] **Step 4: Commit**

```bash
git add src/components/product/ProductSelect.vue src/utils/product-image.js src/utils/__tests__/product-image.test.js src/composables/__tests__/useProducts.cache.test.js src/components/order/__tests__/ProductBindingSection.variant-status.test.js
git commit -m "fix: normalize sales product picker images"
```

### Task 7: Full Regression Sweep

**Files:**
- Verify only

- [x] **Step 1: Run backend and frontend product/order/procurement/space regression suites**

Run:
```bash
pnpm vitest run functions/api/utils/__tests__/validation.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/lib/hono/routes/manage/spaces/__tests__/subspaces-routes.test.js src/components/order/__tests__/ProductBindingSection.variant-status.test.js src/components/order/__tests__/sales-order-flow-contract.test.js src/views/sales/__tests__/SalesFormView.resilience.test.js src/components/purchase-order/__tests__/OrderPickerModal.detail-workflow.test.js src/components/__tests__/SpaceProductEditor.contract.test.js src/components/product/__tests__/ProductExportModal.filters.test.js src/components/product/export/__tests__/export-utils.test.js src/utils/__tests__/product-image.test.js
```

- [x] **Step 2: Run broader product manager/UI regressions**

Run:
```bash
pnpm vitest run src/components/__tests__/ProductManager.variant-hydration.test.js src/components/__tests__/ProductManager.create-success-ux.test.js src/components/product/__tests__/ProductCreateModal.variant-images.test.js src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js
```

- [x] **Step 3: Update the audit document with fixed status and residual risks**
- [x] **Step 4: Commit final verification/documentation pass**

```bash
git add docs/reviews/2026-04-10-product-module-full-audit.md
git commit -m "docs: close product module audit findings"
```

## Notes

- Do not mix Task 1 and Task 2 in the same commit. Task 1 protects core image data integrity and should land independently.
- Task 3 must be completed before any replenishment/UI polishing work, otherwise procurement totals remain untrustworthy.
- Task 4 should preserve existing valid space bindings; the goal is to reject invalid new writes, not silently rewrite historic data.
- If Task 5 reveals the legacy export route is unused, deleting the stale route is preferable to maintaining two divergent contracts.

# Variant Images Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add robust multi-image management per product variant and make order/detail/space flows render variant-specific images consistently.

**Architecture:** Introduce a new `variant_images` relation table with strict integrity constraints, add repository and route APIs for CRUD/sort/primary operations, and wire the frontend with dual-entry management (advanced modal + inline editor). Read paths always prioritize variant images and fallback to product images.

**Tech Stack:** Cloudflare D1 (SQLite), Cloudflare Workers + Hono, Vue 3 Composition API, Vitest, Tailwind.

---

### Task 1: Database Schema and Integrity

**Files:**

- Create: `migrations/0039_variant_images.sql`

**Step 1: Write the failing migration validation query expectations**

- Define expected DB behavior before migration:
  - `variant_images` table absent
  - no trigger for single-primary enforcement

**Step 2: Apply migration locally and verify fails before file exists**

Run: `npx wrangler d1 migrations apply DB --local`  
Expected: no `0039` migration found.

**Step 3: Write migration SQL**

- Create `variant_images` table, indexes, unique constraints.
- Add triggers:
  - one primary per variant
  - auto-repair primary after delete/update edge cases.

**Step 4: Re-run migration to verify it applies**

Run: `npx wrangler d1 migrations apply DB --local`  
Expected: `0039_variant_images.sql` applied successfully.

**Step 5: Commit**

```bash
git add migrations/0039_variant_images.sql
git commit -m "feat(db): add variant_images schema with integrity constraints"
```

### Task 2: Repository Layer for Variant Images (TDD)

**Files:**

- Modify: `functions/repositories/ProductVariantRepository.js`
- Create: `functions/repositories/VariantImageRepository.js`
- Test: `functions/repositories/__tests__/variant-images.test.js`

**Step 1: Write failing tests**

- add image links
- set primary atomically
- sort images
- delete image and repair primary
- reject cross-product variant operations

**Step 2: Run targeted test and confirm failures**

Run: `pnpm test:unit functions/repositories/__tests__/variant-images.test.js`  
Expected: failing assertions for unimplemented methods.

**Step 3: Implement minimal repository code**

- add CRUD/sort/primary methods and constrained queries.

**Step 4: Run test to green**

Run: `pnpm test:unit functions/repositories/__tests__/variant-images.test.js`  
Expected: pass.

**Step 5: Commit**

```bash
git add functions/repositories/ProductVariantRepository.js functions/repositories/VariantImageRepository.js functions/repositories/__tests__/variant-images.test.js
git commit -m "feat(repo): add variant image repository operations"
```

### Task 3: API Endpoints for Variant Image Management (TDD)

**Files:**

- Modify: `functions/lib/hono/routes/manage/products/[id].js`
- Modify: `functions/lib/hono/routes/manage/products/index.js`
- Test: `functions/lib/hono/routes/manage/products/__tests__/variant-images-routes.test.js`

**Step 1: Write failing route tests**

- `POST .../images`
- `PATCH .../images/sort`
- `PATCH .../images/:imageId/primary`
- `DELETE .../images/:imageId`
- ownership validation with wrong `variantId/productId`.

**Step 2: Run route tests and verify red**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/variant-images-routes.test.js`  
Expected: route not found / bad behavior failures.

**Step 3: Implement route handlers**

- add handlers with repository calls and bad-request guards.
- enrich product detail response with `variants[].images` and `primaryImage`.

**Step 4: Run tests to green**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/variant-images-routes.test.js`  
Expected: pass.

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/products/[id].js functions/lib/hono/routes/manage/products/index.js functions/lib/hono/routes/manage/products/__tests__/variant-images-routes.test.js
git commit -m "feat(api): add variant image management endpoints"
```

### Task 4: Advanced Variant Image Modal (Frontend, TDD)

**Files:**

- Create: `src/components/product/VariantImageManagerModal.vue`
- Modify: `src/components/product/ProductCreateModal.vue`
- Modify: `src/composables/useProducts.js`
- Test: `src/components/product/__tests__/VariantImageManagerModal.test.js`

**Step 1: Write failing component tests**

- renders variant list and image panel
- upload callback updates list
- set-primary emits correct payload
- drag-sort emits sorted output

**Step 2: Run tests and confirm red**

Run: `pnpm test:unit src/components/product/__tests__/VariantImageManagerModal.test.js`  
Expected: component/method missing failures.

**Step 3: Implement minimal modal + composable calls**

- wire APIs from task 3.
- keep product editor integration behind explicit button entry.

**Step 4: Run tests to green**

Run: `pnpm test:unit src/components/product/__tests__/VariantImageManagerModal.test.js`  
Expected: pass.

**Step 5: Commit**

```bash
git add src/components/product/VariantImageManagerModal.vue src/components/product/ProductCreateModal.vue src/composables/useProducts.js src/components/product/__tests__/VariantImageManagerModal.test.js
git commit -m "feat(ui): add advanced variant image management modal"
```

### Task 5: Inline Variant Row Image Management

**Files:**

- Modify: `src/components/product/ProductCreateModal.vue`
- Test: `src/components/product/__tests__/ProductCreateModal.variant-images.test.js`

**Step 1: Write failing inline interaction tests**

- row-level upload
- row-level set-primary
- row-level remove image

**Step 2: Run tests and verify red**

Run: `pnpm test:unit src/components/product/__tests__/ProductCreateModal.variant-images.test.js`  
Expected: UI control behavior failing.

**Step 3: Implement inline controls**

- compact strip + quick actions.
- optimistic update + rollback toast.

**Step 4: Run tests to green**

Run: `pnpm test:unit src/components/product/__tests__/ProductCreateModal.variant-images.test.js`  
Expected: pass.

**Step 5: Commit**

```bash
git add src/components/product/ProductCreateModal.vue src/components/product/__tests__/ProductCreateModal.variant-images.test.js
git commit -m "feat(ui): add inline variant image controls in product editor"
```

### Task 6: Downstream Rendering Integration (Order/Detail/Space)

**Files:**

- Modify: `src/components/order/ProductBindingSection.vue`
- Modify: `src/components/OrderCreateModal.vue`
- Modify: `src/components/OrderEditModal.vue`
- Modify: `src/components/product/ProductDetail.vue`
- Modify: `src/components/SpaceCreateModal.vue`
- Modify: `src/components/SpaceProductEditor.vue`
- Modify: `functions/repositories/SpaceRepository.js`
- Test: `functions/repositories/__tests__/SpaceRepository.test.js`

**Step 1: Write failing tests for fallback/render priority**

- variant primary preferred over product image
- fallback chain works when variant images empty.

**Step 2: Run tests and verify red**

Run: `pnpm test:unit functions/repositories/__tests__/SpaceRepository.test.js`  
Expected: mismatch in selected image source.

**Step 3: Implement minimal integration**

- ensure APIs and UI map `variantId -> primaryImage` consistently.

**Step 4: Run tests to green**

Run: `pnpm test:unit functions/repositories/__tests__/SpaceRepository.test.js`  
Expected: pass.

**Step 5: Commit**

```bash
git add src/components/order/ProductBindingSection.vue src/components/OrderCreateModal.vue src/components/OrderEditModal.vue src/components/product/ProductDetail.vue src/components/SpaceCreateModal.vue src/components/SpaceProductEditor.vue functions/repositories/SpaceRepository.js functions/repositories/__tests__/SpaceRepository.test.js
git commit -m "feat(integration): use variant images across order detail and spaces"
```

### Task 7: Verification and Regression

**Files:**

- Modify: `docs/plans/2026-02-25-variant-images-design.md` (checklist updates)

**Step 1: Run targeted test suite**

Run:

- `pnpm test:unit functions/repositories/__tests__/variant-images.test.js`
- `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/variant-images-routes.test.js`
- `pnpm test:unit src/components/product/__tests__/VariantImageManagerModal.test.js`
- `pnpm test:unit src/components/product/__tests__/ProductCreateModal.variant-images.test.js`

Expected: all pass.

**Step 2: Run local e2e smoke with Wrangler+Vite**

Run: `pnpm run dev:all`  
Manual checks:

- inline + modal edits persist
- order variant switch updates image
- space preview uses variant primary image.

**Step 3: Update checklist and commit**

```bash
git add docs/plans/2026-02-25-variant-images-design.md
git commit -m "docs(qa): record variant image regression verification"
```

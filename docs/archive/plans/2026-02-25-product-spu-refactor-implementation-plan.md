# Product SPU Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace main product `sku` with optional `spu` end-to-end while keeping variant `sku` required and globally unique.

**Architecture:** Perform a hard cutover without backward compatibility. First migrate D1 schema (`products.sku` -> `products.spu`), then update backend repositories/routes and frontend forms/views/import mappings to use `spu` exclusively for main products. Keep variant flows unchanged except where parent product identifier labels or payload keys currently use `sku`.

**Tech Stack:** Cloudflare D1 (SQLite), Wrangler migrations, Cloudflare Workers + Hono, Vue 3 Composition API, Vitest, pnpm.

---

### Task 1: Database Migration (`products.sku` -> `products.spu`, nullable unique)

**Files:**

- Create: `migrations/0040_product_spu_refactor.sql`

**Step 1: Write failing migration validation expectations**

- Verify current schema still has `products.sku` and no `products.spu`.
- Validate that inserting product with null `sku` currently fails.

**Step 2: Run red checks**

Run:

- `npx wrangler d1 execute DB --local --command "PRAGMA table_info(products);"`
- `npx wrangler d1 execute DB --local --command "INSERT INTO products (id,name,sku,created_at,updated_at) VALUES ('p_red','Red Test','',unixepoch(),unixepoch());"`

Expected: no `spu` column yet, and constraints tied to `sku`.

**Step 3: Implement migration SQL**

- Rebuild `products` table with `spu TEXT UNIQUE` (nullable).
- Copy data from old `sku` into `spu`.
- Recreate product indexes using `spu`.

**Step 4: Run green checks**

Run:

- `npx wrangler d1 migrations apply DB --local`
- `npx wrangler d1 execute DB --local --command "PRAGMA table_info(products);"`
- `npx wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_products_spu';"`

Expected: migration applies; `spu` exists; `idx_products_spu` exists.

**Step 5: Commit**

```bash
git add migrations/0040_product_spu_refactor.sql
git commit -m "feat(db): replace product sku with optional spu"
```

### Task 2: Repository and Route Contract Update (TDD)

**Files:**

- Modify: `functions/repositories/ProductRepository.js`
- Modify: `functions/lib/hono/routes/manage/products/index.js`
- Create: `functions/repositories/__tests__/product-spu.test.js`
- Create: `functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js`

**Step 1: Write failing repository tests**

- Product create succeeds with `spu` omitted.
- Product create/update with duplicate non-empty `spu` fails.
- Search/find methods return `spu` field.

**Step 2: Run red repository tests**

Run: `pnpm test:unit functions/repositories/__tests__/product-spu.test.js`  
Expected: FAIL on missing/new `spu` behavior.

**Step 3: Implement minimal repository changes**

- Replace product-level SQL references from `sku` to `spu`.
- Make `spu` optional in validation and persistence logic.
- Keep variant repository untouched (`product_variants.sku` remains required).

**Step 4: Run repository tests to green**

Run: `pnpm test:unit functions/repositories/__tests__/product-spu.test.js`  
Expected: PASS.

**Step 5: Write failing route tests**

- POST `/api/manage/products` requires only `name`.
- Conflict only when non-empty `spu` duplicates.
- Response payload exposes `spu`.

**Step 6: Run red route tests**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js`  
Expected: FAIL for old `sku` requirement.

**Step 7: Implement minimal route changes**

- Remove `body.sku` required check.
- Conditional uniqueness check only for non-empty `spu`.

**Step 8: Run route tests to green**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js`  
Expected: PASS.

**Step 9: Commit**

```bash
git add functions/repositories/ProductRepository.js functions/lib/hono/routes/manage/products/index.js functions/repositories/__tests__/product-spu.test.js functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js
git commit -m "feat(api): switch main product identifier from sku to spu"
```

### Task 3: Product Create/Edit UI Field Rename and Validation (TDD)

**Files:**

- Modify: `src/components/product/ProductCreateModal.vue`
- Modify: `src/locales/en/product.js`
- Modify: `src/locales/zh-CN/product.js`
- Create: `src/components/product/__tests__/ProductCreateModal.spu.test.js`

**Step 1: Write failing component tests**

- Form submits when `name` exists and `spu` is empty.
- Payload key is `spu` (not `sku`).
- Variant SKU generation no longer depends on required parent `sku`.

**Step 2: Run red tests**

Run: `pnpm test:unit src/components/product/__tests__/ProductCreateModal.spu.test.js`  
Expected: FAIL due to old `sku` requirement and payload key.

**Step 3: Implement minimal UI changes**

- Rename main field display and data binding `sku -> spu`.
- Update validation to require only name.
- Update payload mapping to send `spu`.

**Step 4: Run tests to green**

Run: `pnpm test:unit src/components/product/__tests__/ProductCreateModal.spu.test.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/product/ProductCreateModal.vue src/components/product/__tests__/ProductCreateModal.spu.test.js src/locales/en/product.js src/locales/zh-CN/product.js
git commit -m "feat(ui): rename main product sku field to optional spu"
```

### Task 4: Product List/Detail/Binding Rendering Update (TDD)

**Files:**

- Modify: `src/components/product/ProductTable.vue`
- Modify: `src/components/product/ProductDetail.vue`
- Modify: `src/components/order/ProductBindingSection.vue`
- Modify: `src/components/OrderCreateModal.vue`
- Modify: `src/components/OrderEditModal.vue`
- Modify: `src/components/SpaceCreateModal.vue`
- Modify: `src/components/SpaceProductEditor.vue`
- Create: `src/components/product/__tests__/ProductDisplay.spu.test.js`

**Step 1: Write failing display tests**

- Product table/detail renders `spu`.
- Order/space binding uses `product.spu` for parent identifier display.
- Variant display still uses `variant.sku`.

**Step 2: Run red tests**

Run: `pnpm test:unit src/components/product/__tests__/ProductDisplay.spu.test.js`  
Expected: FAIL on old `sku` bindings.

**Step 3: Implement minimal display changes**

- Swap parent product identifier UI references to `spu`.
- Keep variant selector and variant payload unchanged (`variant.sku`).

**Step 4: Run tests to green**

Run: `pnpm test:unit src/components/product/__tests__/ProductDisplay.spu.test.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/product/ProductTable.vue src/components/product/ProductDetail.vue src/components/order/ProductBindingSection.vue src/components/OrderCreateModal.vue src/components/OrderEditModal.vue src/components/SpaceCreateModal.vue src/components/SpaceProductEditor.vue src/components/product/__tests__/ProductDisplay.spu.test.js
git commit -m "feat(ui): render spu for main product identifiers"
```

### Task 5: Import/Export and Batch Mapping Update (TDD)

**Files:**

- Modify: `src/components/product/ProductImportModal.vue`
- Modify: `src/components/product/import/ImportUploadStep.vue`
- Modify: `functions/lib/hono/routes/manage/products/export.js`
- Modify: `functions/lib/hono/routes/manage/products/batch.js`
- Create: `src/components/product/__tests__/ProductImportModal.spu.test.js`

**Step 1: Write failing import/export tests**

- Import accepts optional `spu` column.
- Batch processing maps `spu` instead of `sku` for product-level identifier.
- Export includes `spu` field.

**Step 2: Run red tests**

Run: `pnpm test:unit src/components/product/__tests__/ProductImportModal.spu.test.js`  
Expected: FAIL on old required `sku` import mapping.

**Step 3: Implement minimal import/export changes**

- Replace product-level schema key `sku` with `spu` and make optional.
- Update server-side batch/export field mappings.

**Step 4: Run tests to green**

Run: `pnpm test:unit src/components/product/__tests__/ProductImportModal.spu.test.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/product/ProductImportModal.vue src/components/product/import/ImportUploadStep.vue functions/lib/hono/routes/manage/products/export.js functions/lib/hono/routes/manage/products/batch.js src/components/product/__tests__/ProductImportModal.spu.test.js
git commit -m "feat(import-export): switch product identifier mapping to optional spu"
```

### Task 6: Full Verification and Regression

**Files:**

- Modify: `docs/plans/2026-02-25-product-spu-refactor-design.md`

**Step 1: Run targeted backend tests**

Run:

- `pnpm test:unit functions/repositories/__tests__/product-spu.test.js`
- `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js`

Expected: all pass.

**Step 2: Run targeted frontend tests**

Run:

- `pnpm test:unit src/components/product/__tests__/ProductCreateModal.spu.test.js`
- `pnpm test:unit src/components/product/__tests__/ProductDisplay.spu.test.js`
- `pnpm test:unit src/components/product/__tests__/ProductImportModal.spu.test.js`

Expected: all pass.

**Step 3: Run smoke startup**

Run: `pnpm run dev:all`  
Manual checks:

- Create product without `spu` succeeds.
- Create product with `spu` persists and displays.
- Variant `sku` remains required and visible.
- Product import without `spu` still imports.

**Step 4: Update design checklist and commit**

```bash
git add docs/plans/2026-02-25-product-spu-refactor-design.md
git commit -m "docs(qa): record spu refactor verification evidence"
```

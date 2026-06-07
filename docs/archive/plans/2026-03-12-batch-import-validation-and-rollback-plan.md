# Batch Import Validation And Rollback Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make product batch import follow the same validation contract as create/edit and roll back existing-product updates when a later import step fails.

**Architecture:** Reuse the existing product/variant validation helpers before any import-side writes, then snapshot the existing product + variants for update cases so a failed variant sync can restore both product fields and variant state. Keep the route contract unchanged while tightening service behavior.

**Tech Stack:** Node.js, Hono, Vitest, repository/service layer in `functions/`

---

### Task 1: Lock import behavior with failing tests

**Files:**

- Modify: `functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js`

**Step 1: Write the failing tests**

- Add a batch-import test that rejects invalid currency and negative variant fields before any repository write.
- Add a batch-import test that rolls back an existing product update when `syncVariants` fails after product fields changed.

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js`

Expected: FAIL because batch import currently writes product updates before variant failure and does not reuse create/edit validation.

### Task 2: Implement shared validation + rollback in batch import

**Files:**

- Modify: `functions/services/ProductCatalogService.js`

**Step 1: Validate import items before writes**

- Normalize and validate product payloads for each import item before `create` / `updateWithMeta` / `syncVariants`.
- Reuse the same variant validation rules as create/edit.

**Step 2: Add rollback for existing-product updates**

- Snapshot existing product fields and variants before update.
- If any later import step fails, restore product fields and restore variants with `syncVariants`.

**Step 3: Run targeted tests**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js`

Expected: PASS

### Task 3: Run adjacent regressions

**Files:**

- No code changes

**Step 1: Run product service/route regressions**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-validation-rules.test.js functions/lib/hono/routes/manage/products/__tests__/variant-audit-routes.test.js functions/repositories/__tests__/variant-external-codes.test.js`

Expected: PASS

**Step 2: Run lint on touched backend files**

Run: `npx eslint functions/services/ProductCatalogService.js functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js`

Expected: PASS

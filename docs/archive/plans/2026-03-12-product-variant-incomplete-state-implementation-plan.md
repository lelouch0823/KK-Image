# Product Variant Incomplete State Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a blocking warning state for legacy variants that no longer match the current spec structure during product editing.

**Architecture:** Detect incomplete legacy variants in `useProductForm` from the current active dimension names and the variant's `options_values` keys. Surface that client-side state in `ProductVariantTable` and `ProductCreateModal`, block submit while such rows remain, and preserve the existing delete-to-archive workflow.

**Tech Stack:** Vue 3, Composition API, Vue Test Utils, Vitest

---

### Task 1: Lock the new behavior with failing tests

**Files:**
- Modify: `src/components/product/__tests__/ProductVariantTable.test.js`
- Modify: `src/components/product/__tests__/ProductCreateModal.edit-variant-preservation.test.js`
- Create: `src/composables/__tests__/useProductForm.incomplete-variants.test.js`

**Step 1: Write the failing tests**

- Add a table test asserting an incomplete variant row renders a pending label and warning styling hook.
- Extend the edit-mode preservation test to assert the legacy row is marked incomplete and that save is blocked until it is removed.
- Add a composable test for the detection helper so the rule is stable and isolated.

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/product/__tests__/ProductVariantTable.test.js src/components/product/__tests__/ProductCreateModal.edit-variant-preservation.test.js src/composables/__tests__/useProductForm.incomplete-variants.test.js`

Expected: FAIL because incomplete variants are not currently marked, rendered, or blocked from submission.

### Task 2: Implement incomplete-variant detection and submit blocking

**Files:**
- Modify: `src/composables/useProductForm.js`

**Step 1: Add a pure helper**

- Export a helper that compares current active dimension names against a variant's option keys.
- Mark legacy edit-mode variants with a client-side `pending_incomplete` state.

**Step 2: Expose form-level summary state**

- Add a computed-style count/list helper for incomplete variants.
- Make `handleSubmit` reject submission with a clear toast if any incomplete variants remain.

**Step 3: Re-run targeted tests**

Run: `pnpm test:unit src/composables/__tests__/useProductForm.incomplete-variants.test.js`

Expected: PASS

### Task 3: Render the warning UI in the variant table and modal

**Files:**
- Modify: `src/components/product/ProductVariantTable.vue`
- Modify: `src/components/product/ProductCreateModal.vue`

**Step 1: Add warning presentation**

- Render warning-tinted rows for incomplete variants.
- Show `Pending` in the status column for these rows instead of the normal archive/active toggle.
- Add helper text in the first cell for incomplete variants.

**Step 2: Add summary warning banner and save lock**

- Render a warning banner above the table when incomplete variants exist.
- Disable the save button when incomplete variants exist in edit mode.

**Step 3: Re-run targeted tests**

Run: `pnpm test:unit src/components/product/__tests__/ProductVariantTable.test.js src/components/product/__tests__/ProductCreateModal.edit-variant-preservation.test.js`

Expected: PASS

### Task 4: Run adjacent regressions and static verification

**Files:**
- No code changes

**Step 1: Run adjacent product form tests**

Run: `pnpm test:unit src/components/product/__tests__/ProductCreateModal.external-codes.test.js src/components/product/__tests__/ProductCreateModal.variant-first.test.js src/components/product/__tests__/ProductCreateModal.inventory-ownership.test.js src/components/product/__tests__/ProductCreateModal.value-archive.test.js src/components/product/__tests__/ProductCreateModal.dimension-archive.test.js`

Expected: PASS

**Step 2: Run lint on touched files**

Run: `npx eslint src/composables/useProductForm.js src/components/product/ProductVariantTable.vue src/components/product/ProductCreateModal.vue src/components/product/__tests__/ProductVariantTable.test.js src/components/product/__tests__/ProductCreateModal.edit-variant-preservation.test.js src/composables/__tests__/useProductForm.incomplete-variants.test.js`

Expected: PASS

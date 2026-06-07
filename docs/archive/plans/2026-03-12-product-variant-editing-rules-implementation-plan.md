# Product Variant Editing Rules Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Support deleting variant rows in the product form, stop automatic SKU generation, and preserve existing variant identity when editing product specs.

**Architecture:** Keep the backend variant sync contract unchanged: the frontend removes rows from the submitted variant list and the backend archives missing existing variants during edit. Update the product form generator so create mode rebuilds draft variants freely, while edit mode appends newly required combinations without rewriting existing variant records.

**Tech Stack:** Vue 3, Vue Test Utils, Vitest, composables in `src/composables`, product UI in `src/components/product`

---

### Task 1: Lock the desired behaviors with failing tests

**Files:**

- Modify: `src/components/product/__tests__/ProductVariantTable.test.js`
- Modify: `src/components/product/__tests__/ProductCreateModal.external-codes.test.js`
- Create: `src/components/product/__tests__/ProductCreateModal.edit-variant-preservation.test.js`

**Step 1: Write the failing tests**

- Add a table test asserting clicking the delete action emits a list without that variant row.
- Add/create modal coverage asserting generated draft variants leave `sku` empty instead of auto-filling.
- Add edit-mode coverage asserting adding a new spec dimension keeps the original variant and creates a new combination variant.

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/product/__tests__/ProductVariantTable.test.js src/components/product/__tests__/ProductCreateModal.external-codes.test.js src/components/product/__tests__/ProductCreateModal.edit-variant-preservation.test.js`

Expected: FAIL because the delete action does not exist, SKU is still auto-generated, and edit mode still rewrites the existing variant list.

### Task 2: Implement the minimal product form changes

**Files:**

- Modify: `src/components/product/ProductVariantTable.vue`
- Modify: `src/composables/useProductForm.js`

**Step 1: Add delete-row behavior**

- Add an actions column with a delete button.
- Emit `update:modelValue` with the targeted row removed.

**Step 2: Remove automatic SKU generation**

- Stop assigning `buildVariantSku(...)` during generated variant creation.
- Stop assigning generated SKU in batch apply for new variants.

**Step 3: Preserve existing variants in edit mode**

- Generate the current cartesian combinations.
- Reuse exact-match existing variants when possible.
- In edit mode, append existing variants with IDs whose combination no longer exactly matches the current cartesian set so they remain visible and manually manageable.

**Step 4: Run targeted tests**

Run: `pnpm test:unit src/components/product/__tests__/ProductVariantTable.test.js src/components/product/__tests__/ProductCreateModal.external-codes.test.js src/components/product/__tests__/ProductCreateModal.edit-variant-preservation.test.js`

Expected: PASS

### Task 3: Run broader regression checks

**Files:**

- No code changes

**Step 1: Run adjacent product form tests**

Run: `pnpm test:unit src/components/product/__tests__/ProductCreateModal.variant-first.test.js src/components/product/__tests__/ProductCreateModal.inventory-ownership.test.js src/components/product/__tests__/ProductCreateModal.value-archive.test.js src/components/product/__tests__/ProductCreateModal.dimension-archive.test.js`

Expected: PASS

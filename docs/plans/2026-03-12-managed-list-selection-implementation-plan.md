# Managed List Selection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a reusable managed-list selection composable and apply it to customer, salesperson, and product create flows so successful creates reset to page 1, highlight the new item, and optionally open detail without clearing filters.

**Architecture:** Introduce a narrow composable that owns only transient list interaction state (`selectedId`, `highlightedId`, post-create orchestration). Keep each module’s fetch, pagination, detail, and toast logic local. Roll out to customers first, then salespersons and products, with tests at composable and integration level.

**Tech Stack:** Vue 3 Composition API, Vitest, existing management views/components in `src/`

---

### Task 1: Add composable unit tests

**Files:**
- Create: `src/composables/__tests__/useManagedListSelection.test.js`
- Create: `src/composables/useManagedListSelection.js`

**Step 1: Write the failing test**

Add tests that cover:

- `selectItem()` stores the selected id
- `clearSelection()` clears the selected id
- `markHighlighted()` sets then clears `highlightedId`
- `handleCreated()` resets to page 1, reloads, and highlights the created item
- `handleCreated()` calls `openDetail()` when configured
- `handleCreated()` calls `onHiddenByFilters()` when the item is not visible

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/composables/__tests__/useManagedListSelection.test.js`

Expected: FAIL because the composable does not exist yet.

**Step 3: Write minimal implementation**

Implement `useManagedListSelection()` with:

- `selectedId` ref
- `highlightedId` ref
- timeout cleanup for highlight expiry
- helper methods:
  - `selectItem`
  - `clearSelection`
  - `markHighlighted`
  - `getRowClass`
  - `handleCreated`

Use the smallest API necessary for the three target modules.

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/composables/__tests__/useManagedListSelection.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/composables/useManagedListSelection.js src/composables/__tests__/useManagedListSelection.test.js
git commit -m "feat: add managed list selection composable"
```

### Task 2: Integrate into customer management

**Files:**
- Modify: `src/views/Customers.vue`
- Create or Modify Test: `src/views/__tests__/Customers.create-success-ux.test.js`

**Step 1: Write the failing test**

Add tests covering:

- create success resets customer page to `1`
- the created customer row/card gets highlighted after reload
- hidden-by-filter path shows an informational toast without clearing search

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/views/__tests__/Customers.create-success-ux.test.js`

Expected: FAIL because current implementation only calls `loadCustomers()` with the existing page.

**Step 3: Write minimal implementation**

In `Customers.vue`:

- import `useManagedListSelection`
- replace current row-class logic with composable output
- on create success call `handleCreated()`
- keep edit success behavior unchanged except for reusing reload helpers where helpful
- preserve existing `viewingCustomer` detail-panel behavior

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/views/__tests__/Customers.create-success-ux.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/views/Customers.vue src/views/__tests__/Customers.create-success-ux.test.js
git commit -m "feat: add managed create-success ux to customers"
```

### Task 3: Integrate into salesperson management

**Files:**
- Modify: `src/components/SalespersonManager.vue`
- Modify or Create Test: `src/components/__tests__/SalespersonManager.create-success-ux.test.js`

**Step 1: Write the failing test**

Add tests covering:

- create success resets to page `1`
- refreshed list highlights the created salesperson
- existing selection/detail behavior still works

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/__tests__/SalespersonManager.create-success-ux.test.js`

Expected: FAIL against the current create-success flow.

**Step 3: Write minimal implementation**

In `SalespersonManager.vue`:

- import the composable
- wire row highlight classes through `getRowClass`
- call `handleCreated()` from the create-success path
- keep module-specific toasts local

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/__tests__/SalespersonManager.create-success-ux.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/SalespersonManager.vue src/components/__tests__/SalespersonManager.create-success-ux.test.js
git commit -m "feat: add managed create-success ux to salespersons"
```

### Task 4: Integrate into product management

**Files:**
- Modify: `src/components/ProductManager.vue`
- Modify or Create Test: `src/components/__tests__/ProductManager.create-success-ux.test.js`

**Step 1: Write the failing test**

Add tests covering:

- create success resets to page `1`
- the created product is highlighted after reload
- product detail hydration still runs when opening the created product

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/__tests__/ProductManager.create-success-ux.test.js`

Expected: FAIL because the current module does not use shared post-create UX orchestration.

**Step 3: Write minimal implementation**

In `ProductManager.vue`:

- integrate `useManagedListSelection`
- preserve current detail hydration path
- call `handleCreated()` with module-specific `openDetail` logic

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/__tests__/ProductManager.create-success-ux.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ProductManager.vue src/components/__tests__/ProductManager.create-success-ux.test.js
git commit -m "feat: add managed create-success ux to products"
```

### Task 5: Run focused regression verification

**Files:**
- No code changes expected

**Step 1: Run focused test suite**

Run:

```bash
pnpm test:unit src/composables/__tests__/useManagedListSelection.test.js src/views/__tests__/Customers.create-success-ux.test.js src/components/__tests__/SalespersonManager.create-success-ux.test.js src/components/__tests__/ProductManager.create-success-ux.test.js src/components/__tests__/SalespersonManager.refresh.test.js src/components/__tests__/ProductManager.variant-hydration.test.js
```

Expected: PASS

**Step 2: Run lint on touched files**

Run:

```bash
pnpm eslint src/composables/useManagedListSelection.js src/views/Customers.vue src/components/SalespersonManager.vue src/components/ProductManager.vue
```

Expected: PASS

**Step 3: Commit**

```bash
git add .
git commit -m "test: verify managed list selection rollout"
```

### Task 6: Document rollout status

**Files:**
- Modify: `docs/plans/2026-03-12-managed-list-selection-design.md`

**Step 1: Record actual rollout notes**

Add a short “Implementation Notes” section describing:

- which modules were integrated
- any API compromises made
- whether orders/purchase-orders/spaces remain out of scope

**Step 2: Commit**

```bash
git add docs/plans/2026-03-12-managed-list-selection-design.md
git commit -m "docs: record managed list selection rollout notes"
```

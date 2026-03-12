# Management List Header Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify management list pages so each page has one top-level header and no duplicated in-panel title.

**Architecture:** Keep `ManagementListShell` as the single source of page title/description for management list pages. Remove duplicate titles from inner filter bars, and migrate pages that still render their own in-panel title block to the shared shell.

**Tech Stack:** Vue 3, Vite, Vitest, local design-system shells/components

---

### Task 1: Add regression tests for unique management headers

**Files:**
- Modify: `src/components/__tests__/OrderManager.design-system-migration.test.js`
- Create: `src/views/__tests__/Customers.design-system-migration.test.js`

**Step 1: Write the failing test**

Add assertions that:
- `OrderManager.vue` still uses `ManagementListShell`
- `OrderFilters.vue` no longer passes `title`/`subtitle` into `AppFilterBar`
- `Customers.vue` uses `ManagementListShell`

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/OrderManager.design-system-migration.test.js src/views/__tests__/Customers.design-system-migration.test.js`

Expected: FAIL because current order filters still render the duplicated title and customers does not use the shared shell.

**Step 3: Write minimal implementation**

Update the source files only enough to satisfy the assertions.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/OrderManager.design-system-migration.test.js src/views/__tests__/Customers.design-system-migration.test.js`

Expected: PASS

### Task 2: Remove duplicate order list title

**Files:**
- Modify: `src/components/order/OrderFilters.vue`

**Step 1: Write the failing test**

Covered by Task 1.

**Step 2: Run test to verify it fails**

Covered by Task 1.

**Step 3: Write minimal implementation**

Render `AppFilterBar` without duplicated title/subtitle so it behaves as a pure filter/action toolbar under the page shell.

**Step 4: Run test to verify it passes**

Run the focused Vitest command from Task 1.

### Task 3: Migrate customers page to the shared management shell

**Files:**
- Modify: `src/views/Customers.vue`

**Step 1: Write the failing test**

Covered by Task 1.

**Step 2: Run test to verify it fails**

Covered by Task 1.

**Step 3: Write minimal implementation**

Wrap the page with `ManagementListShell`, move the search/create controls into shell slots, preserve the existing split layout and permission handling, and remove the duplicate in-panel title block.

**Step 4: Run test to verify it passes**

Run the focused Vitest command from Task 1.

### Task 4: Verify adjacent management pages still follow the pattern

**Files:**
- Check: `src/components/ProductManager.vue`
- Check: `src/views/GoodsOverview.vue`
- Check: `src/views/PurchaseOrders.vue`
- Check: `src/views/FileManager/index.vue`

**Step 1: Review implementation**

Confirm these pages keep a single top-level `ManagementListShell` header and do not render a duplicate same-name section title.

**Step 2: Run targeted tests**

Run: `npx vitest run src/components/__tests__/ProductManager.design-system-migration.test.js src/views/__tests__/GoodsOverview.design-system-migration.test.js src/views/__tests__/PurchaseOrders.design-system-migration.test.js src/views/__tests__/FileManager.design-system-migration.test.js`

Expected: PASS

### Task 5: Final verification

**Files:**
- No code changes

**Step 1: Run the relevant test suite**

Run: `npx vitest run src/components/__tests__/OrderManager.design-system-migration.test.js src/views/__tests__/Customers.design-system-migration.test.js src/components/__tests__/ProductManager.design-system-migration.test.js src/views/__tests__/GoodsOverview.design-system-migration.test.js src/views/__tests__/PurchaseOrders.design-system-migration.test.js src/views/__tests__/FileManager.design-system-migration.test.js`

Expected: all PASS.

# Management List Visual Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine shared management list shells and tables so order/file/product style pages use a lighter, more precise admin visual language.

**Architecture:** Update the shared layout shell and table primitives first, then make the order list explicitly consume the lighter shell behavior. Lock the behavior with small design-contract tests before implementation so the new visual rules do not regress.

**Tech Stack:** Vue 3, Vitest, Vue Test Utils, Tailwind utility classes

---

### Task 1: Lock the lighter shell contract

**Files:**
- Modify: `src/design-system/__tests__/ManagementListShell.test.js`
- Modify: `src/design-system/patterns/ManagementListShell.vue`
- Modify: `src/design-system/composed/StatePanel.vue`

**Step 1: Write the failing test**

Add assertions that:
- filter region uses a lighter container variant than content
- content region keeps a single primary panel wrapper

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/design-system/__tests__/ManagementListShell.test.js`

**Step 3: Write minimal implementation**

Change `ManagementListShell` to pass explicit visual variants into `StatePanel`, and extend `StatePanel` so filters render as a light toolbar surface while content renders as the main panel surface.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/design-system/__tests__/ManagementListShell.test.js`

### Task 2: Lock the lighter table contract

**Files:**
- Modify: `src/components/ui/__tests__/AppTable.design-contract.test.js`
- Modify: `src/components/ui/AppTable.vue`

**Step 1: Write the failing test**

Add assertions that:
- default tables render a light outer card shell
- `noBorder` tables stay frameless
- header and row separators use lightweight table styling hooks

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/__tests__/AppTable.design-contract.test.js`

**Step 3: Write minimal implementation**

Refine `AppTable` classes to reduce heavy framing, tone down separators, and expose stable class hooks for the new visual contract.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/__tests__/AppTable.design-contract.test.js`

### Task 3: Align order list page with the shared shell

**Files:**
- Modify: `src/components/OrderManager.vue`
- Modify: `src/components/order/OrderTable.vue`
- Modify: `src/components/order/OrderFilters.vue`

**Step 1: Write the failing test**

Add or extend a focused order-manager test if needed so the desktop list uses the shared content shell without extra panel styling.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/__tests__/Dashboard.design-system-migration.test.js src/views/__tests__/PurchaseOrders.design-system-migration.test.js`

**Step 3: Write minimal implementation**

Remove redundant visual wrappers/classes in the order list flow and let the shared shell + table carry the new styling.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/__tests__/Dashboard.design-system-migration.test.js src/views/__tests__/PurchaseOrders.design-system-migration.test.js`

### Task 4: Verify shared regression surface

**Files:**
- Modify: none unless regressions appear

**Step 1: Run focused test suite**

Run: `npx vitest run src/design-system/__tests__/ManagementListShell.test.js src/components/ui/__tests__/AppTable.design-contract.test.js src/views/__tests__/Dashboard.design-system-migration.test.js src/views/__tests__/PurchaseOrders.design-system-migration.test.js`

**Step 2: Fix regressions if present**

Apply minimal visual or test updates only where the new shell contract breaks expected usage.

**Step 3: Run the focused suite again**

Run the same command and confirm all tests pass.

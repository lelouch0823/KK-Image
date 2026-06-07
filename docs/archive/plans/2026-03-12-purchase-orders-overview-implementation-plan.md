# Purchase Orders Overview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine the purchase-order overview into a more polished modern SaaS management surface without changing existing interaction logic or backend behavior.

**Architecture:** Keep the existing `PurchaseOrders` page structure and composable data flow intact, then tighten the visual hierarchy in three layers: KPI overview, primary list panel, and detail modal sections. Touch shared UI primitives only if the page cannot achieve the target hierarchy through the current design-system contract.

**Tech Stack:** Vue 3, Vitest, Vue Test Utils, Tailwind utility classes, shared semantic design tokens

---

### Task 1: Lock current purchase-order detail state coverage before visual refactor

**Files:**

- Modify: `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
- Modify: `src/views/PurchaseOrders.vue`
- Test: `src/views/__tests__/PurchaseOrders.detail-shell.test.js`

**Step 1: Write the failing test**

Extend the existing detail-shell test coverage to assert the visual section landmarks that must survive the refactor:

```js
it('keeps summary, progress, cost, and items regions visible once detail loads', async () => {
  // mount with hydrated detail
  expect(wrapper.find('[data-testid="purchase-order-detail-summary"]').exists()).toBe(true);
  expect(wrapper.find('[data-testid="purchase-order-detail-progress"]').exists()).toBe(true);
  expect(wrapper.find('[data-testid="purchase-order-detail-cost"]').exists()).toBe(true);
  expect(wrapper.find('[data-testid="purchase-order-detail-items"]').exists()).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/__tests__/PurchaseOrders.detail-shell.test.js`

Expected: FAIL because the new section hooks do not exist yet.

**Step 3: Write minimal implementation**

Add stable `data-testid` hooks in `src/views/PurchaseOrders.vue` around the modal summary, progress, cost, and items regions without changing business logic.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/__tests__/PurchaseOrders.detail-shell.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.detail-shell.test.js
git commit -m "test: lock purchase order detail section contract"
```

---

### Task 2: Refine the KPI overview row for a modern SaaS scan pattern

**Files:**

- Modify: `src/views/PurchaseOrders.vue`
- Test: `src/views/__tests__/PurchaseOrders.design-system-migration.test.js`

**Step 1: Write the failing test**

Add assertions that the purchase-order page keeps the metric row inside the shared content shell and exposes a dedicated overview wrapper class or test id for the KPI strip:

```js
expect(source).toContain('data-testid="purchase-order-overview-strip"');
expect(source).toContain('MetricTile');
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/__tests__/PurchaseOrders.design-system-migration.test.js`

Expected: FAIL because the new overview strip hook is absent.

**Step 3: Write minimal implementation**

Update the KPI area in `src/views/PurchaseOrders.vue` to:

- add a dedicated overview wrapper
- tighten spacing and alignment
- normalize card presentation using existing `MetricTile` props and token-backed layout classes
- keep the current click-to-filter behavior unchanged

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/__tests__/PurchaseOrders.design-system-migration.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.design-system-migration.test.js
git commit -m "style: refine purchase order overview strip"
```

---

### Task 3: Tighten the primary list panel hierarchy without changing table behavior

**Files:**

- Modify: `src/views/PurchaseOrders.vue`
- Modify: `src/components/ui/AppTable.vue` only if the page cannot achieve the target hierarchy locally
- Modify: `src/components/ui/__tests__/AppTable.design-contract.test.js` only if shared table hooks change
- Test: `src/views/__tests__/PurchaseOrders.design-system-migration.test.js`

**Step 1: Write the failing test**

Add or extend assertions so the page source reflects a dedicated list panel wrapper and keeps `AppTable` in frameless mode:

```js
expect(source).toContain('data-testid="purchase-order-list-panel"');
expect(source).toContain('no-border');
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/__tests__/PurchaseOrders.design-system-migration.test.js`

Expected: FAIL because the new list-panel hook is absent.

**Step 3: Write minimal implementation**

Refine the list section in `src/views/PurchaseOrders.vue` so that:

- the table and pagination sit inside one coherent panel wrapper
- the panel header rhythm is clearer even without adding new actions
- table row hover, identifier styling, and numeric emphasis align with the target SaaS hierarchy
- pagination visually closes the panel

Only touch `AppTable.vue` if local wrapper and slot styling cannot achieve the needed result cleanly.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/__tests__/PurchaseOrders.design-system-migration.test.js src/components/ui/__tests__/AppTable.design-contract.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.design-system-migration.test.js src/components/ui/AppTable.vue src/components/ui/__tests__/AppTable.design-contract.test.js
git commit -m "style: tighten purchase order list panel hierarchy"
```

---

### Task 4: Recompose the detail modal into clear visual regions

**Files:**

- Modify: `src/views/PurchaseOrders.vue`
- Test: `src/views/__tests__/PurchaseOrders.detail-shell.test.js`

**Step 1: Write the failing test**

Add assertions that the detail modal now includes a dedicated footer action region and keeps the retry/loading contracts intact:

```js
expect(wrapper.find('[data-testid="purchase-order-detail-footer"]').exists()).toBe(true);
expect(wrapper.find('[data-testid="purchase-order-detail-shell"]').exists()).toBe(true);
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/__tests__/PurchaseOrders.detail-shell.test.js`

Expected: FAIL because the footer region hook does not exist yet.

**Step 3: Write minimal implementation**

Rework the detail modal presentation in `src/views/PurchaseOrders.vue` so that:

- header reads as a stronger summary block
- stepper and cost summary are visually grouped near the top
- item list rows use a cleaner repeated layout
- bottom actions are gathered into a stable footer region
- loading, empty, and retry states remain behaviorally identical

Do not change any mutations, button meaning, or status transition logic.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/__tests__/PurchaseOrders.detail-shell.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.detail-shell.test.js
git commit -m "style: reorganize purchase order detail modal"
```

---

### Task 5: Verify the focused regression surface

**Files:**

- Modify: none unless regressions appear

**Step 1: Run focused test suite**

Run:

```bash
npx vitest run src/views/__tests__/PurchaseOrders.design-system-migration.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js src/components/ui/__tests__/AppTable.design-contract.test.js
```

Expected: all targeted tests pass.

**Step 2: Run lint on the touched page if needed**

Run:

```bash
npx eslint src/views/PurchaseOrders.vue src/components/ui/AppTable.vue
```

Expected: no lint errors in touched files. If `AppTable.vue` was not modified, omit it.

**Step 3: Fix regressions if present**

Apply only the minimal visual or test adjustments required by the failures.

**Step 4: Re-run verification**

Run the same Vitest and ESLint commands again and confirm clean output before claiming completion.

**Step 5: Commit**

```bash
git add src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.design-system-migration.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js src/components/ui/AppTable.vue src/components/ui/__tests__/AppTable.design-contract.test.js
git commit -m "style: polish purchase orders overview surface"
```

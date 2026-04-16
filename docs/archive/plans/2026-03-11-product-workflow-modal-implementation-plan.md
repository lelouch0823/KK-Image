# Product Workflow Modal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current detail-to-edit modal handoff with a single product workflow modal that preserves context during edit hydration and failure recovery.

**Architecture:** Add a workflow container component that owns detail, loading, and edit states for a selected product. Reuse the existing detail view and extract the existing product edit form into an embeddable panel so the workflow can switch content without closing the modal shell.

**Tech Stack:** Vue 3 Composition API, existing modal system, Vitest, Vue Test Utils

---

### Task 1: Lock in current regression with tests

**Files:**
- Modify: `src/components/__tests__/ProductManager.variant-hydration.test.js`
- Create: `src/components/product/__tests__/ProductWorkflowModal.test.js`

**Step 1: Write the failing test**

Add a manager-level test that describes the desired behavior:

- open product detail
- trigger edit from detail
- assert the product workflow remains visible during hydration
- assert the user does not return to the plain list state while hydration is pending

Add a workflow-level test that describes:

- starts in `detail`
- edit click enters `edit_loading`
- hydration success enters `edit`
- hydration failure returns to `detail` with retryable error

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/__tests__/ProductManager.variant-hydration.test.js src/components/product/__tests__/ProductWorkflowModal.test.js`

Expected: FAIL because the workflow component and state machine do not exist yet, and the manager still closes detail before edit opens.

**Step 3: Commit**

```bash
git add src/components/__tests__/ProductManager.variant-hydration.test.js src/components/product/__tests__/ProductWorkflowModal.test.js
git commit -m "test: capture product workflow modal behavior"
```

### Task 2: Extract the product form body from the modal shell

**Files:**
- Create: `src/components/product/ProductFormPanel.vue`
- Modify: `src/components/product/ProductCreateModal.vue`
- Test: `src/components/product/__tests__/ProductCreateModal.variant-first.test.js`

**Step 1: Write the failing test**

Add or adjust a test asserting that `ProductCreateModal` still renders the same edit/create form behavior after the form body is extracted.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/product/__tests__/ProductCreateModal.variant-first.test.js`

Expected: FAIL once the modal shell is updated to reference a non-existent extracted panel.

**Step 3: Write minimal implementation**

- Move the inner form markup and form actions from `ProductCreateModal.vue` into `ProductFormPanel.vue`
- Keep `useProductForm` inside the panel unless a later refactor proves necessary
- Make `ProductCreateModal.vue` a thin modal wrapper that passes props through to `ProductFormPanel`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/product/__tests__/ProductCreateModal.variant-first.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/product/ProductFormPanel.vue src/components/product/ProductCreateModal.vue src/components/product/__tests__/ProductCreateModal.variant-first.test.js
git commit -m "refactor: extract reusable product form panel"
```

### Task 3: Build the workflow modal container

**Files:**
- Create: `src/components/product/ProductWorkflowModal.vue`
- Modify: `src/components/product/ProductDetailModal.vue`
- Test: `src/components/product/__tests__/ProductWorkflowModal.test.js`

**Step 1: Write the failing test**

Expand the workflow test to cover:

- header action loading state
- loading overlay text
- inline retry error after hydration failure
- cancel from edit returns to detail

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/product/__tests__/ProductWorkflowModal.test.js`

Expected: FAIL because the workflow modal does not yet render these states.

**Step 3: Write minimal implementation**

- Create `ProductWorkflowModal.vue` with state:
  - `mode`
  - `currentProduct`
  - `editDraft`
  - `editHydrationError`
  - `editHydrationPending`
- Reuse `Modal.vue` as the shell
- Render `ProductDetail.vue` in `detail`
- Render `ProductFormPanel.vue` in `edit`
- During `edit_loading`, keep detail visible and apply a light overlay plus compact loading card
- On failure, keep detail visible and show inline retry UI with accessible alert semantics

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/product/__tests__/ProductWorkflowModal.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/product/ProductWorkflowModal.vue src/components/product/ProductDetailModal.vue src/components/product/__tests__/ProductWorkflowModal.test.js
git commit -m "feat: add product workflow modal states"
```

### Task 4: Rewire ProductManager to use the workflow modal

**Files:**
- Modify: `src/components/ProductManager.vue`
- Test: `src/components/__tests__/ProductManager.variant-hydration.test.js`

**Step 1: Write the failing test**

Update the manager test to assert:

- product list view opens workflow modal, not the old close-then-open sequence
- edit from detail no longer sets detail closed before hydration completes
- list refresh still occurs after successful save

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/__tests__/ProductManager.variant-hydration.test.js`

Expected: FAIL because `ProductManager` still uses `ProductDetailModal` plus `ProductCreateModal` as separate flows.

**Step 3: Write minimal implementation**

- Replace `ProductDetailModal` usage with `ProductWorkflowModal`
- Remove `handleEditFromDetail` close-first behavior
- Keep `handleCreate` using `ProductCreateModal` for pure creation unless you choose to migrate create into workflow later
- Move hydration invocation into the workflow modal entrypoint for edit mode

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/__tests__/ProductManager.variant-hydration.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ProductManager.vue src/components/__tests__/ProductManager.variant-hydration.test.js
git commit -m "feat: use workflow modal for product detail editing"
```

### Task 5: Polish copy, motion, and accessibility

**Files:**
- Modify: `src/components/product/ProductWorkflowModal.vue`
- Modify: `src/locales/zh-CN/product.js`
- Modify: `src/locales/en/product.js`
- Test: `src/components/product/__tests__/ProductWorkflowModal.test.js`

**Step 1: Write the failing test**

Add assertions for:

- loading copy
- retry copy
- `role="alert"` or equivalent live region
- reduced-motion-safe class usage if present in the component strategy

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/product/__tests__/ProductWorkflowModal.test.js`

Expected: FAIL until final UX details are wired up.

**Step 3: Write minimal implementation**

- Add localized strings for loading and retry messaging
- Ensure errors are announced accessibly
- Keep transitions short and avoid large layout shifts

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/product/__tests__/ProductWorkflowModal.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/product/ProductWorkflowModal.vue src/locales/zh-CN/product.js src/locales/en/product.js src/components/product/__tests__/ProductWorkflowModal.test.js
git commit -m "feat: polish product workflow modal feedback"
```

### Task 6: Verify the full product flow

**Files:**
- Modify: `src/components/__tests__/ProductManager.variant-hydration.test.js`
- Modify: `src/components/product/__tests__/ProductWorkflowModal.test.js`

**Step 1: Run targeted tests**

Run:

```bash
npm test -- src/components/__tests__/ProductManager.variant-hydration.test.js
npm test -- src/components/product/__tests__/ProductWorkflowModal.test.js
npm test -- src/components/product/__tests__/ProductCreateModal.variant-first.test.js
```

Expected: PASS

**Step 2: Run a broader product suite**

Run:

```bash
npm test -- src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js
npm test -- src/components/product/__tests__/product-inventory-projection-consumers.test.js
```

Expected: PASS with no detail hydration regressions.

**Step 3: Manual verification**

Verify in the browser:

- open product list
- open product detail
- click edit under slow network throttling
- confirm detail remains visible with loading feedback
- confirm failure stays in detail with retry
- confirm cancel from edit returns to detail
- confirm save closes workflow and refreshes list

**Step 4: Commit**

```bash
git add src/components/__tests__/ProductManager.variant-hydration.test.js src/components/product/__tests__/ProductWorkflowModal.test.js
git commit -m "test: verify product workflow modal end to end"
```

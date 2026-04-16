# Network-Driven Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Standardize core network-driven detail and edit transitions so detail shells open immediately and hydrate progressively across product, order, dashboard, purchase order picker, and deep-link flows.

**Architecture:** Reuse the product workflow approach as the reference pattern, then retrofit order and picker flows to open with preview data and hydrate in-place. Add targeted state and tests around detail hydration, route-driven open, and detail-to-edit continuity rather than introducing a global loading framework.

**Tech Stack:** Vue 3 Composition API, Vue Router, existing `Modal.vue`, Vitest, Vue Test Utils

---

### Task 1: Capture the order manager regression with tests

**Files:**
- Modify: `src/components/order/__tests__/OrderDetail.recovery.test.js`
- Create: `src/components/__tests__/OrderManager.network-workflow.test.js`

**Step 1: Write the failing test**

Add tests that assert:

- order detail opens immediately from list selection using preview data
- `getOrder()` runs after the shell opens
- detail-to-edit does not force a return to the list state
- route/query driven detail open keeps a visible shell while loading

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/components/__tests__/OrderManager.network-workflow.test.js src/components/order/__tests__/OrderDetail.recovery.test.js
```

Expected: FAIL because `openDetailModal()` currently waits for `getOrder()` before opening the detail shell.

**Step 3: Commit**

```bash
git add src/components/__tests__/OrderManager.network-workflow.test.js src/components/order/__tests__/OrderDetail.recovery.test.js
git commit -m "test: capture order manager network workflow behavior"
```

### Task 2: Add an order detail workflow shell

**Files:**
- Create: `src/components/order/OrderWorkflowModal.vue`
- Modify: `src/components/OrderManager.vue`
- Test: `src/components/__tests__/OrderManager.network-workflow.test.js`

**Step 1: Write the failing test**

Expand tests to cover:

- preview content visible immediately
- structured detail loading state inside the modal
- retryable detail hydration error
- edit action preserving shell context

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/components/__tests__/OrderManager.network-workflow.test.js
```

Expected: FAIL because `OrderManager.vue` still renders raw `OrderDetail` inside a generic modal.

**Step 3: Write minimal implementation**

- create `OrderWorkflowModal.vue`
- mirror the product workflow pattern:
  - preview state
  - detail hydration state
  - in-place retry
  - edit continuity
- replace direct order detail modal wiring in `OrderManager.vue`

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/components/__tests__/OrderManager.network-workflow.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/order/OrderWorkflowModal.vue src/components/OrderManager.vue src/components/__tests__/OrderManager.network-workflow.test.js
git commit -m "feat: add order workflow modal"
```

### Task 3: Unblock dashboard order detail

**Files:**
- Modify: `src/views/Dashboard.vue`
- Create: `src/views/__tests__/Dashboard.order-detail-workflow.test.js`

**Step 1: Write the failing test**

Add a test asserting:

- clicking recent order opens the detail shell immediately
- detail content hydrates progressively
- failed hydration shows retry inside the detail shell

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/views/__tests__/Dashboard.order-detail-workflow.test.js
```

Expected: FAIL because `viewOrder()` currently awaits `getOrder()` before `showDetailModal = true`.

**Step 3: Write minimal implementation**

- make dashboard order detail follow the same preview-first pattern
- reuse `OrderWorkflowModal.vue` if practical; otherwise keep logic aligned with it

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/views/__tests__/Dashboard.order-detail-workflow.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/views/Dashboard.vue src/views/__tests__/Dashboard.order-detail-workflow.test.js
git commit -m "feat: align dashboard order detail workflow"
```

### Task 4: Standardize the purchase-order order picker detail flow

**Files:**
- Modify: `src/components/purchase-order/OrderPickerModal.vue`
- Create: `src/components/purchase-order/__tests__/OrderPickerModal.detail-workflow.test.js`

**Step 1: Write the failing test**

Add tests that assert:

- picker detail opens immediately
- body uses structured loading or skeleton instead of a blank wait
- hydration failure remains inside the detail shell with retry

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/components/purchase-order/__tests__/OrderPickerModal.detail-workflow.test.js
```

Expected: FAIL because the current picker flow lacks the standardized loading and recovery pattern.

**Step 3: Write minimal implementation**

- keep immediate open behavior
- upgrade the loading UI to match the shared detail-workflow pattern
- add retryable error handling

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/components/purchase-order/__tests__/OrderPickerModal.detail-workflow.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/purchase-order/OrderPickerModal.vue src/components/purchase-order/__tests__/OrderPickerModal.detail-workflow.test.js
git commit -m "feat: standardize purchase-order detail loading"
```

### Task 5: Normalize notification and URL-driven detail entry

**Files:**
- Modify: `src/components/OrderManager.vue`
- Modify: `src/views/Dashboard.vue`
- Test: `src/components/__tests__/OrderManager.network-workflow.test.js`
- Test: `src/views/__tests__/Dashboard.order-detail-workflow.test.js`

**Step 1: Write the failing test**

Add tests for:

- `route.query.id` opens a detail shell immediately
- pending load state is visible
- retry path exists for failed load
- query cleanup happens only after dismissal or unrecoverable handling

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/components/__tests__/OrderManager.network-workflow.test.js src/views/__tests__/Dashboard.order-detail-workflow.test.js
```

Expected: FAIL because current route-driven behavior only handles success/failure after blocking fetch logic.

**Step 3: Write minimal implementation**

- create preview shell before awaiting route-driven fetch
- preserve query state until user closes or an explicit cleanup path runs
- render retry inside the shell

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/components/__tests__/OrderManager.network-workflow.test.js src/views/__tests__/Dashboard.order-detail-workflow.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/OrderManager.vue src/views/Dashboard.vue src/components/__tests__/OrderManager.network-workflow.test.js src/views/__tests__/Dashboard.order-detail-workflow.test.js
git commit -m "feat: normalize deep-link detail entry flows"
```

### Task 6: Add shared copy and accessibility support

**Files:**
- Modify: `src/locales/zh-CN/order.js`
- Modify: `src/locales/en/order.js`
- Modify: `src/components/order/OrderWorkflowModal.vue`
- Modify: `src/components/purchase-order/OrderPickerModal.vue`

**Step 1: Write the failing test**

Add assertions for:

- loading copy
- retry copy
- `role="alert"` or live region usage
- button disabled state during async transitions

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/components/__tests__/OrderManager.network-workflow.test.js src/components/purchase-order/__tests__/OrderPickerModal.detail-workflow.test.js
```

Expected: FAIL until the localized UX details and accessibility hooks are added.

**Step 3: Write minimal implementation**

- add order workflow copy in both locales
- add accessible alerts and stable focusable retry actions
- keep motion limited and reduced-motion safe

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/components/__tests__/OrderManager.network-workflow.test.js src/components/purchase-order/__tests__/OrderPickerModal.detail-workflow.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/locales/zh-CN/order.js src/locales/en/order.js src/components/order/OrderWorkflowModal.vue src/components/purchase-order/OrderPickerModal.vue
git commit -m "feat: add shared order workflow feedback copy"
```

### Task 7: Verify the unified navigation workflow

**Files:**
- Modify: `src/components/__tests__/OrderManager.network-workflow.test.js`
- Modify: `src/views/__tests__/Dashboard.order-detail-workflow.test.js`
- Modify: `src/components/purchase-order/__tests__/OrderPickerModal.detail-workflow.test.js`

**Step 1: Run targeted suite**

Run:

```bash
npx vitest run src/components/__tests__/OrderManager.network-workflow.test.js src/views/__tests__/Dashboard.order-detail-workflow.test.js src/components/purchase-order/__tests__/OrderPickerModal.detail-workflow.test.js src/components/order/__tests__/OrderDetail.recovery.test.js
```

Expected: PASS

**Step 2: Run related regression suite**

Run:

```bash
npx vitest run src/components/order/__tests__/OrderEditModal.variant-lock.test.js src/components/order/__tests__/sales-order-flow-contract.test.js
```

Expected: PASS with no edit-flow regressions.

**Step 3: Manual verification**

Verify under slow network throttling:

- order list to detail
- order detail to edit
- dashboard recent order to detail
- purchase-order picker to detail
- notification/query driven detail open
- failure + retry inside every shell

**Step 4: Commit**

```bash
git add src/components/__tests__/OrderManager.network-workflow.test.js src/views/__tests__/Dashboard.order-detail-workflow.test.js src/components/purchase-order/__tests__/OrderPickerModal.detail-workflow.test.js
git commit -m "test: verify network-driven navigation workflows"
```

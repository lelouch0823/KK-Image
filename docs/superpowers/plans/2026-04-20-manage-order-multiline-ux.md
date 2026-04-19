# Manage Order Multiline UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin multiline order creation experience around summary-driven guidance, per-line product binding, and clearer validation without breaking the existing order payload contract.

**Architecture:** Keep `OrderForm` as the orchestration container, move multiline presentation into focused order subcomponents, and centralize derived line-state logic in `useOrderForm`. Reuse existing design-system primitives and order payload normalization so the UI upgrade does not fork the backend contract.

**Tech Stack:** Vue 3 Composition API, existing design-system components, Vitest, pnpm

---

## File Structure

### New files

- `src/components/order/OrderLinesSummaryBar.vue`
  - Render admin multiline summary metrics and blocking guidance
- `src/components/order/OrderLineCard.vue`
  - Own summary header, expand/collapse, quick actions, and validation tone per line
- `src/components/order/OrderLineBindingPanel.vue`
  - Render per-line product binding UI and bind/unbind actions
- `src/components/order/__tests__/OrderLinesSummaryBar.test.js`
- `src/components/order/__tests__/OrderLineCard.test.js`
- `src/components/order/__tests__/OrderLineBindingPanel.test.js`

### Modified files

- `src/components/order/OrderForm.vue`
- `src/components/OrderCreateModal.vue`
- `src/components/order/OrderLinesEditor.vue`
- `src/components/order/OrderLineEditor.vue`
- `src/composables/useOrderForm.js`
- `src/components/order/__tests__/OrderForm.multiline.test.js`

## Task 1: Add failing composable coverage for multiline derived state

**Files:**
- Modify: `src/composables/__tests__/useOrderForm.test.js` or create a new multiline-focused test file if the current suite is too broad
- Modify: `src/composables/useOrderForm.js`

- [ ] **Step 1: Write the failing test**

Add tests that assert:

- derived total quantity rolls up from valid lines
- pending line count excludes empty placeholder rows and includes half-complete rows
- copying a line resets quantity to `1`
- expanded-line helpers can switch focus predictably

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit:run src/composables/__tests__/useOrderForm.test.js`
Expected: FAIL on missing derived state and copy helpers

- [ ] **Step 3: Write minimal implementation**

Add composable state and helpers:

- `getLineCompletionState`
- `summaryMetrics`
- `copyLine`
- `addLineAfter`
- `removeLineAt`
- `expandedLineIndex`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit:run src/composables/__tests__/useOrderForm.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/useOrderForm.js src/composables/__tests__/useOrderForm.test.js
git commit -m "test: cover multiline order form derived state"
```

## Task 2: Build multiline summary bar

**Files:**
- Create: `src/components/order/OrderLinesSummaryBar.vue`
- Create: `src/components/order/__tests__/OrderLinesSummaryBar.test.js`

- [ ] **Step 1: Write the failing test**

Add tests that assert the summary bar renders:

- line count
- total quantity
- uploaded image count
- pending line warning tone when there are incomplete rows

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit:run src/components/order/__tests__/OrderLinesSummaryBar.test.js`
Expected: FAIL because component does not exist

- [ ] **Step 3: Write minimal implementation**

Build the summary bar with existing design-system primitives and semantic tones only.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit:run src/components/order/__tests__/OrderLinesSummaryBar.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/order/OrderLinesSummaryBar.vue src/components/order/__tests__/OrderLinesSummaryBar.test.js
git commit -m "feat: add multiline order summary bar"
```

## Task 3: Replace stacked line editor with line-card workflow

**Files:**
- Create: `src/components/order/OrderLineCard.vue`
- Modify: `src/components/order/OrderLinesEditor.vue`
- Modify: `src/components/order/OrderLineEditor.vue`
- Create: `src/components/order/__tests__/OrderLineCard.test.js`

- [ ] **Step 1: Write the failing test**

Add tests for:

- summary header rendering
- expand/collapse behavior
- quick action emission
- warning state for incomplete rows

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit:run src/components/order/__tests__/OrderLineCard.test.js`
Expected: FAIL because the card workflow does not exist

- [ ] **Step 3: Write minimal implementation**

Implement `OrderLineCard` and update `OrderLinesEditor` to:

- render one expandable card per line
- keep one active expanded line
- expose `copy/add/remove/bind` events

Keep `OrderLineEditor` focused on the editable field body instead of owning the whole card shell.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit:run src/components/order/__tests__/OrderLineCard.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/order/OrderLineCard.vue src/components/order/OrderLinesEditor.vue src/components/order/OrderLineEditor.vue src/components/order/__tests__/OrderLineCard.test.js
git commit -m "feat: add multiline order line card workflow"
```

## Task 4: Introduce per-line binding panel

**Files:**
- Create: `src/components/order/OrderLineBindingPanel.vue`
- Modify: `src/components/OrderCreateModal.vue`
- Modify: `src/components/order/OrderLinesEditor.vue`
- Create: `src/components/order/__tests__/OrderLineBindingPanel.test.js`

- [ ] **Step 1: Write the failing test**

Add tests that assert:

- binding a product updates only the target line
- bound snapshot fields display in the target line
- unbinding one line does not clear sibling lines

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit:run src/components/order/__tests__/OrderLineBindingPanel.test.js`
Expected: FAIL because no line-scoped binding component exists

- [ ] **Step 3: Write minimal implementation**

Extract or recompose product binding behavior so the create modal can bind per line instead of per order.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit:run src/components/order/__tests__/OrderLineBindingPanel.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/order/OrderLineBindingPanel.vue src/components/OrderCreateModal.vue src/components/order/OrderLinesEditor.vue src/components/order/__tests__/OrderLineBindingPanel.test.js
git commit -m "feat: add per-line product binding for admin orders"
```

## Task 5: Recompose OrderForm around summary, workspace, and sticky actions

**Files:**
- Modify: `src/components/order/OrderForm.vue`
- Modify: `src/components/order/__tests__/OrderForm.multiline.test.js`

- [ ] **Step 1: Write the failing test**

Add UI-level tests that assert:

- summary bar appears in admin multiline mode
- pending lines block submit with visible inline guidance
- sticky footer actions remain available while multiline content grows

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit:run src/components/order/__tests__/OrderForm.multiline.test.js`
Expected: FAIL on missing summary/sticky action behavior

- [ ] **Step 3: Write minimal implementation**

Update `OrderForm` to:

- treat multiline as the primary admin path
- render the summary bar above lines
- move remark/deadline/actions into a fixed bottom action region
- preserve single-line compatibility for bound and non-bound flows

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit:run src/components/order/__tests__/OrderForm.multiline.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/order/OrderForm.vue src/components/order/__tests__/OrderForm.multiline.test.js
git commit -m "feat: restructure admin multiline order form"
```

## Task 6: Run focused regression validation

**Files:**
- Modify only if tests reveal regressions

- [ ] **Step 1: Run multiline-focused unit tests**

Run:

```bash
pnpm test:unit:run src/components/order/__tests__/OrderLinesSummaryBar.test.js src/components/order/__tests__/OrderLineCard.test.js src/components/order/__tests__/OrderLineBindingPanel.test.js src/components/order/__tests__/OrderForm.multiline.test.js src/composables/__tests__/useOrderForm.test.js
```

Expected: PASS

- [ ] **Step 2: Run broader order-related tests**

Run:

```bash
pnpm test:unit:run src/components/order/__tests__/OrderEditModal.multiline.test.js functions/api/utils/__tests__/order-utils.test.js functions/lib/hono/routes/manage/__tests__/order-create-route.test.js
```

Expected: PASS

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 4: Run repo test suite before handoff**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: verify admin multiline order ux upgrade"
```

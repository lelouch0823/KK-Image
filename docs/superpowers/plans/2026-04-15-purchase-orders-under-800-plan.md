# PurchaseOrders Under-800 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `src/views/PurchaseOrders.vue` from its current `3248` lines to fewer than `800` lines without regressing purchase-order list, detail, create, suggestion, and receipt workflows.

**Architecture:** Keep `src/views/PurchaseOrders.vue` as a thin route shell that wires route/query state, cross-panel coordination, and top-level composables only. Move all large template regions into dedicated `src/components/purchase-order/*` panels and drawers, and keep action orchestration in `src/composables/usePurchaseOrder*` composables plus small `src/views/purchase-orders/*` helpers.

**Tech Stack:** Vue 3 `<script setup>`, composables, AppTable/AppButton/AppSelect design-system components, Vitest, Vue Test Utils, ESLint

---

## Baseline

- Current file budget:
  - `src/views/PurchaseOrders.vue`: `3248` lines
  - `src/composables/usePurchaseOrderDetailActions.js`: `311` lines
  - `src/composables/usePurchaseOrderCreateFlow.js`: `270` lines
- Current extracted helpers:
  - `src/views/purchase-orders/formatters.js`
  - `src/views/purchase-orders/progress.js`
  - `src/views/purchase-orders/stepper.js`
  - `src/views/purchase-orders/drafts.js`
  - `src/views/purchase-orders/create-flow.js`
- Current route-shell tests:
  - `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
  - `src/views/__tests__/PurchaseOrders.decomposition.audit.test.js`
  - `src/views/__tests__/purchase-order-create-flow.test.js`

## Budget Glidepath

- Task 1 checkpoint: lock RED guards only; route shell may stay above `3000` lines
- Task 2 checkpoint: route shell drops below `2600` lines after overview/list extraction
- Task 3 checkpoint: route shell drops below `1800` lines after detail drawer extraction
- Task 4 checkpoint: route shell drops below `1300` lines after create/suggestion extraction
- Task 5 checkpoint: route shell drops below `950` lines after modal extraction
- Task 6 checkpoint: route shell drops below `800` lines and budget test turns GREEN

## File Structure Target

### Keep Thin

- Modify: `src/views/PurchaseOrders.vue`
  - Responsibility: route shell only
  - Allowed responsibilities after completion:
    - imports and top-level composable wiring
    - route/query synchronization
    - cross-drawer open/close coordination
    - passing props/events into child components
  - Hard target: `< 800` lines

### Create UI Panels

- Create: `src/components/purchase-order/PurchaseOrderOverviewBanner.vue`
  - Responsibility: console banner, stat cards, live hint strip
- Create: `src/components/purchase-order/PurchaseOrderListTable.vue`
  - Responsibility: AppTable wrapper and list cell rendering
- Create: `src/components/purchase-order/PurchaseOrderDetailDrawer.vue`
  - Responsibility: detail drawer shell and section composition
- Create: `src/components/purchase-order/PurchaseOrderDetailSummary.vue`
  - Responsibility: summary cards + header status chips
- Create: `src/components/purchase-order/PurchaseOrderDetailProgress.vue`
  - Responsibility: stepper, progress badge, progress summary
- Create: `src/components/purchase-order/PurchaseOrderDetailCost.vue`
  - Responsibility: cost overview and open-cost action
- Create: `src/components/purchase-order/PurchaseOrderItemsPanel.vue`
  - Responsibility: purchase item cards, item edit/remove affordances
- Create: `src/components/purchase-order/PurchaseOrderReceiptsPanel.vue`
  - Responsibility: receipt ledger, open-receipt/open-shortage/open-reversal affordances

### Create Drawer / Modal Components

- Create: `src/components/purchase-order/PurchaseOrderCreateDrawer.vue`
  - Responsibility: create shell, draft items list, create actions
- Create: `src/components/purchase-order/PurchaseOrderSuggestionsDrawer.vue`
  - Responsibility: suggestion list, selection summary, create-from-suggestions CTA
- Create: `src/components/purchase-order/PurchaseOrderCostModal.vue`
  - Responsibility: cost form fields and submit/cancel UI
- Create: `src/components/purchase-order/PurchaseOrderReceiptModal.vue`
  - Responsibility: receipt draft table and receipt submit UI
- Create: `src/components/purchase-order/PurchaseOrderShortageModal.vue`
  - Responsibility: shortage-closure draft table and submit UI
- Create: `src/components/purchase-order/PurchaseOrderReceiptReversalModal.vue`
  - Responsibility: reversal summary + reason input + confirm UI

### Create Additional Composables / View Helpers

- Create: `src/composables/usePurchaseOrderListPresentation.js`
  - Responsibility: overview/list-only computed values now still in `PurchaseOrders.vue`
- Create: `src/composables/usePurchaseOrderDetailPresentation.js`
  - Responsibility: detail-only computed values now still in `PurchaseOrders.vue`
- Create: `src/views/purchase-orders/summary.js`
  - Responsibility: console and detail summary pure builders if computed extraction exposes repeated mapping logic

### Expand Tests

- Modify: `src/views/__tests__/PurchaseOrders.decomposition.audit.test.js`
  - Responsibility: enforce route-shell-only imports and forbid legacy markers
- Create: `src/views/__tests__/PurchaseOrders.line-budget.test.js`
  - Responsibility: fail when `src/views/PurchaseOrders.vue` is `>= 800` lines
- Create: `src/components/purchase-order/__tests__/PurchaseOrderOverviewBanner.test.js`
- Create: `src/components/purchase-order/__tests__/PurchaseOrderListTable.test.js`
- Create: `src/components/purchase-order/__tests__/PurchaseOrderDetailDrawer.test.js`
- Create: `src/components/purchase-order/__tests__/PurchaseOrderCreateDrawer.test.js`
- Create: `src/components/purchase-order/__tests__/PurchaseOrderSuggestionsDrawer.test.js`

## Task 1: Freeze the Budget and Decomposition Boundaries

**Files:**
- Modify: `src/views/__tests__/PurchaseOrders.decomposition.audit.test.js`
- Create: `src/views/__tests__/PurchaseOrders.line-budget.test.js`

- [ ] **Step 1: Add failing route-shell audit assertions for the next split**

Required assertions:

- `src/views/PurchaseOrders.vue` imports the new `PurchaseOrder*` panel components
- `src/views/PurchaseOrders.vue` imports `usePurchaseOrderListPresentation.js` and `usePurchaseOrderDetailPresentation.js`
- `src/views/PurchaseOrders.vue` no longer contains large region markers for list/detail/create/suggestion shells

- [ ] **Step 2: Add a failing line-budget test**

Test shape:

```js
it('keeps PurchaseOrders route shell under 800 lines', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');
  expect(source.split('\n').length).toBeLessThan(800);
});
```

- [ ] **Step 3: Run the two tests and verify RED**

Run:

```bash
pnpm exec vitest run src/views/__tests__/PurchaseOrders.decomposition.audit.test.js src/views/__tests__/PurchaseOrders.line-budget.test.js
```

Expected:

- decomposition audit FAIL
- line-budget test FAIL because current line count is above `800`

- [ ] **Step 4: Commit the red boundary tests**

```bash
git add src/views/__tests__/PurchaseOrders.decomposition.audit.test.js src/views/__tests__/PurchaseOrders.line-budget.test.js
git commit -m "test: lock purchase orders route-shell budget"
```

## Task 2: Extract Overview Banner and List Table

**Files:**
- Create: `src/components/purchase-order/PurchaseOrderOverviewBanner.vue`
- Create: `src/components/purchase-order/PurchaseOrderListTable.vue`
- Create: `src/composables/usePurchaseOrderListPresentation.js`
- Modify: `src/views/PurchaseOrders.vue`
- Test: `src/components/purchase-order/__tests__/PurchaseOrderOverviewBanner.test.js`
- Test: `src/components/purchase-order/__tests__/PurchaseOrderListTable.test.js`
- Test: `src/views/__tests__/PurchaseOrders.detail-shell.test.js`

- [ ] **Step 1: Write failing component tests for overview and list rendering**

Cover:

- stat cards render from passed-in `stats`
- list status cell still shows primary status plus receipt progress summary
- row click still emits/open-detail action

- [ ] **Step 2: Run the new component tests and verify RED**

Run:

```bash
pnpm exec vitest run src/components/purchase-order/__tests__/PurchaseOrderOverviewBanner.test.js src/components/purchase-order/__tests__/PurchaseOrderListTable.test.js
```

- [ ] **Step 3: Extract overview/list-only computed mapping**

Move from `src/views/PurchaseOrders.vue` into `src/composables/usePurchaseOrderListPresentation.js`:

- `statCards`
- `columns`
- `consoleSignals`
- any list-only formatters that remain inline

- [ ] **Step 4: Create the two presentation components and wire the route shell**

Required outcome:

- `src/views/PurchaseOrders.vue` delegates console banner and AppTable regions entirely
- route shell only passes props/events like `@row-click`, `@toggle-status-filter`

- [ ] **Step 5: Re-run focused tests and existing list/detail shell regression**

Run:

```bash
pnpm exec vitest run src/components/purchase-order/__tests__/PurchaseOrderOverviewBanner.test.js src/components/purchase-order/__tests__/PurchaseOrderListTable.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

- [ ] **Step 6: Commit**

```bash
git add src/components/purchase-order/PurchaseOrderOverviewBanner.vue src/components/purchase-order/PurchaseOrderListTable.vue src/components/purchase-order/__tests__/PurchaseOrderOverviewBanner.test.js src/components/purchase-order/__tests__/PurchaseOrderListTable.test.js src/composables/usePurchaseOrderListPresentation.js src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.detail-shell.test.js
git commit -m "refactor: extract purchase order overview and list table"
```

- [ ] **Step 7: Confirm interim line-budget checkpoint**

Run:

```bash
wc -l src/views/PurchaseOrders.vue
```

Expected:

- `src/views/PurchaseOrders.vue` line count `< 2600`

## Task 3: Extract Detail Drawer Shell and Read-Only Panels

**Files:**
- Create: `src/components/purchase-order/PurchaseOrderDetailDrawer.vue`
- Create: `src/components/purchase-order/PurchaseOrderDetailSummary.vue`
- Create: `src/components/purchase-order/PurchaseOrderDetailProgress.vue`
- Create: `src/components/purchase-order/PurchaseOrderDetailCost.vue`
- Create: `src/components/purchase-order/PurchaseOrderItemsPanel.vue`
- Create: `src/components/purchase-order/PurchaseOrderReceiptsPanel.vue`
- Create: `src/composables/usePurchaseOrderDetailPresentation.js`
- Modify: `src/views/PurchaseOrders.vue`
- Test: `src/components/purchase-order/__tests__/PurchaseOrderDetailDrawer.test.js`
- Test: `src/views/__tests__/PurchaseOrders.detail-shell.test.js`

- [ ] **Step 1: Add failing tests for detail panel boundaries**

Cover:

- summary/progress/cost/items/receipts regions remain visible
- receipt ledger and reversal affordance still render from payload
- item progress and variant options still render from payload

- [ ] **Step 2: Run the detail tests and verify RED**

Run:

```bash
pnpm exec vitest run src/components/purchase-order/__tests__/PurchaseOrderDetailDrawer.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

- [ ] **Step 3: Move detail-only computed state into `usePurchaseOrderDetailPresentation.js`**

Move:

- `detailSummaryCards`
- `receiptTimeline`
- `receiptCandidates`
- `shortageCandidates`
- `receiptDraftSelectedCount`
- `receiptDraftSelectedQty`
- `receiptSubmitDisabled`
- `shortageDraftSelectedCount`
- `shortageDraftSelectedQty`
- `shortageSubmitDisabled`
- `progressStatusConfig` and its lookups

- [ ] **Step 4: Extract the read-only/detail components**

Required outcome:

- `PurchaseOrders.vue` no longer contains large markup for summary/progress/cost/items/receipts
- detail shell is composed through one `PurchaseOrderDetailDrawer.vue`

- [ ] **Step 5: Re-run detail-focused tests**

Run:

```bash
pnpm exec vitest run src/components/purchase-order/__tests__/PurchaseOrderDetailDrawer.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

- [ ] **Step 6: Commit**

```bash
git add src/components/purchase-order/PurchaseOrderDetailDrawer.vue src/components/purchase-order/PurchaseOrderDetailSummary.vue src/components/purchase-order/PurchaseOrderDetailProgress.vue src/components/purchase-order/PurchaseOrderDetailCost.vue src/components/purchase-order/PurchaseOrderItemsPanel.vue src/components/purchase-order/PurchaseOrderReceiptsPanel.vue src/components/purchase-order/__tests__/PurchaseOrderDetailDrawer.test.js src/composables/usePurchaseOrderDetailPresentation.js src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.detail-shell.test.js
git commit -m "refactor: extract purchase order detail panels"
```

- [ ] **Step 7: Confirm interim line-budget checkpoint**

Run:

```bash
wc -l src/views/PurchaseOrders.vue
```

Expected:

- `src/views/PurchaseOrders.vue` line count `< 1800`

## Task 4: Extract Create Drawer and Suggestion Drawer UI

**Files:**
- Create: `src/components/purchase-order/PurchaseOrderCreateDrawer.vue`
- Create: `src/components/purchase-order/PurchaseOrderSuggestionsDrawer.vue`
- Modify: `src/views/PurchaseOrders.vue`
- Modify: `src/composables/usePurchaseOrderCreateFlow.js`
- Test: `src/components/purchase-order/__tests__/PurchaseOrderCreateDrawer.test.js`
- Test: `src/components/purchase-order/__tests__/PurchaseOrderSuggestionsDrawer.test.js`
- Test: `src/views/__tests__/purchase-order-create-flow.test.js`

- [ ] **Step 1: Write failing UI tests for create/suggestion drawers**

Cover:

- create drawer renders draft item list, totals, CTA, and shortage confirm path
- suggestions drawer renders candidate cards, selected summary, and disabled CTA when no bindable orders

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```bash
pnpm exec vitest run src/components/purchase-order/__tests__/PurchaseOrderCreateDrawer.test.js src/components/purchase-order/__tests__/PurchaseOrderSuggestionsDrawer.test.js src/views/__tests__/purchase-order-create-flow.test.js
```

- [ ] **Step 3: Extract both drawer templates into dedicated components**

Required outcome:

- `PurchaseOrders.vue` no longer contains large create/suggestion drawer markup
- `usePurchaseOrderCreateFlow.js` remains the only owner of create/suggestion actions

- [ ] **Step 4: Re-run focused tests**

Run:

```bash
pnpm exec vitest run src/components/purchase-order/__tests__/PurchaseOrderCreateDrawer.test.js src/components/purchase-order/__tests__/PurchaseOrderSuggestionsDrawer.test.js src/views/__tests__/purchase-order-create-flow.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/components/purchase-order/PurchaseOrderCreateDrawer.vue src/components/purchase-order/PurchaseOrderSuggestionsDrawer.vue src/components/purchase-order/__tests__/PurchaseOrderCreateDrawer.test.js src/components/purchase-order/__tests__/PurchaseOrderSuggestionsDrawer.test.js src/composables/usePurchaseOrderCreateFlow.js src/views/PurchaseOrders.vue src/views/__tests__/purchase-order-create-flow.test.js
git commit -m "refactor: extract purchase order create and suggestion drawers"
```

- [ ] **Step 6: Confirm interim line-budget checkpoint**

Run:

```bash
wc -l src/views/PurchaseOrders.vue
```

Expected:

- `src/views/PurchaseOrders.vue` line count `< 1300`

## Task 5: Extract Cost / Receipt / Shortage / Reversal Modal UI

**Files:**
- Create: `src/components/purchase-order/PurchaseOrderCostModal.vue`
- Create: `src/components/purchase-order/PurchaseOrderReceiptModal.vue`
- Create: `src/components/purchase-order/PurchaseOrderShortageModal.vue`
- Create: `src/components/purchase-order/PurchaseOrderReceiptReversalModal.vue`
- Modify: `src/views/PurchaseOrders.vue`
- Modify: `src/composables/usePurchaseOrderDetailActions.js`
- Test: `src/composables/__tests__/usePurchaseOrderDetailActions.test.js`
- Test: `src/views/__tests__/PurchaseOrders.detail-shell.test.js`

- [ ] **Step 1: Extend existing detail-action tests to cover modal prop contracts**

Cover:

- cost modal draft hydration
- receipt modal seed rows
- shortage modal seed rows
- reversal modal summary state

- [ ] **Step 2: Run the tests and verify RED where needed**

Run:

```bash
pnpm exec vitest run src/composables/__tests__/usePurchaseOrderDetailActions.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

- [ ] **Step 3: Extract the four modal templates**

Required outcome:

- `PurchaseOrders.vue` no longer contains any modal form bodies
- route shell only toggles `v-if` and passes props/events

- [ ] **Step 4: Re-run focused tests**

Run:

```bash
pnpm exec vitest run src/composables/__tests__/usePurchaseOrderDetailActions.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/components/purchase-order/PurchaseOrderCostModal.vue src/components/purchase-order/PurchaseOrderReceiptModal.vue src/components/purchase-order/PurchaseOrderShortageModal.vue src/components/purchase-order/PurchaseOrderReceiptReversalModal.vue src/composables/usePurchaseOrderDetailActions.js src/composables/__tests__/usePurchaseOrderDetailActions.test.js src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.detail-shell.test.js
git commit -m "refactor: extract purchase order action modals"
```

- [ ] **Step 6: Confirm interim line-budget checkpoint**

Run:

```bash
wc -l src/views/PurchaseOrders.vue
```

Expected:

- `src/views/PurchaseOrders.vue` line count `< 950`

## Task 6: Trim Route Shell to Final Budget and Lock It

**Files:**
- Modify: `src/views/PurchaseOrders.vue`
- Modify: `src/views/__tests__/PurchaseOrders.decomposition.audit.test.js`
- Modify: `src/views/__tests__/PurchaseOrders.line-budget.test.js`

- [ ] **Step 1: Remove any residual inline section templates or duplicated computed mapping**

Required outcomes:

- route shell keeps only:
  - imports
  - high-level composable wiring
  - route/query watchers
  - `openDetail`, `changePage`, `toggleStatusFilter`, `retryDetail`, `handleStatusUpdate`, `handleDetailUpdateItem`, `handleDetailRemoveItem`

- [ ] **Step 2: Verify final line budget**

Run:

```bash
wc -l src/views/PurchaseOrders.vue
pnpm exec vitest run src/views/__tests__/PurchaseOrders.decomposition.audit.test.js src/views/__tests__/PurchaseOrders.line-budget.test.js
```

Expected:

- `src/views/PurchaseOrders.vue` line count `< 800`
- both tests PASS

- [ ] **Step 3: Run final route-shell regression and touched lint**

Run:

```bash
pnpm exec vitest run src/views/__tests__/PurchaseOrders.detail-shell.test.js src/views/__tests__/purchase-order-create-flow.test.js src/views/__tests__/PurchaseOrders.decomposition.audit.test.js src/views/__tests__/PurchaseOrders.line-budget.test.js src/composables/__tests__/usePurchaseOrderDetailActions.test.js src/composables/__tests__/usePurchaseOrderCreateFlow.test.js
pnpm exec eslint src/views/PurchaseOrders.vue src/components/purchase-order src/composables/usePurchaseOrderDetailActions.js src/composables/usePurchaseOrderCreateFlow.js
```

- [ ] **Step 4: Commit**

```bash
git add src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.decomposition.audit.test.js src/views/__tests__/PurchaseOrders.line-budget.test.js src/components/purchase-order src/composables/usePurchaseOrderDetailActions.js src/composables/usePurchaseOrderCreateFlow.js
git commit -m "refactor: bring purchase orders route shell under budget"
```

## Verification Checklist

- `src/views/PurchaseOrders.vue` line count is `< 800`
- detail shell regression still passes
- create/suggestion flow regression still passes
- route shell decomposition audit passes
- new panel/drawer component tests pass
- touched-file ESLint passes
- no business logic moves back into the route shell

## Execution Notes

- Prefer extracting complete template islands instead of half-splitting markup and logic.
- Do not move route/query watchers out of `src/views/PurchaseOrders.vue`; they are route-shell responsibility.
- Keep action ownership in composables, not in child components.
- If a component needs more than 6-8 props, pass a shaped view-model object instead of exploding prop count.

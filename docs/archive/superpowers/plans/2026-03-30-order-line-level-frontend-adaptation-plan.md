# Order Line-Level Frontend Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the order frontend to the current line-level read model so list, detail, edit, and duplicate flows all reflect the backend contract consistently.

**Architecture:** Introduce a small order-display compatibility layer in the frontend, then switch list/detail consumers to resolved progress status and quantity sources. Keep legacy fallbacks in place for older orders, and align the manage-order filter contract with the visible progress states if the backend list route still filters on legacy procurement status.

**Tech Stack:** Vue 3, Vitest, existing order components/composables, Hono order list route, order repository query helpers

---

### Task 1: Add failing regression tests for line-level status and quantity sources

**Files:**

- Modify: `src/components/order/__tests__/OrderProcurementBadge.test.js`
- Modify: `src/components/order/__tests__/OrderEditModal.variant-lock.test.js`
- Create: `src/components/order/__tests__/OrderDetail.lines.test.js`
- Create: `src/views/__tests__/SalesDetailView.duplicate.test.js`

- [ ] **Step 1: Write the failing tests**

```js
it('renders line-level display statuses such as partially_received', () => {});
it('renders order lines in detail when lines are present', () => {});
it('initializes edit quantity from top-level order.quantity', () => {});
it('duplicates sales order using top-level order.quantity', () => {});
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `pnpm test:unit src/components/order/__tests__/OrderProcurementBadge.test.js src/components/order/__tests__/OrderDetail.lines.test.js src/components/order/__tests__/OrderEditModal.variant-lock.test.js src/views/__tests__/SalesDetailView.duplicate.test.js`
Expected: FAIL because the current UI still reads legacy status and quantity sources

### Task 2: Implement shared order display fallback helpers and status rendering

**Files:**

- Modify: `src/utils/procurement-status.js`
- Create: `src/utils/order-display.js`
- Modify: `src/locales/zh-CN/order.js`
- Modify: `src/locales/en/order.js`
- Modify: `src/components/OrderManager.vue`
- Modify: `src/components/order/OrderList.vue`
- Modify: `src/components/order/OrderStatusHeader.vue`

- [ ] **Step 1: Add the minimal helpers and extended status vocabulary**

```js
export const resolveOrderProgressStatus = (order = {}) =>
  order.displayStatus || order.procurementStatus || 'none';
```

```js
export const resolveOrderQuantity = (order = {}) =>
  Number(order.quantity ?? order.currentData?.quantity ?? 1) || 1;
```

- [ ] **Step 2: Re-run the focused badge tests**

Run: `pnpm test:unit src/components/order/__tests__/OrderProcurementBadge.test.js`
Expected: PASS

### Task 3: Implement detail page line-level display and quantity correction

**Files:**

- Create: `src/components/order/OrderLinesCard.vue`
- Modify: `src/components/order/OrderDetail.vue`
- Modify: `src/components/order/OrderPrintView.vue`
- Modify: `src/components/OrderEditModal.vue`
- Modify: `src/views/sales/SalesDetailView.vue`

- [ ] **Step 1: Add the minimal line-level detail card**

```vue
<OrderLinesCard v-if="orderLines.length" :lines="orderLines" />
```

- [ ] **Step 2: Switch detail, edit, print, and duplicate flows to resolved helpers**

Run: `pnpm test:unit src/components/order/__tests__/OrderDetail.lines.test.js src/components/order/__tests__/OrderEditModal.variant-lock.test.js src/views/__tests__/SalesDetailView.duplicate.test.js`
Expected: PASS

### Task 4: Align manage-order progress filters with visible list statuses

**Files:**

- Modify: `functions/api/utils/constants.js`
- Modify: `functions/repositories/order/queries.js`
- Modify: `functions/lib/hono/routes/manage/orders/list.js`
- Modify: `src/components/order/OrderFilters.vue`
- Create: `functions/repositories/__tests__/order-queries.progress-filter.test.js`

- [ ] **Step 1: Write the failing backend/frontend filter tests**

```js
it('filters admin orders by aggregated display_status values', async () => {});
```

- [ ] **Step 2: Update the list filter contract to operate on visible progress states**

Run: `pnpm test:unit functions/repositories/__tests__/order-queries.progress-filter.test.js`
Expected: PASS

### Task 5: Run regression verification and build

**Files:**

- Verify: `src/components/order/__tests__/OrderProcurementBadge.test.js`
- Verify: `src/components/order/__tests__/OrderDetail.lines.test.js`
- Verify: `src/components/order/__tests__/OrderEditModal.variant-lock.test.js`
- Verify: `src/views/__tests__/SalesDetailView.duplicate.test.js`
- Verify: `src/components/__tests__/OrderManager.network-workflow.test.js`
- Verify: `pnpm build`

- [ ] **Step 1: Run the frontend regression gate**

Run: `pnpm test:unit src/components/order/__tests__/OrderProcurementBadge.test.js src/components/order/__tests__/OrderDetail.lines.test.js src/components/order/__tests__/OrderEditModal.variant-lock.test.js src/views/__tests__/SalesDetailView.duplicate.test.js src/components/__tests__/OrderManager.network-workflow.test.js`
Expected: PASS

- [ ] **Step 2: Run build verification**

Run: `pnpm build`
Expected: PASS

# Order Line Fulfillment Unship Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add confirmed `reserve / release / ship / unship` line actions, make `unship` a real inventory reversal, and align order status transitions so only line commands mutate stock.

**Architecture:** Extend the existing line-command service/route/composable pattern with a symmetric `unship` path, then remove header-level inventory mutation from `delivered` and add status guardrails for `delivered` and `void`. Reuse the existing `ConfirmDialog` in the admin order workflow so all four fulfillment actions require explicit confirmation before execution.

**Tech Stack:** Vue 3, Vitest, Hono, Cloudflare D1, existing repository/service pattern

---

### Task 1: Add Backend `unship` Command

**Files:**

- Modify: `functions/services/OrderLineFulfillmentService.js`
- Modify: `functions/lib/hono/routes/manage/orders/lines.js`
- Modify: `functions/services/__tests__/OrderLineFulfillmentService.test.js`
- Modify: `functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js`

- [ ] **Step 1: Write the failing service test**

Add a test covering successful partial `unship` with:

- existing `shipped_qty > 0`
- positive inventory restoration
- recomputed line projection

- [ ] **Step 2: Run the targeted service test to verify it fails**

Run: `pnpm vitest functions/services/__tests__/OrderLineFulfillmentService.test.js`
Expected: FAIL because `unshipLine` does not exist yet

- [ ] **Step 3: Write the minimal backend implementation**

Implement:

- `OrderLineFulfillmentService.unshipLine()`
- route wiring for `POST /:id/lines/:lineId/unship`
- audit declaration and outbox scheduling parity with existing line commands

- [ ] **Step 4: Write the failing route test**

Add route coverage showing `/unship` calls the service and validates quantity payloads.

- [ ] **Step 5: Run the targeted backend tests to verify they pass**

Run:

- `pnpm vitest functions/services/__tests__/OrderLineFulfillmentService.test.js`
- `pnpm vitest functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js`

- [ ] **Step 6: Commit**

```bash
git add functions/services/OrderLineFulfillmentService.js functions/lib/hono/routes/manage/orders/lines.js functions/services/__tests__/OrderLineFulfillmentService.test.js functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js
git commit -m "feat: add order line unship command"
```

### Task 2: Align Header Status Guards With Line Facts

**Files:**

- Modify: `functions/repositories/order/mutations.js`
- Modify: `functions/lib/hono/routes/manage/orders/detail.js`
- Modify: `functions/repositories/__tests__/order-inventory-flow.test.js`
- Modify: `functions/lib/hono/routes/manage/orders/__tests__/order-detail-routes.test.js`

- [ ] **Step 1: Write the failing status-guard tests**

Add tests for:

- `delivered` rejects when line quantities are not fully shipped
- `delivered` no longer emits inventory stock mutations
- `void` rejects when any line has shipped quantity

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run:

- `pnpm vitest functions/repositories/__tests__/order-inventory-flow.test.js`
- `pnpm vitest functions/lib/hono/routes/manage/orders/__tests__/order-detail-routes.test.js`

- [ ] **Step 3: Write the minimal status-guard implementation**

Implement:

- helper queries/validation for shipped-line guards
- removal of `delivered` inventory mutation side effects
- `void` shipped-line rejection
- `delivered` completeness check against effective line quantity

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run:

- `pnpm vitest functions/repositories/__tests__/order-inventory-flow.test.js`
- `pnpm vitest functions/lib/hono/routes/manage/orders/__tests__/order-detail-routes.test.js`

- [ ] **Step 5: Commit**

```bash
git add functions/repositories/order/mutations.js functions/lib/hono/routes/manage/orders/detail.js functions/repositories/__tests__/order-inventory-flow.test.js functions/lib/hono/routes/manage/orders/__tests__/order-detail-routes.test.js
git commit -m "fix: align order status transitions with line fulfillment"
```

### Task 3: Add Confirmed Frontend Line Actions

**Files:**

- Modify: `src/components/order/OrderLineCommandPanel.vue`
- Modify: `src/components/order/OrderWorkflowModal.vue`
- Modify: `src/components/OrderManager.vue`
- Modify: `src/composables/useOrders.js`
- Modify: `src/components/order/__tests__/OrderLineCommandPanel.test.js`
- Modify: `src/components/__tests__/OrderManager.network-workflow.test.js`
- Modify: `src/composables/__tests__/useOrders.line-commands.test.js`
- Modify: `src/locales/en/order.js`
- Modify: `src/locales/zh-CN/order.js`

- [ ] **Step 1: Write the failing frontend tests**

Add tests for:

- confirmation dialog opens before command execution
- confirm dispatches the matching action
- cancel prevents execution
- `unship` button availability and disabled states
- composable support for `/unship`

- [ ] **Step 2: Run the targeted frontend tests to verify they fail**

Run:

- `pnpm vitest src/components/order/__tests__/OrderLineCommandPanel.test.js`
- `pnpm vitest src/components/__tests__/OrderManager.network-workflow.test.js`
- `pnpm vitest src/composables/__tests__/useOrders.line-commands.test.js`

- [ ] **Step 3: Write the minimal frontend implementation**

Implement:

- `unship` button and limits in the command panel
- `ConfirmDialog` state in the workflow/manager path
- confirmed execution flow for all four actions
- `useOrders.unshipOrderLine()`
- localized dialog/action copy

- [ ] **Step 4: Run the targeted frontend tests to verify they pass**

Run:

- `pnpm vitest src/components/order/__tests__/OrderLineCommandPanel.test.js`
- `pnpm vitest src/components/__tests__/OrderManager.network-workflow.test.js`
- `pnpm vitest src/composables/__tests__/useOrders.line-commands.test.js`

- [ ] **Step 5: Commit**

```bash
git add src/components/order/OrderLineCommandPanel.vue src/components/order/OrderWorkflowModal.vue src/components/OrderManager.vue src/composables/useOrders.js src/components/order/__tests__/OrderLineCommandPanel.test.js src/components/__tests__/OrderManager.network-workflow.test.js src/composables/__tests__/useOrders.line-commands.test.js src/locales/en/order.js src/locales/zh-CN/order.js
git commit -m "feat: confirm order line fulfillment actions"
```

### Task 4: Add End-to-End Regression Coverage And Verify

**Files:**

- Modify: `test/order-line-fulfillment-real-api.test.js`
- Modify: `test/full-business-regression-real-api.test.js`

- [ ] **Step 1: Write the failing regression tests**

Add coverage for:

- `ship -> unship` restores line state and stock
- partial `ship -> delivered` is rejected
- shipped order `-> void` is rejected until reversal

- [ ] **Step 2: Run the targeted regression tests to verify they fail**

Run:

- `pnpm vitest test/order-line-fulfillment-real-api.test.js`

- [ ] **Step 3: Adjust implementation only if needed to satisfy regressions**

Keep changes minimal and local to already-touched modules.

- [ ] **Step 4: Run verification**

Run:

- `pnpm vitest functions/services/__tests__/OrderLineFulfillmentService.test.js`
- `pnpm vitest functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js`
- `pnpm vitest functions/repositories/__tests__/order-inventory-flow.test.js`
- `pnpm vitest functions/lib/hono/routes/manage/orders/__tests__/order-detail-routes.test.js`
- `pnpm vitest src/components/order/__tests__/OrderLineCommandPanel.test.js`
- `pnpm vitest src/components/__tests__/OrderManager.network-workflow.test.js`
- `pnpm vitest src/composables/__tests__/useOrders.line-commands.test.js`
- `pnpm vitest test/order-line-fulfillment-real-api.test.js`

- [ ] **Step 5: Commit**

```bash
git add test/order-line-fulfillment-real-api.test.js test/full-business-regression-real-api.test.js
git commit -m "test: cover order line shipment reversal workflows"
```

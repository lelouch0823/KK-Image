# Order Fulfillment Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four concrete review findings in the order fulfillment module so business rules, exports, and notifications match the intended workflow.

**Architecture:** Keep the existing fulfillment design intact and repair only the broken seams: use delivery status as the authoritative guard for `unship`, centralize CSV safety with the existing neutralization pattern, make export requests inherit active list filters, and collapse one-step return notifications to one outward-facing signal while preserving internal event readiness. Each fix is test-first and scoped to the current module boundaries.

**Tech Stack:** Cloudflare Workers, Hono, D1, Vue 3, Vitest.

---

## File Map

- Modify: `functions/services/OrderLineFulfillmentService.js`
- Modify: `functions/services/__tests__/OrderLineFulfillmentService.test.js`
- Modify: `src/components/order/OrderLineCommandPanel.vue`
- Modify: `src/components/order/__tests__/OrderLineCommandPanel.test.js`
- Modify: `functions/lib/hono/routes/manage/orders/list.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/order-list-routes.test.js`
- Modify: `src/composables/order/useOrderFilters.js`
- Modify: `src/composables/order/__tests__/useOrderFilters.test.js`
- Modify: `functions/lib/hono/routes/manage/orders/lines.js`
- Modify: `functions/services/DomainOutboxConsumers.js`
- Modify: `functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js`
- Modify: `functions/services/__tests__/DomainOutboxConsumers.notifications.test.js`
- Modify: `test/notifications-real-api.test.js`

### Task 1: Restore Pre-Delivery Unship

**Files:**
- Modify: `functions/services/__tests__/OrderLineFulfillmentService.test.js`
- Modify: `src/components/order/__tests__/OrderLineCommandPanel.test.js`
- Modify: `functions/services/OrderLineFulfillmentService.js`
- Modify: `src/components/order/OrderLineCommandPanel.vue`

- [ ] **Step 1: Write the failing service test**

```js
it('allows unship on fulfilled orders that are still in transit', async () => {
  // fulfilled + delivery_status=in_transit should succeed
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest --maxWorkers 1 functions/services/__tests__/OrderLineFulfillmentService.test.js -t "in transit"`
Expected: FAIL because `assertUnshipAllowed` still rejects `fulfilled`.

- [ ] **Step 3: Write the failing component test**

```js
it('keeps unship available for fulfilled orders before delivery confirmation', async () => {
  // fulfilled + in_transit should not disable the unship button
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest --maxWorkers 1 src/components/order/__tests__/OrderLineCommandPanel.test.js -t "before delivery confirmation"`
Expected: FAIL because UI still disables unship on `fulfilled`.

- [ ] **Step 5: Write minimal implementation**

```js
// Service: block unship only when delivery_status is delivered / partially_returned / returned
// UI: compute unship disabled from deliveryStatus, not orderStatus === fulfilled
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest --maxWorkers 1 functions/services/__tests__/OrderLineFulfillmentService.test.js src/components/order/__tests__/OrderLineCommandPanel.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add functions/services/OrderLineFulfillmentService.js \
  functions/services/__tests__/OrderLineFulfillmentService.test.js \
  src/components/order/OrderLineCommandPanel.vue \
  src/components/order/__tests__/OrderLineCommandPanel.test.js
git commit -m "fix: allow unship before delivery confirmation"
```

### Task 2: Harden Order CSV Export And Preserve Date Filters

**Files:**
- Modify: `functions/lib/hono/routes/manage/__tests__/order-list-routes.test.js`
- Modify: `src/composables/order/__tests__/useOrderFilters.test.js`
- Modify: `functions/lib/hono/routes/manage/orders/list.js`
- Modify: `src/composables/order/useOrderFilters.js`

- [ ] **Step 1: Write the failing export security test**

```js
it('neutralizes spreadsheet formula prefixes in order csv exports', async () => {
  // =SUM(...) should become '=SUM(...)
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest --maxWorkers 1 functions/lib/hono/routes/manage/__tests__/order-list-routes.test.js -t "formula prefixes"`
Expected: FAIL because order export currently only escapes quotes.

- [ ] **Step 3: Write the failing export date-filter test**

```js
it('forwards active date range filters when exporting orders', async () => {
  // export URL should include from/to derived from filterDateRange
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest --maxWorkers 1 src/composables/order/__tests__/useOrderFilters.test.js -t "date range"`
Expected: FAIL because export omits date filters.

- [ ] **Step 5: Write minimal implementation**

```js
// Route: reuse a neutralizeSpreadsheetFormula helper before CSV escaping
// Frontend: map filterDateRange to from/to query params during export
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest --maxWorkers 1 functions/lib/hono/routes/manage/__tests__/order-list-routes.test.js src/composables/order/__tests__/useOrderFilters.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add functions/lib/hono/routes/manage/orders/list.js \
  functions/lib/hono/routes/manage/__tests__/order-list-routes.test.js \
  src/composables/order/useOrderFilters.js \
  src/composables/order/__tests__/useOrderFilters.test.js
git commit -m "fix: align order export safety and filters"
```

### Task 3: Deduplicate One-Step Return Notifications

**Files:**
- Modify: `functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js`
- Modify: `functions/services/__tests__/DomainOutboxConsumers.notifications.test.js`
- Modify: `functions/lib/hono/routes/manage/orders/lines.js`
- Modify: `functions/services/DomainOutboxConsumers.js`
- Modify: `test/notifications-real-api.test.js`

- [ ] **Step 1: Write the failing consumer test**

```js
it('creates only one sales notification for a one-step return workflow', async () => {
  // order_return_created + order_return_restocked should not double-notify sales
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest --maxWorkers 1 functions/services/__tests__/DomainOutboxConsumers.notifications.test.js -t "one-step return"`
Expected: FAIL because both events currently notify sales.

- [ ] **Step 3: Write the failing route/event-shape assertion if needed**

```js
it('keeps domain events intact while deduplicating outward notifications', async () => {
  // route may still publish both events; consumer behavior must be the dedupe point
});
```

- [ ] **Step 4: Run test to verify it fails if necessary**

Run: `pnpm vitest --maxWorkers 1 functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js -t "domain events intact"`
Expected: PASS or targeted FAIL depending on the chosen assertion.

- [ ] **Step 5: Write minimal implementation**

```js
// Keep both domain events for lifecycle readiness
// Notification consumer only notifies sales for order_return_created
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest --maxWorkers 1 functions/services/__tests__/DomainOutboxConsumers.notifications.test.js functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js`
Expected: PASS.

- [ ] **Step 7: Run real API verification**

Run: `RUN_REAL_API_TESTS=1 BASE_URL=http://127.0.0.1:8080 pnpm vitest --maxWorkers 1 test/notifications-real-api.test.js -t "delivery confirmation and returned stock events|sales notifications for admin-side order lifecycle events"`
Expected: PASS with one sales-visible return notification.

- [ ] **Step 8: Commit**

```bash
git add functions/lib/hono/routes/manage/orders/lines.js \
  functions/services/DomainOutboxConsumers.js \
  functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js \
  functions/services/__tests__/DomainOutboxConsumers.notifications.test.js \
  test/notifications-real-api.test.js
git commit -m "fix: dedupe return notifications"
```

### Task 4: Full Regression For Fulfillment Module

**Files:**
- Test-only verification across existing module coverage

- [ ] **Step 1: Run focused module regression**

Run: `pnpm vitest --maxWorkers 1 functions/services/__tests__/OrderLineFulfillmentService.test.js functions/services/__tests__/OrderDeliveryService.test.js functions/services/__tests__/DomainOutboxConsumers.notifications.test.js functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js functions/lib/hono/routes/manage/orders/__tests__/detail-delivery-confirmation.test.js functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-list-routes.test.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js src/components/order/__tests__/OrderStatusHeader.test.js src/components/order/__tests__/OrderDetail.lines.test.js src/components/order/__tests__/OrderLineCommandPanel.test.js src/components/order/__tests__/OrderDashboard.test.js src/composables/order/__tests__/useOrderFilters.test.js`
Expected: PASS.

- [ ] **Step 2: Run real API workflow regression**

Run: `RUN_REAL_API_TESTS=1 BASE_URL=http://127.0.0.1:8080 pnpm vitest --maxWorkers 1 test/order-line-fulfillment-real-api.test.js -t "unship|return|delivery"`
Expected: PASS.

- [ ] **Step 3: Commit final repair batch if needed**

```bash
git add -A
git commit -m "test: verify fulfillment review fixes"
```

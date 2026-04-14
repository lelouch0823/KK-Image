# Order Fulfillment Status Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate approval/order lifecycle from fulfillment and delivery lifecycle so the system can model shipped completion, delivered confirmation, and returns without overloading a single `delivered` order status.

**Architecture:** Keep the current order header status focused on business progression and exceptions, introduce explicit fulfillment and delivery aggregates derived from line and shipment facts, and add a formal return flow instead of abusing `unship` after customer receipt. Migrate incrementally with compatibility layers so existing list/detail pages, tests, and API consumers continue working during the transition.

**Tech Stack:** Cloudflare Workers + D1, Vue 3, Vitest, existing order/inventory services and Hono management APIs.

---

## File Map

**Backend domain and persistence**
- Modify: `functions/api/utils/order-state-machine.js`
- Modify: `functions/repositories/order/mutations.js`
- Modify: `functions/repositories/order/queries.js`
- Modify: `functions/repositories/order/sql.js`
- Modify: `functions/repositories/order/helpers.js`
- Modify: `functions/services/OrderLineFulfillmentService.js`
- Modify: `functions/services/InventoryService.js`
- Modify: `functions/services/InventoryProjectionService.js`
- Modify: `functions/lib/hono/routes/manage/orders/lines.js`
- Create: `functions/services/OrderReturnService.js`
- Create: `functions/services/__tests__/OrderReturnService.test.js`
- Create: `functions/repositories/order/return-mutations.js` if return writes become large enough to justify extraction
- Create: `migrations/0065_order_delivery_status_and_returns.sql`
- Modify: `scripts/init-database.sql`

**Frontend state and UI**
- Modify: `src/utils/order-state-machine.js`
- Modify: `src/composables/useOrders.js`
- Modify: `src/components/OrderManager.vue`
- Modify: `src/components/OrderStatusChanger.vue`
- Modify: `src/components/order/OrderListStatusStack.vue`
- Modify: `src/components/order/OrderDetail.vue`
- Modify: `src/components/order/OrderLinesCard.vue`
- Modify: `src/components/order/OrderLineCommandPanel.vue`
- Modify: `src/components/order/OrderStatusHeader.vue`
- Modify: `src/components/order/OrderList.vue`
- Create: `src/components/order/OrderReturnPanel.vue` if return UX becomes too large for `OrderLineCommandPanel.vue`
- Create: `src/components/order/OrderDeliveryStatusBadge.vue` if delivery status needs dedicated rendering
- Modify: `src/locales/zh-CN/order.js`
- Modify: `src/locales/en/order.js`

**Tests**
- Modify: `functions/api/utils/__tests__/order-state-machine.test.js`
- Modify: `functions/repositories/__tests__/order-mutations.test.js`
- Modify: `functions/repositories/__tests__/order-queries.display-model.test.js`
- Modify: `functions/repositories/__tests__/order-helpers.procurement-status.test.js`
- Modify: `functions/services/__tests__/OrderLineFulfillmentService.test.js`
- Modify: `functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js`
- Modify: `src/components/order/__tests__/OrderStatusChanger.force-flow.test.js`
- Modify: `src/components/order/__tests__/OrderListStatusStack.test.js`
- Modify: `src/components/order/__tests__/OrderLineCommandPanel.test.js`
- Modify: `src/components/__tests__/OrderManager.line-statuses.test.js`
- Modify: `src/components/__tests__/OrderManager.network-workflow.test.js`
- Modify: `src/composables/__tests__/useOrders.line-commands.test.js`
- Modify: `test/order-line-fulfillment-real-api.test.js`
- Create: `src/components/order/__tests__/OrderReturnPanel.test.js` if return UI is extracted

## Target Model

**Order header status**
- `pending`
- `confirmed`
- `production`
- `shipping`
- `fulfilled`
- `rejected`
- `void`

**Derived fulfillment aggregate**
- `unfulfilled`
- `partially_fulfilled`
- `fulfilled`

**Delivery status**
- `not_shipped`
- `in_transit`
- `delivered`
- `returned`

**Return semantics**
- `unship`: warehouse-side rollback before customer receipt
- `return`: post-delivery reverse flow after customer/store receipt

**Compatibility rule**
- Existing `delivered` order status rows migrate to `fulfilled`
- Existing procurement/display projections remain queryable during migration, but new code should read explicit fulfillment/delivery aggregates where available

## Task 1: Lock The New Domain Language In Tests

**Files:**
- Modify: `functions/api/utils/__tests__/order-state-machine.test.js`
- Modify: `src/components/order/__tests__/OrderStatusChanger.force-flow.test.js`
- Modify: `functions/repositories/__tests__/order-helpers.procurement-status.test.js`

- [ ] **Step 1: Write failing backend state-machine tests**

```js
it('treats fulfilled as the terminal fulfillment-complete order status', () => {
  expect(getAllowedOrderTransitions('shipping')).toContain('fulfilled');
  expect(getAllowedOrderTransitions('fulfilled')).not.toContain('delivered');
});
```

- [ ] **Step 2: Write failing frontend status-picker tests**

```js
it('renders fulfilled as the in-flow completion state and keeps delivery confirmation separate', async () => {
  // mount status changer, verify fulfilled appears in flow
});
```

- [ ] **Step 3: Write failing mapping test for new aggregates**

```js
it('maps fulfillmentStatus and deliveryStatus separately for order list items', () => {
  expect(mapped.fulfillmentStatus).toBe('fulfilled');
  expect(mapped.deliveryStatus).toBe('in_transit');
});
```

- [ ] **Step 4: Run red tests**

Run:
```bash
pnpm vitest functions/api/utils/__tests__/order-state-machine.test.js src/components/order/__tests__/OrderStatusChanger.force-flow.test.js functions/repositories/__tests__/order-helpers.procurement-status.test.js
```

Expected: FAIL because `fulfilled` and split delivery semantics do not exist yet.

- [ ] **Step 5: Commit**

```bash
git add functions/api/utils/__tests__/order-state-machine.test.js src/components/order/__tests__/OrderStatusChanger.force-flow.test.js functions/repositories/__tests__/order-helpers.procurement-status.test.js
git commit -m "test: lock order fulfillment redesign semantics"
```

## Task 2: Add Database Fields And Compatibility Migration

**Files:**
- Create: `migrations/0065_order_delivery_status_and_returns.sql`
- Modify: `scripts/init-database.sql`
- Test: `test/order-line-fulfillment-real-api.test.js`

- [ ] **Step 1: Write migration expectations as a failing real-API or repository test**

```js
it('persists delivery status separately from order status after migration', async () => {
  expect(order.deliveryStatus).toBe('not_shipped');
});
```

- [ ] **Step 2: Add migration**

Required columns:
- `orders.delivery_status TEXT NOT NULL DEFAULT 'not_shipped'`
- `orders.fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled'`
- `order_returns` table with `id`, `order_id`, `order_line_id`, `variant_id`, `quantity`, `status`, `reason`, audit fields

Backfill:
- map legacy `orders.status = 'delivered'` to `orders.status = 'fulfilled'`
- set `fulfillment_status` from line shipped totals
- set `delivery_status = 'not_shipped'` for all migrated rows unless the business has verified receipt history

- [ ] **Step 3: Update bootstrap schema**

Mirror the migration in `scripts/init-database.sql`.

- [ ] **Step 4: Run migration-focused verification**

Run:
```bash
pnpm vitest test/order-line-fulfillment-real-api.test.js --runInBand
```

Expected: schema-dependent tests now reach runtime instead of failing due to missing columns.

- [ ] **Step 5: Commit**

```bash
git add migrations/0065_order_delivery_status_and_returns.sql scripts/init-database.sql test/order-line-fulfillment-real-api.test.js
git commit -m "feat: add fulfillment and delivery status schema"
```

## Task 3: Refactor Backend Order Status Semantics

**Files:**
- Modify: `functions/api/utils/order-state-machine.js`
- Modify: `functions/repositories/order/mutations.js`
- Modify: `functions/repositories/__tests__/order-mutations.test.js`
- Modify: `functions/api/utils/__tests__/order-state-machine.test.js`

- [ ] **Step 1: Add failing mutation tests**

```js
it('rejects fulfilled until all effective quantities are shipped', async () => {});
it('persists fulfilled instead of delivered when shipment completion is reached', async () => {});
```

- [ ] **Step 2: Replace `delivered` order-state transitions with `fulfilled`**

Update transition tables, guards, and compatibility constants in backend utilities.

- [ ] **Step 3: Keep compatibility read-paths**

If API still receives legacy `delivered`, normalize it to `fulfilled` temporarily and log/deprecate.

- [ ] **Step 4: Run tests**

Run:
```bash
pnpm vitest functions/api/utils/__tests__/order-state-machine.test.js functions/repositories/__tests__/order-mutations.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/api/utils/order-state-machine.js functions/repositories/order/mutations.js functions/repositories/__tests__/order-mutations.test.js functions/api/utils/__tests__/order-state-machine.test.js
git commit -m "feat: rename delivered order completion to fulfilled"
```

## Task 4: Introduce Explicit Fulfillment And Delivery Aggregates In Queries

**Files:**
- Modify: `functions/repositories/order/sql.js`
- Modify: `functions/repositories/order/queries.js`
- Modify: `functions/repositories/order/helpers.js`
- Modify: `functions/repositories/__tests__/order-queries.display-model.test.js`
- Modify: `functions/repositories/__tests__/order-helpers.procurement-status.test.js`

- [ ] **Step 1: Write failing query tests**

```js
expect(result.items[0]).toMatchObject({
  fulfillmentStatus: 'partially_fulfilled',
  deliveryStatus: 'not_shipped',
  canFulfillComplete: false,
});
```

- [ ] **Step 2: Extend SQL aggregate joins**

Expose:
- line ordered/shipped/cancelled totals
- derived `fulfillment_status`
- stored `delivery_status`

- [ ] **Step 3: Map helpers**

Return:
- `fulfillmentStatus`
- `deliveryStatus`
- `canFulfillComplete`

Deprecate:
- `canDeliver`

- [ ] **Step 4: Run tests**

Run:
```bash
pnpm vitest functions/repositories/__tests__/order-queries.display-model.test.js functions/repositories/__tests__/order-helpers.procurement-status.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/repositories/order/sql.js functions/repositories/order/queries.js functions/repositories/order/helpers.js functions/repositories/__tests__/order-queries.display-model.test.js functions/repositories/__tests__/order-helpers.procurement-status.test.js
git commit -m "feat: expose fulfillment and delivery aggregates"
```

## Task 5: Tighten Line Command Semantics And Add Return Service

**Files:**
- Modify: `functions/services/OrderLineFulfillmentService.js`
- Create: `functions/services/OrderReturnService.js`
- Modify: `functions/services/__tests__/OrderLineFulfillmentService.test.js`
- Create: `functions/services/__tests__/OrderReturnService.test.js`
- Modify: `functions/lib/hono/routes/manage/orders/lines.js`
- Modify: `functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js`

- [ ] **Step 1: Write failing service tests**

```js
it('allows unship only before delivery confirmation', async () => {});
it('creates return records after delivery confirmation instead of unshipping', async () => {});
```

- [ ] **Step 2: Keep `unship` as warehouse rollback**

Guard `unship` by:
- parent order not `fulfilled` with `delivery_status = delivered`
- no return already recorded for the target quantity

- [ ] **Step 3: Add return service**

Responsibilities:
- validate return quantity against delivered quantity
- restore inventory according to return reason policy
- emit outbox/audit events
- update `delivery_status` to `returned` or partial return equivalent if you choose to support partials now

- [ ] **Step 4: Add management route(s)**

Minimum route:
- `POST /api/manage/orders/:orderId/lines/:lineId/return`

- [ ] **Step 5: Run tests**

Run:
```bash
pnpm vitest functions/services/__tests__/OrderLineFulfillmentService.test.js functions/services/__tests__/OrderReturnService.test.js functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add functions/services/OrderLineFulfillmentService.js functions/services/OrderReturnService.js functions/services/__tests__/OrderLineFulfillmentService.test.js functions/services/__tests__/OrderReturnService.test.js functions/lib/hono/routes/manage/orders/lines.js functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js
git commit -m "feat: add explicit return flow and tighten unship guards"
```

## Task 6: Update Frontend State Machine And Labels

**Files:**
- Modify: `src/utils/order-state-machine.js`
- Modify: `src/locales/zh-CN/order.js`
- Modify: `src/locales/en/order.js`
- Modify: `src/components/order/__tests__/OrderStatusChanger.force-flow.test.js`

- [ ] **Step 1: Write failing UI tests**

```js
it('shows fulfilled as the completion state and delivered as delivery confirmation metadata', async () => {});
```

- [ ] **Step 2: Update front-end transition table**

Replace `delivered` header transition with `fulfilled`.

- [ ] **Step 3: Rewrite user-facing copy**

Examples:
- order header `fulfilled`: `履约完成` / `Fulfillment Complete`
- delivery badge `delivered`: `已签收` / `Delivered`
- return action labels and warnings

- [ ] **Step 4: Run tests**

Run:
```bash
pnpm vitest src/components/order/__tests__/OrderStatusChanger.force-flow.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/order-state-machine.js src/locales/zh-CN/order.js src/locales/en/order.js src/components/order/__tests__/OrderStatusChanger.force-flow.test.js
git commit -m "feat: align frontend terminology with fulfillment redesign"
```

## Task 7: Redesign Management List And Detail Presentation

**Files:**
- Modify: `src/components/OrderManager.vue`
- Modify: `src/components/order/OrderListStatusStack.vue`
- Modify: `src/components/order/OrderStatusHeader.vue`
- Modify: `src/components/order/OrderDetail.vue`
- Modify: `src/components/order/OrderList.vue`
- Modify: `src/components/__tests__/OrderManager.line-statuses.test.js`
- Modify: `src/components/__tests__/OrderManager.network-workflow.test.js`
- Modify: `src/components/order/__tests__/OrderListStatusStack.test.js`
- Modify: `src/components/order/__tests__/OrderDetail.lines.test.js`

- [ ] **Step 1: Write failing component tests**

Required expectations:
- list shows order status + fulfillment badge + delivery badge without ambiguity
- detail header shows `fulfilled` separately from `delivered`
- line command success refreshes both detail and list state

- [ ] **Step 2: Replace `canDeliver` plumbing**

Use:
- `canFulfillComplete`
- `fulfillmentStatus`
- `deliveryStatus`

- [ ] **Step 3: Refresh list after line commands**

On line command success:
- refresh detail
- refresh current list page or patch current row aggregates from refreshed detail

- [ ] **Step 4: Run tests**

Run:
```bash
pnpm vitest src/components/__tests__/OrderManager.line-statuses.test.js src/components/__tests__/OrderManager.network-workflow.test.js src/components/order/__tests__/OrderListStatusStack.test.js src/components/order/__tests__/OrderDetail.lines.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/OrderManager.vue src/components/order/OrderListStatusStack.vue src/components/order/OrderStatusHeader.vue src/components/order/OrderDetail.vue src/components/order/OrderList.vue src/components/__tests__/OrderManager.line-statuses.test.js src/components/__tests__/OrderManager.network-workflow.test.js src/components/order/__tests__/OrderListStatusStack.test.js src/components/order/__tests__/OrderDetail.lines.test.js
git commit -m "feat: separate order fulfillment and delivery presentation"
```

## Task 8: Redesign Line Command UI For Return Flow

**Files:**
- Modify: `src/components/order/OrderLineCommandPanel.vue`
- Modify: `src/components/order/OrderLinesCard.vue`
- Modify: `src/composables/useOrders.js`
- Modify: `src/composables/__tests__/useOrders.line-commands.test.js`
- Modify: `src/components/order/__tests__/OrderLineCommandPanel.test.js`
- Create: `src/components/order/OrderReturnPanel.vue` if extracted
- Create: `src/components/order/__tests__/OrderReturnPanel.test.js` if extracted

- [ ] **Step 1: Write failing tests**

```js
it('shows return instead of unship after delivery confirmation', async () => {});
it('refreshes list and detail aggregates after a successful line command', async () => {});
```

- [ ] **Step 2: Implement command panel redesign**

Rules:
- before delivery confirmation: show `reserve`, `release`, `ship`, `unship`
- after delivery confirmation: hide/disable `unship`, show `return`
- keep variant-binding and quantity-limit guards

- [ ] **Step 3: Add composable helper**

Add:
- `returnOrderLine(orderId, lineId, quantity, reason?)`

- [ ] **Step 4: Run tests**

Run:
```bash
pnpm vitest src/components/order/__tests__/OrderLineCommandPanel.test.js src/composables/__tests__/useOrders.line-commands.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/order/OrderLineCommandPanel.vue src/components/order/OrderLinesCard.vue src/composables/useOrders.js src/composables/__tests__/useOrders.line-commands.test.js src/components/order/__tests__/OrderLineCommandPanel.test.js
git commit -m "feat: add return-aware line command ui"
```

## Task 9: End-To-End Regression And Legacy Compatibility

**Files:**
- Modify: `test/order-line-fulfillment-real-api.test.js`
- Modify: `functions/repositories/__tests__/order-inventory-flow.test.js`
- Modify: any failing integration snapshots

- [ ] **Step 1: Write failing real-API scenarios**

Add scenarios:
- legacy `delivered` requests normalize or reject with migration hint
- `fulfilled` requires all effective quantity shipped
- delivered confirmation updates `delivery_status` only
- delivered line can be returned but not unshipped
- return restores inventory and updates projections
- list and detail reflect the same aggregates after each command

- [ ] **Step 2: Run focused integration tests**

Run:
```bash
pnpm vitest functions/repositories/__tests__/order-inventory-flow.test.js test/order-line-fulfillment-real-api.test.js
```

Expected: PASS in local mocked mode.

- [ ] **Step 3: Run real API verification**

Run:
```bash
RUN_REAL_API_TESTS=1 BASE_URL=http://127.0.0.1:8080 pnpm vitest --maxWorkers 1 test/order-line-fulfillment-real-api.test.js
```

Expected: PASS with all real workflow scenarios green.

- [ ] **Step 4: Commit**

```bash
git add functions/repositories/__tests__/order-inventory-flow.test.js test/order-line-fulfillment-real-api.test.js
git commit -m "test: cover fulfillment delivery and return workflows end to end"
```

## Task 10: Cleanup And Deprecation Pass

**Files:**
- Modify: all touched files as needed
- Create: `docs/order-fulfillment-semantics.md` if business documentation is missing

- [ ] **Step 1: Remove transitional naming where safe**

Examples:
- rename `canDeliver` to `canFulfillComplete`
- remove outdated copy that says `delivered` when the code now means `fulfilled`

- [ ] **Step 2: Add business documentation**

Document:
- what each status means
- when `unship` is legal
- when `return` must be used
- how fulfillment differs from delivery

- [ ] **Step 3: Run full verification**

Run:
```bash
pnpm vitest functions/api/utils/__tests__/order-state-machine.test.js functions/repositories/__tests__/order-mutations.test.js functions/repositories/__tests__/order-queries.display-model.test.js functions/services/__tests__/OrderLineFulfillmentService.test.js functions/services/__tests__/OrderReturnService.test.js functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js src/components/order/__tests__/OrderStatusChanger.force-flow.test.js src/components/order/__tests__/OrderListStatusStack.test.js src/components/order/__tests__/OrderLineCommandPanel.test.js src/components/__tests__/OrderManager.line-statuses.test.js src/components/__tests__/OrderManager.network-workflow.test.js src/composables/__tests__/useOrders.line-commands.test.js
RUN_REAL_API_TESTS=1 BASE_URL=http://127.0.0.1:8080 pnpm vitest --maxWorkers 1 test/order-line-fulfillment-real-api.test.js
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "docs: finalize fulfillment delivery and return redesign"
```

## Risks And Decisions To Hold Constant

- Do not treat customer receipt as a side effect of `ship`; it requires explicit delivery confirmation.
- Do not keep using `unship` for post-delivery reverse flows.
- Do not overload procurement status to represent fulfillment completion.
- Do not silently drop legacy `delivered` requests without either normalization or a clear business error.
- Keep list/detail/header semantics consistent in the same release.

## Release Strategy

1. Deploy migration and compatibility readers first.
2. Deploy backend semantics and dual-write compatibility.
3. Deploy frontend with new labels and split badges.
4. Enable return action only after backend route and migration are live.
5. Remove compatibility aliases after one release cycle once no clients send legacy `delivered`.

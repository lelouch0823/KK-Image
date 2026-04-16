# Ops And Line Fulfillment Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining operator and workflow gaps after the order-line and outbox backend rollout: ship an admin outbox/replay console, expose line-level reservation and shipment commands as first-class order operations, and fold webhook delivery into the standard real-API full-chain regression path.

**Architecture:** Treat the current procurement receipt transaction, outbox dispatch, and line-level order read model as the stable correctness boundary. Add thin admin-facing Vue shells over the shipped outbox/replay APIs, introduce a dedicated order-line fulfillment command service and sub-route instead of overloading whole-order status PATCH, and normalize webhook verification into Vitest-compatible real-API helpers so `pnpm dev:all` can exercise the entire chain in one run. Any new order mutation side effects must continue to use the outbox and existing cache invalidation discipline.

**Tech Stack:** Vue 3, Hono, Cloudflare D1/SQLite, existing order/purchase/outbox repositories and services, Vitest, Node real API scripts, Wrangler local dev

---

## Dependencies And Scope Boundaries

- Prior outbox backend work to reuse: `docs/superpowers/plans/2026-03-29-order-procurement-outbox-expansion-phase-3-audit-replay-plan.md`
- Prior line-level display work to reuse: `docs/superpowers/plans/2026-03-30-order-line-level-frontend-adaptation-plan.md`
- This plan does **not** create a new sales management module; salesperson admin UI already exists.
- This plan does **not** schedule a repo-wide "migrate everything to outbox" effort; current core order/purchase/file/folder side effects already use outbox-backed flows or existing domain events. Verification in this plan is for regression guarding, not for reopening the whole migration.
- Manual admin notification creation stays on the existing `admin_notification_created` event path unless line-level fulfillment work proves a new notification contract is required.

## File Map

**Outbox operator console**
- Create: `src/views/OutboxOps.vue`
- Create: `src/components/outbox/OutboxEventTable.vue`
- Create: `src/components/outbox/OutboxReplayPanel.vue`
- Create: `src/composables/useOutboxOps.js`
- Create: `src/composables/__tests__/useOutboxOps.test.js`
- Create: `src/views/__tests__/OutboxOps.behavior.test.js`
- Modify: `src/router/index.js`
- Modify: `src/components/layout/Sidebar.vue`
- Modify: `src/utils/constants.js`
- Modify: `src/locales/zh-CN/misc.js`
- Modify: `src/locales/en/misc.js`
- Verify: `functions/lib/hono/routes/manage/outbox.js`
- Verify: `functions/lib/hono/routes/manage/audit-replay.js`

**Order-line fulfillment command backend**
- Create: `functions/services/OrderLineFulfillmentService.js`
- Create: `functions/services/__tests__/OrderLineFulfillmentService.test.js`
- Create: `functions/lib/hono/routes/manage/orders/lines.js`
- Create: `functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js`
- Modify: `functions/lib/hono/routes/manage/orders/index.js`
- Modify: `functions/repositories/OrderLineAllocationRepository.js`
- Modify: `functions/repositories/__tests__/OrderLineAllocationRepository.test.js`
- Modify: `functions/services/DomainEventCatalog.js`
- Modify: `functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js`
- Verify: `functions/lib/hono/_shared/__tests__/route-outbox-discipline.test.js`
- Verify: `functions/services/__tests__/DomainEventCatalog.coverage.test.js`

**Order-line fulfillment admin UI**
- Create: `src/components/order/OrderLineCommandPanel.vue`
- Create: `src/components/order/__tests__/OrderLineCommandPanel.test.js`
- Create: `src/composables/__tests__/useOrders.line-commands.test.js`
- Modify: `src/composables/useOrders.js`
- Modify: `src/components/order/OrderDetail.vue`
- Modify: `src/components/order/OrderLinesCard.vue`
- Modify: `src/components/order/OrderWorkflowModal.vue`
- Modify: `src/components/__tests__/OrderManager.network-workflow.test.js`
- Modify: `src/locales/zh-CN/order.js`
- Modify: `src/locales/en/order.js`
- Modify: `src/utils/constants.js`

**Real API and docs closure**
- Create: `test/utils/webhook-real-api.js`
- Create: `test/webhooks-real-api.test.js`
- Modify: `test/full-business-regression-real-api.test.js`
- Modify: `test/webhook-test.js`
- Modify: `package.json`
- Modify: `docs/API_REFERENCE.md`
- Modify: `docs/api/management.md`
- Modify: `docs/admin-manual/README.md`
- Modify: `docs/admin-manual/audit-operations.md`
- Modify: `docs/admin-manual/product-inventory.md`
- Modify: `docs/architecture/system-overview.md`
- Modify: `docs/developer-guide/architecture.md`

### Task 1: Ship The Admin Outbox And Replay Console

**Files:**
- Create: `src/views/OutboxOps.vue`
- Create: `src/components/outbox/OutboxEventTable.vue`
- Create: `src/components/outbox/OutboxReplayPanel.vue`
- Create: `src/composables/useOutboxOps.js`
- Create: `src/composables/__tests__/useOutboxOps.test.js`
- Create: `src/views/__tests__/OutboxOps.behavior.test.js`
- Modify: `src/router/index.js`
- Modify: `src/components/layout/Sidebar.vue`
- Modify: `src/utils/constants.js`
- Modify: `src/locales/zh-CN/misc.js`
- Modify: `src/locales/en/misc.js`
- Verify: `functions/lib/hono/routes/manage/outbox.js`
- Verify: `functions/lib/hono/routes/manage/audit-replay.js`

- [ ] **Step 1: Write the failing composable and page tests**

```js
it('loads outbox events with eventType, consumerName, and status filters', async () => {});
it('opens event detail and submits dry-run replay before execute replay', async () => {});
it('shows the route in admin navigation only for audit-capable users', async () => {});
```

Run: `pnpm test:unit src/composables/__tests__/useOutboxOps.test.js src/views/__tests__/OutboxOps.behavior.test.js`
Expected: FAIL because no outbox page, composable, or route wiring exists yet.

- [ ] **Step 2: Add the thin API client and page split**

Implementation notes:
- Add `API.MANAGE_OUTBOX`, `API.MANAGE_OUTBOX_BY_ID`, `API.MANAGE_AUDIT_REPLAY_DRY_RUN`, and `API.MANAGE_AUDIT_REPLAY_EXECUTE` to `src/utils/constants.js`
- Keep `useOutboxOps.js` focused on list/detail/replay calls and loading/error state only
- Split the page into a table component plus replay panel so replay confirmation logic does not bloat the page shell
- Reuse `ManagementListShell`, `AppTable`, `StatusBadge`, and existing permission-denied patterns from `src/views/AuditLogs.vue`

- [ ] **Step 3: Expose the page in admin navigation**

Implementation notes:
- Add `/admin/outbox-ops` to `src/router/index.js` with `audit:read` permission
- Add a sidebar entry next to audit logs in `src/components/layout/Sidebar.vue`
- Add router/sidebar locale keys in both `src/locales/zh-CN/misc.js` and `src/locales/en/misc.js`
- Execute replay from the UI only after an explicit dry-run result is visible; keep destructive confirmation in the replay panel

- [ ] **Step 4: Re-run focused UI tests and build**

Run: `pnpm test:unit src/composables/__tests__/useOutboxOps.test.js src/views/__tests__/OutboxOps.behavior.test.js src/views/__tests__/AuditLogs.behavior.test.js`
Expected: PASS

Run: `pnpm build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/views/OutboxOps.vue src/components/outbox src/composables/useOutboxOps.js src/composables/__tests__/useOutboxOps.test.js src/views/__tests__/OutboxOps.behavior.test.js src/router/index.js src/components/layout/Sidebar.vue src/utils/constants.js src/locales/zh-CN/misc.js src/locales/en/misc.js
git commit -m "feat: add admin outbox operations console"
```

### Task 2: Add Order-Line Fulfillment Commands Behind A Dedicated Backend Service

**Files:**
- Create: `functions/services/OrderLineFulfillmentService.js`
- Create: `functions/services/__tests__/OrderLineFulfillmentService.test.js`
- Create: `functions/lib/hono/routes/manage/orders/lines.js`
- Create: `functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js`
- Modify: `functions/lib/hono/routes/manage/orders/index.js`
- Modify: `functions/repositories/OrderLineAllocationRepository.js`
- Modify: `functions/repositories/__tests__/OrderLineAllocationRepository.test.js`
- Modify: `functions/services/DomainEventCatalog.js`
- Modify: `functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js`
- Verify: `functions/lib/hono/_shared/__tests__/route-outbox-discipline.test.js`
- Verify: `functions/services/__tests__/DomainEventCatalog.coverage.test.js`

- [ ] **Step 1: Write the failing backend tests for reserve, release, and ship commands**

```js
it('reserves line quantity against on-hand stock and records active allocations', async () => {});
it('releases only the reserved portion and marks allocation rows released', async () => {});
it('ships a line quantity, deducts stock, and emits one cache invalidation event through outbox', async () => {});
it('rejects line commands that exceed remaining, reserved, or available quantities', async () => {});
```

Run: `pnpm test:unit functions/services/__tests__/OrderLineFulfillmentService.test.js functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js functions/repositories/__tests__/OrderLineAllocationRepository.test.js`
Expected: FAIL because no command service or route surface exists yet and the allocation repository only supports inserts.

- [ ] **Step 2: Extend the allocation repository for read and release operations**

Implementation notes:
- Keep `OrderLineAllocationRepository.js` narrowly focused on allocation persistence, not business rules
- Add a `listActiveByOrderLine(orderLineId)` helper plus a release/update helper that records `released_qty`, `released_at`, and `status = 'released'`
- Cover both active and partially released cases in `functions/repositories/__tests__/OrderLineAllocationRepository.test.js`

- [ ] **Step 3: Implement the command service and route contract**

Implementation notes:
- Create `functions/services/OrderLineFulfillmentService.js` as the only place that coordinates line reads, reservation math, shipment stock deductions, and outbox event creation
- Mount a dedicated `functions/lib/hono/routes/manage/orders/lines.js` from `functions/lib/hono/routes/manage/orders/index.js`
- Use route shapes:

```txt
POST /api/manage/orders/:id/lines/:lineId/reserve
POST /api/manage/orders/:id/lines/:lineId/release
POST /api/manage/orders/:id/lines/:lineId/ship
```

- The service should reuse `DemandService`, `InventoryService`, and `projectOrderLineStatus()` where helpful, but keep whole-order status PATCH semantics unchanged
- Publish a dedicated cache-only event such as `order_line_fulfillment_updated` through outbox so the new commands invalidate order, notification, and analytics caches without reusing salesperson-facing notification events

- [ ] **Step 4: Close the outbox and route-discipline guardrails**

Run: `pnpm test:unit functions/services/__tests__/OrderLineFulfillmentService.test.js functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js functions/repositories/__tests__/OrderLineAllocationRepository.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js functions/lib/hono/_shared/__tests__/route-outbox-discipline.test.js functions/services/__tests__/DomainEventCatalog.coverage.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/services/OrderLineFulfillmentService.js functions/services/__tests__/OrderLineFulfillmentService.test.js functions/lib/hono/routes/manage/orders/lines.js functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js functions/lib/hono/routes/manage/orders/index.js functions/repositories/OrderLineAllocationRepository.js functions/repositories/__tests__/OrderLineAllocationRepository.test.js functions/services/DomainEventCatalog.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js
git commit -m "feat: add order line fulfillment command routes"
```

### Task 3: Surface Line-Level Fulfillment Operations In The Order Admin UI

**Files:**
- Create: `src/components/order/OrderLineCommandPanel.vue`
- Create: `src/components/order/__tests__/OrderLineCommandPanel.test.js`
- Create: `src/composables/__tests__/useOrders.line-commands.test.js`
- Modify: `src/composables/useOrders.js`
- Modify: `src/components/order/OrderDetail.vue`
- Modify: `src/components/order/OrderLinesCard.vue`
- Modify: `src/components/order/OrderWorkflowModal.vue`
- Modify: `src/components/__tests__/OrderManager.network-workflow.test.js`
- Modify: `src/locales/zh-CN/order.js`
- Modify: `src/locales/en/order.js`
- Modify: `src/utils/constants.js`

- [ ] **Step 1: Write the failing admin-UI tests**

```js
it('renders per-line reserve, release, and ship actions in admin detail mode only', async () => {});
it('submits line commands through useOrders and refreshes hydrated order detail', async () => {});
it('keeps the workflow modal open while line command retries are in flight', async () => {});
```

Run: `pnpm test:unit src/components/order/__tests__/OrderLineCommandPanel.test.js src/composables/__tests__/useOrders.line-commands.test.js src/components/__tests__/OrderManager.network-workflow.test.js`
Expected: FAIL because the frontend still exposes line quantities as read-only display cards.

- [ ] **Step 2: Add dedicated frontend command helpers**

Implementation notes:
- Add `MANAGE_ORDER_LINE_RESERVE`, `MANAGE_ORDER_LINE_RELEASE`, and `MANAGE_ORDER_LINE_SHIP` helpers to `src/utils/constants.js`
- Extend `useOrders.js` with `reserveOrderLine()`, `releaseOrderLine()`, and `shipOrderLine()` instead of overloading `updateOrder()`
- Keep toasts and optimistic updates narrow: refresh the full order detail after each successful command rather than trying to mutate nested line state in many places

- [ ] **Step 3: Split the line command UI into a focused panel component**

Implementation notes:
- Keep `OrderLinesCard.vue` responsible for rendering line metrics and mount `OrderLineCommandPanel.vue` inside each card only when `mode === 'admin'`
- Keep `OrderWorkflowModal.vue` and `OrderDetail.vue` in charge of refresh orchestration, not command form internals
- Add locale keys for action labels, validation copy, and command success/error states in both language packs

- [ ] **Step 4: Re-run focused frontend regressions**

Run: `pnpm test:unit src/components/order/__tests__/OrderLineCommandPanel.test.js src/composables/__tests__/useOrders.line-commands.test.js src/components/__tests__/OrderManager.network-workflow.test.js src/components/order/__tests__/OrderDetail.lines.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/order/OrderLineCommandPanel.vue src/components/order/__tests__/OrderLineCommandPanel.test.js src/composables/__tests__/useOrders.line-commands.test.js src/composables/useOrders.js src/components/order/OrderDetail.vue src/components/order/OrderLinesCard.vue src/components/order/OrderWorkflowModal.vue src/components/__tests__/OrderManager.network-workflow.test.js src/locales/zh-CN/order.js src/locales/en/order.js src/utils/constants.js
git commit -m "feat: surface order line fulfillment actions in admin ui"
```

### Task 4: Promote Webhook Delivery Into The Standard Real-API Full-Chain Regression

**Files:**
- Create: `test/utils/webhook-real-api.js`
- Create: `test/webhooks-real-api.test.js`
- Modify: `test/full-business-regression-real-api.test.js`
- Modify: `test/webhook-test.js`
- Modify: `package.json`
- Verify: `test/utils/manage-products-real-api.js`

- [ ] **Step 1: Write the failing webhook real-API test in Vitest form**

```js
it('creates a webhook, triggers test delivery, and observes webhook.test locally', async () => {});
it('keeps the legacy CLI wrapper working by reusing the shared helper', async () => {});
```

Run: `BASE_URL=http://127.0.0.1:8080 RUN_REAL_API_TESTS=1 node node_modules/vitest/vitest.mjs --maxWorkers 1 test/webhooks-real-api.test.js`
Expected: FAIL because webhook real-API coverage still lives only in `test/webhook-test.js`.

- [ ] **Step 2: Extract a shared webhook harness and keep CLI compatibility**

Implementation notes:
- Move the temporary HTTP receiver, create/test/delete webhook helpers, and delivery wait logic into `test/utils/webhook-real-api.js`
- Keep `test/webhook-test.js` as a thin CLI wrapper so `pnpm test:webhook` and `pnpm test:real-api:webhook` remain stable
- Reuse the same base URL and auth conventions already established in `test/utils/manage-products-real-api.js`

- [ ] **Step 3: Extend the full-business regression to cover webhook and line commands**

Implementation notes:
- Update `test/full-business-regression-real-api.test.js` so the standard chain also verifies:
  - at least one line-level reserve or ship command after procurement converges
  - the resulting order detail reflects updated line metrics and display status
  - a live webhook delivery occurs during the same full-chain suite or immediately-adjacent helper flow
- Add `test/webhooks-real-api.test.js` to `test:real-api:full-chain`
- Add it to `test:real-api` as well if the runtime cost remains acceptable

- [ ] **Step 4: Run the full real-API gate against `pnpm dev:all`**

Run: `pnpm dev:all`
Expected: local Vite app and Pages worker stay up on the documented ports.

Run: `BASE_URL=http://127.0.0.1:8080 RUN_REAL_API_TESTS=1 node node_modules/vitest/vitest.mjs --maxWorkers 1 test/full-business-regression-real-api.test.js test/webhooks-real-api.test.js test/purchase-receipts-real-api.test.js test/notifications-real-api.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/utils/webhook-real-api.js test/webhooks-real-api.test.js test/full-business-regression-real-api.test.js test/webhook-test.js package.json
git commit -m "test: fold webhook delivery into full-chain real api regression"
```

### Task 5: Refresh Docs And Run The Final Verification Sweep

**Files:**
- Modify: `docs/API_REFERENCE.md`
- Modify: `docs/api/management.md`
- Modify: `docs/admin-manual/README.md`
- Modify: `docs/admin-manual/audit-operations.md`
- Modify: `docs/admin-manual/product-inventory.md`
- Modify: `docs/architecture/system-overview.md`
- Modify: `docs/developer-guide/architecture.md`
- Verify: `docs/README.md`
- Verify: `docs/project-summary.md`

- [ ] **Step 1: Update docs for the new shipped surfaces**

Documentation notes:
- Add the outbox operator page and replay flow to admin operations docs
- Document the new order-line command endpoints and UI workflow in API and inventory docs
- Update architecture docs so line-level order fulfillment is described as a first-class command path rather than an internal-only read model
- Update real-API verification instructions so `pnpm dev:all` plus `pnpm test:real-api:full-chain` is the default full-chain operator check

- [ ] **Step 2: Run the focused unit and route regression gate**

Run: `pnpm test:unit src/composables/__tests__/useOutboxOps.test.js src/views/__tests__/OutboxOps.behavior.test.js src/components/order/__tests__/OrderLineCommandPanel.test.js src/composables/__tests__/useOrders.line-commands.test.js src/components/__tests__/OrderManager.network-workflow.test.js functions/services/__tests__/OrderLineFulfillmentService.test.js functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js functions/lib/hono/routes/manage/__tests__/audit-replay-routes.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js functions/lib/hono/_shared/__tests__/route-outbox-discipline.test.js functions/services/__tests__/DomainEventCatalog.coverage.test.js`
Expected: PASS

- [ ] **Step 3: Run build plus real-API end gate**

Run: `pnpm build`
Expected: PASS

Run: `pnpm test:real-api:full-chain`
Expected: PASS, including webhook coverage in the standard chain rather than as a separate optional script only.

- [ ] **Step 4: Final audit checklist**

Audit checklist:
- The admin UI exposes outbox event list, event detail, dry-run replay, and execute replay
- New order-line commands do not call `invalidateCache()` directly from routes
- New line-level mutations publish an event registered in `functions/services/DomainEventCatalog.js`
- Standard real-API full-chain coverage now includes webhook delivery and at least one line-level fulfillment action
- Docs reflect the new operator and order-line workflows

- [ ] **Step 5: Final commit**

```bash
git add docs/API_REFERENCE.md docs/api/management.md docs/admin-manual/README.md docs/admin-manual/audit-operations.md docs/admin-manual/product-inventory.md docs/architecture/system-overview.md docs/developer-guide/architecture.md docs/README.md docs/project-summary.md
git commit -m "docs: close outbox ops and line fulfillment gaps"
```

## Recommended Execution Order

1. Task 1: Outbox operator console
2. Task 2: Order-line fulfillment backend
3. Task 3: Order-line fulfillment admin UI
4. Task 4: Full-chain real-API and webhook normalization
5. Task 5: Docs and verification sweep

## Risk Notes

- The biggest product risk is not backend correctness anymore; it is operator usability. That is why the outbox console comes before more backend expansion.
- Do not overload `PATCH /api/manage/orders/:id/status` with line-level command semantics. Separate routes keep status transitions and fulfillment mutations auditable and testable.
- Reusing existing `order_updated_by_admin` events for line commands would likely create incorrect salesperson notification behavior. Prefer a dedicated cache-only event unless testing proves a broader audience is required.
- Webhook coverage should become part of the standard full-chain path without deleting the standalone CLI script; keep the focused wrapper for debugging delivery issues quickly.

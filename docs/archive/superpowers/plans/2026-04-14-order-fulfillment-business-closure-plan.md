# Order Fulfillment Business Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the full order fulfillment business chain so the system can reliably handle fulfillment completion, delivery confirmation, reverse logistics, demand/inventory reconciliation, and operator-safe management workflows without semantic gaps.

**Architecture:** Keep the order header focused on business lifecycle, treat shipment, delivery, and return as separate operational facts, and promote line-level facts into explicit read models for list/detail/analytics. Build forward from the current compatibility-first foundation: `fulfilled` is the terminal order state, `delivery_status` reflects customer-facing logistics, and reverse flows are handled by return records instead of abusing `unship`.

**Tech Stack:** Cloudflare Workers + D1, Vue 3, Hono, Vitest, current order/inventory/procurement services.

---

## Current Baseline

Already in place:
- `delivered` input is compatibility-normalized to `fulfilled` on reads and now on writes.
- `orders.fulfillment_status` and `orders.delivery_status` exist.
- `order_returns` exists.
- Line actions support `reserve`, `release`, `ship`, `unship`, and `return`.
- `return` already restocks inventory, persists a return record, and exposes `returnedQuantity` in detail.
- Real API workflow coverage is green for the current return slice.

Still incomplete:
- No explicit delivery-confirmation moment separate from shipment completion.
- Return flow is single-step only; no intake/QC/restock lifecycle.
- No shipment ledger table, so multiple shipment/return cycles are only partially reconstructable from inventory events plus totals.
- Analytics, notifications, audit copy, and management screens are still in compatibility mode.
- Partial-return and post-return delivery semantics are still coarse (`returned` is set too early for some future cases).

## Recommended End State

### Domain Rules
- Order header status:
  - `pending`, `confirmed`, `production`, `shipping`, `fulfilled`, `rejected`, `void`
- Fulfillment status:
  - `unfulfilled`, `partially_fulfilled`, `fulfilled`
- Delivery status:
  - `not_shipped`, `in_transit`, `delivered`, `partially_returned`, `returned`
- Reverse logistics:
  - `unship` only before customer receipt
  - `return` only after fulfilled/delivered

### Fact Model
- Line facts remain authoritative for:
  - ordered, procured, received, reserved, shipped, returned, cancelled
- New operational records should exist for:
  - shipment records
  - delivery confirmation records
  - return records with lifecycle

### Operator UX
- Managers can see:
  - fulfillment progress
  - delivery progress
  - per-line returnable quantity
  - historical shipment/return timeline
- Dangerous actions require confirmation with reason when appropriate.

## File Map

**Backend domain and persistence**
- Modify: `functions/services/OrderLineFulfillmentService.js`
- Modify: `functions/services/InventoryService.js`
- Modify: `functions/services/InventoryProjectionService.js`
- Modify: `functions/services/DemandService.js`
- Modify: `functions/repositories/order/helpers.js`
- Modify: `functions/repositories/order/queries.js`
- Modify: `functions/repositories/order/mutations.js`
- Modify: `functions/repositories/order/sql.js`
- Modify: `functions/lib/hono/routes/manage/orders/lines.js`
- Modify: `functions/lib/hono/routes/manage/orders/detail.js`
- Modify: `functions/lib/hono/routes/manage/orders/create.js`
- Create: `functions/services/OrderReturnService.js`
- Create: `functions/services/OrderDeliveryService.js`
- Create: `functions/repositories/order/shipment-queries.js` if shipment read logic grows
- Create: `migrations/0067_order_return_lifecycle_and_delivery_confirmation.sql`
- Create: `migrations/0068_order_shipments.sql`

**Frontend state and UI**
- Modify: `src/composables/useOrders.js`
- Modify: `src/components/OrderManager.vue`
- Modify: `src/components/order/OrderDetail.vue`
- Modify: `src/components/order/OrderLinesCard.vue`
- Modify: `src/components/order/OrderLineCommandPanel.vue`
- Modify: `src/components/order/OrderStatusHeader.vue`
- Modify: `src/components/order/OrderListStatusStack.vue`
- Modify: `src/components/order/OrderDeliveryStatusBadge.vue`
- Create: `src/components/order/OrderShipmentHistoryCard.vue`
- Create: `src/components/order/OrderReturnHistoryCard.vue`
- Create: `src/components/order/OrderDeliveryConfirmDialog.vue`
- Modify: `src/locales/zh-CN/order.js`
- Modify: `src/locales/en/order.js`

**Verification**
- Modify: `functions/services/__tests__/OrderLineFulfillmentService.test.js`
- Create: `functions/services/__tests__/OrderReturnService.test.js`
- Create: `functions/services/__tests__/OrderDeliveryService.test.js`
- Modify: `functions/repositories/__tests__/order-queries.display-model.test.js`
- Modify: `functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js`
- Modify: `src/components/order/__tests__/OrderLineCommandPanel.test.js`
- Create: `src/components/order/__tests__/OrderShipmentHistoryCard.test.js`
- Create: `src/components/order/__tests__/OrderReturnHistoryCard.test.js`
- Modify: `test/order-line-fulfillment-real-api.test.js`

## Delivery Strategy

The whole closure should be executed in this order:

1. **Stabilize fact model**
- Add missing lifecycle states and explicit records before adding more UI behavior.

2. **Complete operator workflow**
- Make delivery confirmation and structured return handling available in management UI.

3. **Close downstream consumers**
- Demand, analytics, notification, and audit behavior must read the same facts.

4. **Then refine reporting**
- Partial-return, timeline detail, and dashboard summary come last.

## Phase 1: Promote Delivery Confirmation To A First-Class Step

**Business outcome:** Shipping completion and customer receipt are no longer conflated.

**Scope**
- Add `delivered_at`, `delivered_by`, `delivery_note` on orders or dedicated `order_delivery_confirmations`.
- Add management action: confirm delivered.
- Keep `fulfilled` as the terminal order state; delivery confirmation only changes `delivery_status`.

**Why first**
- Right now `delivery_status` is inferred or coarse.
- Returns after customer receipt should depend on explicit delivery confirmation.

**Acceptance**
- Managers can confirm delivery without changing order header status.
- Delivered confirmation is shown in detail and timeline.
- Return flow can distinguish “fulfilled but not confirmed delivered” vs “delivered”.

## Phase 2: Expand Return From Single-Step To Lifecycle

**Business outcome:** Return is no longer just an inventory restock shortcut.

**Scope**
- Extend `order_returns.status`:
  - `requested`, `received`, `restocked`, `cancelled`
- Support reason codes:
  - customer_refused
  - wrong_item
  - damage
  - quality_issue
  - logistics_failure
  - other
- Decide restock policy:
  - default MVP: return action both receives and restocks
  - phase-ready design: keep hooks for receive-without-restock if QC fails later

**Acceptance**
- Return records capture who, why, and when.
- `returnedQuantity` is derived from non-cancelled return records.
- Delivery status becomes:
  - `partially_returned` when some shipped qty is returned
  - `returned` when all shipped qty is returned

## Phase 3: Add Shipment Ledger

**Business outcome:** Every shipment and reverse movement becomes reconstructable.

**Scope**
- Create `order_shipments` table with:
  - id, order_id, order_line_id, variant_id, quantity, status, note, actor, timestamps
- Use shipment rows for:
  - ship
  - unship reversal linkage
  - future delivery proof / parcel tracking

**Why needed**
- Current line totals are enough for guards, but not for history, troubleshooting, or multi-batch delivery logic.

**Acceptance**
- Detail page can show shipment history.
- Future carrier tracking can attach to shipment rows without redesign.

## Phase 4: Reconcile Demand And Inventory Semantics

**Business outcome:** Procurement suggestions, shortage calculations, and available stock stay correct after returns and delivery transitions.

**Scope**
- Re-audit `DemandService`, `GoodsOverviewRepository`, purchase suggestions, and inventory projections.
- Define canonical effect table:
  - `ship`: consumes on-hand and reduces open demand
  - `unship`: restores on-hand and reopens demand only before terminal completion
  - `return`: restores on-hand but must not reopen original procurement demand automatically

**Acceptance**
- Returned stock increases availability.
- Returned lines do not incorrectly re-enter procurement demand.
- Dashboard and suggestions remain stable after return events.

## Phase 5: Finish Management UX

**Business outcome:** Operators can execute the whole chain without hidden rules.

**Scope**
- Detail page:
  - shipment history card
  - return history card
  - delivery confirmation summary
- Command panel:
  - reason-required return dialog
  - contextual help by status
- List page:
  - clearer combined header badges for order / fulfillment / delivery

**Acceptance**
- No action relies on tribal knowledge.
- Every irreversible or high-risk action has confirmation copy.

## Phase 6: Audit, Notification, And Timeline Closure

**Business outcome:** Operational events are traceable and externally visible where needed.

**Scope**
- Add domain events:
  - `order_delivery_confirmed`
  - `order_return_created`
  - `order_return_restocked`
- Update notification copy and cache invalidation.
- Timeline should show:
  - shipped
  - unshipped
  - delivered confirmed
  - returned

**Acceptance**
- Audit log and order timeline tell a complete story without reading raw DB rows.

## Phase 7: Reporting And Dashboard Closure

**Business outcome:** Management metrics reflect the real lifecycle instead of legacy status shortcuts.

**Scope**
- Dashboard cards:
  - fulfilled waiting delivery confirmation
  - delivered
  - partially returned
  - fully returned
- Order export fields:
  - fulfillment status
  - delivery status
  - returned quantity

**Acceptance**
- Ops and finance can filter/export by post-fulfillment states.

## Phase 8: Hard Cutover And Compatibility Cleanup

**Business outcome:** Legacy `delivered` compatibility path becomes explicit, bounded, and removable later.

**Scope**
- Remove remaining operator-facing “delivered order” wording where it should now mean fulfilled/delivery-confirmed.
- Add temporary telemetry/logging for legacy `delivered` input.
- Create a later cleanup ticket to remove compatibility normalization after data stabilizes.

**Acceptance**
- Runtime behavior remains backward compatible.
- Internally the team uses one vocabulary.

## Recommended Execution Waves

### Wave A: Core fact completion
- Phase 1
- Phase 2

### Wave B: History and reconciliation
- Phase 3
- Phase 4

### Wave C: Operator closure
- Phase 5
- Phase 6

### Wave D: Reporting and cleanup
- Phase 7
- Phase 8

## Risks To Manage

- **Semantic drift:** if delivery confirmation and fulfilled continue to be mixed in copy, operators will misuse actions.
- **Demand regression:** return must not silently recreate procurement demand.
- **Projection mismatch:** line totals, return history, and inventory events must agree.
- **Migration drift:** any new event type must be mirrored in both migrations and bootstrap schema.

## Recommended Definition Of Done

The business chain is only “done” when all of the following are true:
- Managers can progress: reserve → ship → fulfill → confirm delivered → return.
- `unship` is only available before terminal completion.
- Detail page shows shipped, returned, and delivery-confirmed facts.
- Inventory and demand projections remain correct after each reverse flow.
- Dashboard/export can distinguish fulfilled, delivered, partially returned, and returned.
- Real API tests cover at least:
  - full shipment then delivery confirmation
  - partial return
  - full return
  - return after delivered confirmation
  - illegal unship after fulfilled/delivered
  - procurement suggestion stability after return

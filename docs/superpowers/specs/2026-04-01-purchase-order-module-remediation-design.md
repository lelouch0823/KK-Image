# Purchase Order Module Remediation Design

**Date:** 2026-04-01

## Goal

Close the remaining logic gaps in the purchase-order module so purchase-order header status, receipt facts, shortage closure, order procurement projection, and landed-cost accounting stop disagreeing with each other.

## Scope

This spec covers:

- Hardening draft purchase-order item updates so they cannot bypass creation-time validation
- Correctly rolling back order-line projection state during receipt reversal
- Removing unsafe purchase-order header overwrites of order procurement status
- Adding an explicit shortage-closing flow for purchase-order items
- Re-basing landed-cost allocation and moving-average-cost updates on actual received quantity

This spec does not cover:

- A new settlement status model such as `partially_settled`
- A reversal workflow for shortage closure
- Replacing the receipt ledger architecture
- Reworking the full order module beyond procurement projection alignment

## Current Problems

The module already supports receipt recording and receipt reversal, and the `shipping -> arrived` gate now respects `outstanding_qty == 0`. The remaining problems are around projection integrity and business closure:

1. Draft item updates can bypass the same validation rules enforced during item creation.
2. Receipt reversal rolls back quantities but leaves some order-line display projections stale.
3. Purchase-order header transitions still write order procurement status directly, which conflicts with line-derived order truth.
4. The model supports short-shipment closure via `cancelled_qty`, but the purchase-order module does not expose an explicit command or UI path for it.
5. Cost allocation and moving-average-cost updates still use ordered quantity instead of actual received quantity.

## Approved Business Rules

### Purchase-Order Header Meaning

- `shipping` means the purchase order still has receivable quantity
- `arrived` means the purchase order has no receivable quantity left because every unit has been either physically received or explicitly closed out on the purchase-order side
- `completed` means the purchase order is already `arrived` and the settlement / cost-completion work is done

### Zero-Receipt Rule

A purchase order with zero receipts must never enter `arrived`.

If nothing was received, the purchase order must remain `shipping` until it is either:

- actually received, or
- closed through a non-arrival terminal path such as cancellation

### Shortage-Closure Rule

Shortage closure in this module is purchase-order-local.

- Closing shortage updates `purchase_order_items.cancelled_qty`
- It closes purchase-order receivable quantity
- It does not automatically close customer-order demand
- It does not automatically mutate `order_lines.cancelled_qty`

This means a purchase order can become receipt-closed while the linked customer order can still remain `ordered` or `partially_arrived` if customer demand is still unresolved.

### Order Procurement Status Rule

`orders.procurement_status` is an order-side projection and must not be inferred from a purchase-order header shortcut.

Approved behavior:

- Receipt and receipt reversal continue to derive order procurement status from `order_lines`
- Purchase-order header transitions must never force an order into `arrived`
- Purchase-order header transitions must never downgrade an order from `partially_arrived` or `arrived`
- If the system still wants to expose a pre-receipt "already procured" signal, purchase-order transitions may only seed `ordered` for untouched linked orders that are still at `none`

### Cost Basis Rule

Landed-cost allocation and moving-average-cost updates must use actual received quantity, not ordered quantity.

For this change:

- allocation quantity basis = `received_qty`
- items with `received_qty <= 0` do not contribute to per-unit landed cost
- moving-average-cost updates only run for the actually received quantity

This keeps cost and inventory math aligned with physical stock movement.

## Chosen Design

### 1. Harden Purchase-Order Item Mutation Boundaries

Draft item updates should remain limited to safe editable fields. The backend should reject `variant_id` mutation on existing purchase-order items, reload the current item, merge the editable fields, and re-run the same variant / quantity / pre-order consistency checks used by item creation.

This keeps the mutation surface small and prevents "create-valid, then patch-invalid" loopholes.

### 2. Share Projection Rules Across Receipt And Reversal Paths

The current receipt and reversal services each carry their own procurement projection helpers. The remediation should move the shared projection rules into one reusable helper module so both paths compute:

- purchase-order item display status
- order procurement status
- any quantity-derived guard values

Receipt reversal must update the same order-line state dimensions as receipt recording, including `display_status`.

### 3. Stop Using Purchase-Order Header Status As Order Arrival Truth

Purchase-order header status remains purchase-order-local. Order procurement status remains order-local.

The safe compromise is:

- when a purchase order enters `ordered` or `shipping`, it may seed linked orders to `ordered` only if they are still `none`
- when a purchase order enters `arrived`, it must not write `orders.procurement_status = 'arrived'`
- any order-side "arrived" or "partially_arrived" state continues to come only from line aggregation during receipt / reversal flows

This preserves pre-receipt visibility without letting one purchase order falsely close an entire customer order.

### 4. Add An Explicit Purchase-Order Shortage-Closure Command

The module needs a first-class command and UI for closing remaining receivable quantity on purchase-order items.

Recommended shape:

- route: batch command under the purchase-order module
- payload: `items: [{ purchase_order_item_id, cancelled_qty, note? }]`
- allowed only while the purchase order is still mutable on the receipt side
- validation: `cancelled_qty > 0` and `cancelled_qty <= remaining receivable`
- effects: increment item `cancelled_qty`, recompute item `display_status`, update purchase-order aggregate progress, emit audit / cache side effects

This feature is intentionally purchase-order-local for this phase. It is not a customer-order cancellation tool.

### 5. Rebase Allocation And MAC On Received Quantity

Settlement logic should compute per-item landed cost only across received units. Short-shipped or fully unreceived units do not enter inventory and therefore must not enter moving-average-cost math.

For `by_quantity`, divide freight / tariff across total received quantity.

For `by_value`, compute ratios using `unit_cost * received_qty`.

If total received quantity is zero, the service should skip allocation-driven MAC updates entirely.

## Data Flow

### Receipt Recording

1. Validate the receipt against remaining receivable quantity.
2. Update `purchase_order_items.received_qty` and item display status.
3. Update linked `order_lines` quantities and `display_status`.
4. Recompute linked order procurement status from line aggregates.
5. Write inventory mutations and outbox events.

### Receipt Reversal

1. Validate the original receipt and current reversal allowance.
2. Roll back `purchase_order_items.received_qty` and item display status.
3. Roll back linked `order_lines.received_qty` and recompute `display_status`.
4. Recompute linked order procurement status from line aggregates.
5. Write negative inventory mutations and reversal outbox events.

### Shortage Closure

1. Validate closure quantity against remaining purchase-order receivable quantity.
2. Increment `purchase_order_items.cancelled_qty`.
3. Recompute item display status and purchase-order aggregate progress.
4. Emit audit / cache invalidation side effects.
5. Leave customer-order quantities unchanged.

### Settlement / Completion

1. Read purchase-order items with `received_qty`.
2. Build allocation inputs only from actually received units.
3. Persist allocation results.
4. Apply moving-average-cost updates only for received units.

## Error Handling

- Item patch with forbidden fields such as `variant_id`: reject with `BadRequest`
- Item patch with quantity violating MOQ / step / pack rules: reject with `BadRequest`
- Reversal that would leave order-line projection inconsistent: reject or fail transactionally
- Shortage closure above remaining receivable quantity: reject with `BadRequest`
- Settlement with zero received quantity: return successfully without applying MAC changes

User-facing messages should describe the violated business fact, not just "invalid operation".

## Testing Strategy

The remediation should add focused tests around the exact gaps:

1. Reject invalid draft item patches that bypass create-time validation.
2. Reject `variant_id` mutation through the patch route.
3. Recompute and persist `order_lines.display_status` during receipt reversal.
4. Prevent purchase-order header transition from forcing linked orders to `arrived`.
5. Prevent purchase-order header transition from downgrading already advanced order procurement states.
6. Allow shortage closure to bring purchase-order outstanding quantity to zero without mutating customer-order cancellation quantities.
7. Block shortage closure quantities above remaining receivable quantity.
8. Allocate landed cost and update MAC using `received_qty`, not `quantity`.
9. Skip MAC updates for items with zero received quantity.

The test suite should cover service, route, composable, and Vue detail-shell layers where each rule is enforced or surfaced.

## Non-Goals

- Building a full shortage-closure ledger with reversal history
- Merging purchase-order status and order procurement status into one shared column
- Replacing the receipt ledger UI with a new workflow shell
- Reworking inventory accounting beyond quantity basis correction

## Summary

The purchase-order module should have one consistent rule set:

- purchase-order header status summarizes purchase-order-local receipt closure
- order procurement status summarizes order-line reality
- shortage closure closes purchase-order receivable quantity only
- cost accounting follows actual received stock only

This remediation is complete when those four statements are all true at the same time.

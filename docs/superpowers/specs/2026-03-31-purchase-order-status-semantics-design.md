# Purchase Order Status Semantics

**Date:** 2026-03-31

## Goal

Clarify and enforce the real business meaning of purchase-order header statuses so the system stops allowing "0 receipts but arrived" and stops conflating receipt completion with settlement completion.

## Scope

This spec covers:

- Purchase-order header status semantics for `shipping`, `arrived`, and `completed`
- The relationship between header status and receipt facts
- How shortage / short-shipment closure should affect "can arrive" decisions
- The minimum frontend and backend validation needed to enforce the semantics

This spec does not cover:

- A new settlement sub-status model such as `partially_settled`
- A new explicit shortage-closing UI flow
- Reworking the full procurement state machine

## Current Problem

The current implementation allows a purchase order to move from `shipping` to `arrived` based only on header transition rules. It does not require any receipt facts to exist, and it does not require the purchase order to have no remaining receivable quantity.

This creates two business problems:

- A purchase order can be labeled "已入库待结算" even when nothing was actually received
- Users can see receipt actions and header statuses that disagree with each other

The current read model already exposes the quantities needed to define the correct rule:

- `ordered_qty`
- `received_qty`
- `cancelled_qty`
- `outstanding_qty = ordered_qty - received_qty - cancelled_qty`

## Approved Business Rules

### Header Status Meaning

- `shipping`: there is still outstanding quantity to receive
- `arrived`: the purchase order has no outstanding quantity left to receive, meaning every unit has been either received or explicitly closed out as cancelled / short-shipped
- `completed`: the purchase order is already `arrived`, and the downstream settlement / cost-completion work is done

### Receipt Rule

A purchase order must not become `arrived` unless its aggregated outstanding quantity is zero.

Formula:

```text
outstanding_qty = ordered_qty - received_qty - cancelled_qty
```

Allowed to enter `arrived` only when:

```text
outstanding_qty <= 0
```

This means "arrived" is not "at least one receipt happened." It means the receipt side is closed.

### Zero-Receipt Rule

A purchase order with zero effective receipts must never be allowed to enter `arrived`.

If `received_qty = 0` and `cancelled_qty = 0`, then `outstanding_qty` still equals `ordered_qty`, so the purchase order must remain in `shipping`.

### Short-Shipment / Missing-Item Rule

Missing items must be handled in one of two ways:

- If the supplier will still send the missing quantity later, the purchase order remains `shipping`
- If the supplier confirms the missing quantity will not be sent, that quantity must be closed out through `cancelled_qty` or an equivalent shortage-closing path before the purchase order can enter `arrived`

This preserves a clean rule:

- `arrived` means "receipt-side closure is complete"
- It does not require every ordered unit to be physically received
- It does require every ordered unit to be accounted for

## UX Semantics

The header label `arrived` currently renders as "已入库待结算". Under this spec, that label is only valid when the purchase order no longer has receivable quantity.

The item / order progress badges should continue to reflect receipt facts independently:

- `open`: no receipt completion yet
- `partially_received`: some quantity received, but still outstanding
- `received`: no outstanding quantity remains
- `cancelled`: fully closed without receipt

The header status should not contradict these quantitative projections.

## Validation Changes

### Backend

When handling `shipping -> arrived`, the backend must verify aggregated receipt completion before allowing the transition.

Minimum validation:

1. Load the purchase order aggregate quantities
2. Compute or read `outstanding_qty`
3. Reject the transition if `outstanding_qty > 0`
4. Return a clear error explaining that the purchase order still has unreceived quantity

This validation belongs in the purchase-order status transition service, not only in the frontend.

### Frontend

The frontend should not offer `arrived` as the next status when the purchase order still has outstanding quantity.

This is a UX guard only. The backend remains the source of truth.

## Error Handling

Recommended rejection semantics for `shipping -> arrived` when receipts are incomplete:

- Error category: `BadRequest`
- User-facing message: the purchase order still has outstanding quantity and cannot be marked arrived

The exact copy can follow project tone, but it should reference remaining quantity rather than only saying "invalid status transition."

## Testing

The implementation should be driven by focused tests that prove the business boundary:

1. Reject `shipping -> arrived` when `outstanding_qty > 0`
2. Reject `shipping -> arrived` when there are zero receipts and zero cancellations
3. Allow `shipping -> arrived` when all quantity is received
4. Allow `shipping -> arrived` when the remaining quantity has been fully closed by `cancelled_qty`
5. Keep the frontend "next status" affordance hidden or disabled when the purchase order is still receivable

## Non-Goals

- Adding a new header status for "partially settled"
- Solving every procurement exception workflow in this change
- Replacing the existing receipt ledger UI

## Summary

The system should treat purchase-order header status as a summary of quantitative receipt closure, not as a shortcut that can outrun receipt facts.

The enforced rule is:

```text
arrived = outstanding_qty == 0
completed = arrived + settlement complete
```

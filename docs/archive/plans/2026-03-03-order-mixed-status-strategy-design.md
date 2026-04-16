# Order Mixed Status Strategy Design

**Date**: 2026-03-03
**Scope**: order status transitions in admin/sales flows
**Decision**: Adopt mixed strategy (`state machine by default + controlled force override`)

---

## Goals

1. Keep normal order flow deterministic and auditable.
2. Preserve emergency flexibility for privileged admins.
3. Enforce non-bypassable invariants at repository level.

## Non-Negotiable Invariants

1. Insufficient stock must block `delivered` transition.
2. Hard invariants are not bypassable by force override.
3. All force overrides require explicit reason and audit trace.

## Status Model

### Default transition graph

- `pending -> confirmed|rejected|void`
- `confirmed -> production|rejected|void`
- `production -> shipping|rejected|void`
- `shipping -> arrived|void`
- `arrived -> delivered|void`
- `rejected -> pending|void`
- `void -> pending`
- `delivered -> (none)`

### Force override

- Available only to admin users with `admin:full` or `*` permission.
- Requires non-empty reason (`note` / `reason`).
- Can bypass normal transition graph, but cannot bypass hard invariants.

## Backend Design

1. Add shared order state-machine utility in backend.
2. Enforce transition validation in repository mutation layer (`updateStatus`, `batchUpdateStatus`, `updateComposite`).
3. Route layer responsibilities:
   - Validate force permission and reason.
   - Map transition violations to HTTP 400.
   - Keep stock-related failures mapped to HTTP 400.

## Frontend Design

1. Add frontend state-machine utility mirroring backend graph.
2. `OrderStatusChanger`:
   - Identify out-of-flow selection.
   - Show force warning for out-of-flow status.
   - Require reason + explicit force confirmation.
   - Mark `void` and `delivered` as high-risk.
3. `useOrders.changeStatus` should pass `{ status, note, force }`.

## Testing Strategy

1. Repository tests:
   - Reject invalid transitions by default.
   - Allow same invalid transitions when force is enabled.
   - Keep stock guard tests green.
2. Route tests:
   - Invalid transition returns 400.
   - Force without reason returns 400.
   - Force with permission and reason succeeds.
3. Frontend tests:
   - `useOrders.changeStatus` sends `force`.
   - Out-of-flow status requires force path payload.

## Rollout Notes

1. Backward compatible for existing in-flow transitions.
2. Existing admin emergency actions remain possible via force path.
3. Monitoring focus: 400 invalid transition counts, force usage frequency.

# Order Line Fulfillment Confirmation And Unship Design

**Date:** 2026-04-13

## Problem

The order module currently mixes two different concepts:

- line-level fulfillment commands such as `reserve`, `release`, and `ship`
- header-level workflow transitions such as `delivered` and `void`

This creates two risks:

1. inventory can be mutated from both line commands and header status transitions
2. the UI executes high-impact fulfillment actions immediately, without a confirmation gate

There is also no supported reversal flow for line-level shipment. Once a line has been shipped, the system has no explicit `unship` action that restores inventory and rolls line quantities back safely.

## Goal

Introduce a safe, line-first fulfillment model with:

- explicit confirmation dialogs for `reserve`, `release`, `ship`, and `unship`
- a new `unship` command as the inverse of `ship`
- a single source of truth for inventory mutations at the order-line command layer
- workflow guards that prevent header status transitions from conflicting with line-level fulfillment facts

## Scope

This design covers:

- admin order-detail fulfillment UI
- confirmation dialog behavior for line commands
- new backend `unship` API and service behavior
- order status guardrails for `delivered` and `void`
- regression and integration test coverage

This design does not cover:

- new sales-side fulfillment flows
- multi-step approval workflows
- automatic re-reservation on shipment reversal
- warehouse-specific outbound/inbound documents

## Current Problems

1. `ship` is already a real stock-out operation at line level.
2. `delivered` still performs header-level inventory mutation logic.
3. `void` is allowed by status flow even when line shipment facts may already exist.
4. there is no supported `unship` path to reverse a partial or full line shipment.
5. the admin UI currently lets high-impact fulfillment actions fire directly, increasing operator error risk.

## Design Principles

1. Inventory facts should change in one place only.
2. Line quantities are authoritative; header workflow is projected and constrained by them.
3. Reversal should be explicit, partial-capable, and auditable.
4. High-impact fulfillment actions should require confirmation.
5. The implementation should reuse existing UI primitives and route/service patterns.

## Approach Options

### Option A: Keep inventory side effects in both line commands and header transitions

- add `unship`
- keep `delivered` inventory mutations
- attempt to reconcile both paths with extra guards

Pros:

- smaller short-term backend change

Cons:

- preserves dual-write inventory semantics
- higher risk of double deduction or incomplete rollback
- harder to reason about over time

### Option B: Make line commands the only inventory mutation path

- `reserve`, `release`, `ship`, `unship` own inventory changes
- `delivered` becomes workflow-only
- `void` is blocked until shipped quantities are fully reversed

Pros:

- one source of truth for stock movement
- clean reversal model
- consistent with the existing line-level fulfillment direction

Cons:

- requires touching status-transition validation

### Option C: Remove line-level shipment and move everything back to header status

- collapse shipment back into `delivered`
- do not add `unship`

Pros:

- fewer command endpoints

Cons:

- loses partial shipment capability
- conflicts with the existing line-level fulfillment UI and data model

## Recommended Design

Use Option B.

### 1. Fulfillment ownership model

The following commands become the only inventory-affecting fulfillment operations:

- `reserve`
- `release`
- `ship`
- `unship`

Header status transitions no longer mutate inventory directly.

### 2. Command semantics

#### `reserve`

- creates reservation against a variant-backed order line
- increases `reserved_qty`
- does not change `shipped_qty`
- does not change `on_hand`

#### `release`

- releases existing reservation
- decreases `reserved_qty`
- does not change `shipped_qty`
- does not change `on_hand`

#### `ship`

- represents real outbound stock movement
- requires `variant_id`
- increases `shipped_qty`
- consumes existing reservation up to the shipped quantity
- deducts stock with an outbound inventory mutation

#### `unship`

- represents explicit reversal of previously shipped quantity
- requires `variant_id`
- allows partial reversal up to current `shipped_qty`
- decreases `shipped_qty`
- restores stock with an inbound inventory mutation
- does not automatically recreate reservation

The no-auto-rereserve rule keeps reversal behavior simple and observable. If the operator still wants reserved stock after reversal, they can issue a separate `reserve`.

### 3. Header workflow semantics

#### `delivered`

- becomes a workflow-only status
- does not mutate inventory
- is only allowed when every effective line quantity has already been shipped

Effective line quantity means:

- `ordered_qty - cancelled_qty`

#### `void`

- remains a workflow cancellation status
- is blocked if any order line still has `shipped_qty > 0`
- requires operators to `unship` first before voiding a shipped order

This prevents line facts and header projection from diverging.

## Backend Design

### API

Add:

- `POST /api/manage/orders/:id/lines/:lineId/unship`

The route should follow the same structure as existing line commands:

- quantity parsed from JSON body
- audit event scheduled
- outbox poller scheduled
- response shape aligned with current line command endpoints

### Service

Add `OrderLineFulfillmentService.unshipLine(orderId, lineId, payload, options)`.

Validation rules:

- line must exist
- line must be variant-backed
- quantity must be positive
- quantity must not exceed current `shipped_qty`

Mutation rules:

- compute next line state with `shipped_qty - quantity`
- keep `reserved_qty` unchanged
- write a positive inventory mutation equivalent to reversing `order_shipment`
- update line projection and order touch timestamp
- emit outbox statements and command result payload

### Status transition guardrails

Update order-status writes so that:

- `delivered` performs line-level completeness validation but no inventory stock mutation
- `void` rejects orders that still have any shipped quantity

This guard should live in the same backend flow that currently validates status transitions, so it applies consistently to:

- `PATCH /api/manage/orders/:id/status`
- composite update flows that include status changes
- batch status changes where applicable

## Frontend Design

### Confirmation flow

Reuse the existing [ConfirmDialog](/home/bjw/Code/KK-Image/src/components/ui/ConfirmDialog.vue) component.

The order-detail workflow should change from:

- button click -> execute command

to:

- button click -> open confirmation dialog
- dialog confirm -> execute command

### UI structure

Keep the current single quantity input in the line command panel.

Expose four actions:

- `Reserve`
- `Release`
- `Ship`
- `Unship`

Button rules:

- `reserve` disabled when reservable quantity is 0
- `release` disabled when reserved quantity is 0
- `ship` disabled when shippable quantity is 0
- `unship` disabled when shipped quantity is 0
- all actions disabled when the line has no `variantId`

### Dialog copy

Use action-specific titles, messages, and confirm labels.

Suggested dialog types:

- `reserve`: `primary`
- `release`: `info` or `primary`
- `ship`: `warning`
- `unship`: `warning`

Dialog content should include:

- action name
- quantity
- current line identity or snapshot name where available

### Error and loading behavior

Reuse the existing order-workflow line command banners:

- command pending banner
- command error banner

If backend validation fails after confirm:

- close the dialog
- keep error feedback in the existing line-command state presentation

## Data And Status Consistency Rules

After this redesign:

- stock movement comes only from `ship` and `unship`
- reservation movement comes only from `reserve` and `release`
- `delivered` reflects that all effective quantity has been shipped
- `void` is only legal when shipped quantity is zero across the order

This removes the ambiguity where the header can claim cancellation while line-level shipped inventory still exists.

## Testing Strategy

### Service tests

Add coverage for:

1. `unshipLine` success with partial quantity
2. `unshipLine` rejection when quantity exceeds `shipped_qty`
3. `unshipLine` inventory restoration and line state recomputation
4. `shipLine` followed by `unshipLine` returns line quantities and stock to the expected state

### Route tests

Add coverage for:

1. `POST /unship` wiring
2. audit scheduling for `unship`
3. outbox poll scheduling for `unship`

### Status guard tests

Add coverage for:

1. `delivered` rejects when any effective quantity is not yet shipped
2. `delivered` no longer emits inventory stock mutations
3. `void` rejects when any line has `shipped_qty > 0`

### Frontend tests

Add coverage for:

1. each action button opens a confirmation dialog instead of executing immediately
2. confirm executes the matching composable command
3. cancel closes the dialog without execution
4. `unship` availability when `shippedQuantity > 0`
5. variant-unbound lines keep all four actions disabled

### Integration regressions

Add workflow coverage for:

1. `ship -> unship` restores stock and line projections
2. partial `ship -> delivered` is rejected
3. shipped order `-> void` is rejected until reversal
4. reserve/release/ship/unship all refresh detail state correctly

## Rollout Plan

1. Backend:
   - add `unship`
   - remove inventory mutation from `delivered`
   - add `delivered` and `void` guards
2. Frontend:
   - add confirmation flow
   - add `unship` action button and API call
3. Verification:
   - run focused service, route, component, and workflow tests

## Success Criteria

This design is successful when:

- all four line actions require confirmation in the admin detail UI
- `unship` safely reverses shipped quantity and restores inventory
- `delivered` no longer changes stock
- `void` cannot hide previously shipped stock facts
- line and header states remain consistent after shipment and reversal workflows

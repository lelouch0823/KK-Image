# Order Procurement Domain Redesign

**Date:** 2026-03-28

## Goal

Redesign the order, procurement, and inventory boundaries so the system can support partial procurement and partial receipt as first-class capabilities, while preparing a durable foundation for future partial shipment, split/merge orders, bidirectional rollback, and replayable audit/event history.

## Scope

This first phase targets:

- Multi-line order data model
- Richer order-facing fulfillment/procurement display states
- Receipt-based procurement flow
- Public-inventory-first allocation model
- Inventory events as source of truth
- Projection-based balances and order status views
- Backward-compatible migration path from current single-line orders

This first phase does not fully deliver:

- Partial shipment UX
- Split/merge order UX
- Full event-sourced read model rebuild tooling for every domain
- Time-travel recovery or arbitrary historical rollback

## Current Problems

The current module couples too many responsibilities into a small set of fields and scattered route-side effects:

- `orders.status` and `orders.procurement_status` are overloaded and do not represent line-level progress
- Inventory reservation and shipment side effects are triggered from multiple paths
- Procurement state changes and inventory projections can drift apart
- Order records are tied too closely to mutable product master data
- The model cannot express partial procurement or partial receipt cleanly

The result is a system that is difficult to reason about, difficult to roll back safely, and difficult to extend without compounding data integrity risks.

## Design Principles

1. Quantities are primary; display states are projections.
2. Inventory changes are event-first, not balance-first.
3. Procurement, receipt, allocation, reservation, and shipment are distinct concepts.
4. Product master data and order history must be separated by snapshots.
5. Order header status is an aggregate view, not the authoritative operational state.
6. The first phase should land the long-term domain boundary even if the UI exposes only part of it.

## Domain Model

### Product Master Data

Existing `products` and `product_variants` remain the current-source catalog for:

- Active/archive status
- Current titles, SKU, specs, imagery
- Current cost and purchasing metadata
- Current stock summaries

They do not serve as the historical truth for fulfilled or in-flight orders.

### Orders

Orders become a header-plus-lines model.

#### `orders`

Represents the order header:

- Customer / salesperson / channel ownership
- High-level remarks and metadata
- Display-oriented aggregate status
- Audit metadata

#### `order_lines`

Represents the real fulfillment unit. Each line stores:

- `order_id`
- `product_id`
- `variant_id`
- Snapshot fields such as product name, SKU, options/specs, image
- `ordered_qty`
- `procured_qty`
- `received_qty`
- `reserved_qty`
- `shipped_qty`
- `cancelled_qty`
- `display_status`

Each historical single-line order will migrate into exactly one `order_line`.

### Procurement

Procurement remains header-plus-items, but receipt becomes explicit.

#### `purchase_orders`

Represents procurement header metadata.

#### `purchase_order_items`

Represents ordered quantities per variant. Each item tracks:

- Ordered quantity
- Received quantity
- Cancelled quantity
- Display status

#### `purchase_receipts`

Represents each receipt event rather than collapsing receipt into one mutable cumulative field.

This enables:

- Partial receipt
- Multiple receipts for one purchase item
- Receipt reversal
- Accurate tracing from receipt to inventory and later allocation

### Allocation

Receipt and order fulfillment are connected through explicit allocation records rather than hidden status updates.

#### `order_line_allocations`

Tracks how much available inventory has been assigned to an order line. Allocation is independent from procurement ordering and receipt.

This allows:

- Public inventory to exist before assignment
- Receipt-time immediate allocation when desired
- Reallocation when priorities change
- Reversible links for future rollback

### Inventory

Inventory adopts an event-plus-projection model.

#### `inventory_events`

This becomes the source of truth for stock-affecting activity. Phase-one events include:

- `purchase_ordered`
- `purchase_received`
- `inventory_allocated_to_order_line`
- `inventory_deallocated_from_order_line`
- `inventory_reserved`
- `inventory_released`
- `order_line_cancelled`
- `inventory_adjusted_reversal`

#### `inventory_balances`

Remains as a projection for high-performance reads:

- On-hand
- Reserved
- Available
- Updated timestamps

The application should stop treating this table as the sole truth.

## State Model

### Order Header Display Status

Order header display state is derived from its lines. Candidate display states:

- `draft`
- `open`
- `partially_procured`
- `fully_procured`
- `partially_received`
- `ready_to_ship`
- `partially_shipped`
- `completed`
- `void`

These are read-model outputs, not the lowest-level operational state.

### Order Line Display Status

Order lines drive the real business meaning through quantity relationships. Candidate line states:

- `unprocured`
- `partially_procured`
- `fully_procured`
- `partially_received`
- `ready`
- `partially_shipped`
- `completed`
- `cancelled`

The line state is derived from the quantitative fields rather than manually set whenever possible.

### Purchase Item Display Status

Purchase items expose receipt progress independently:

- `open`
- `partially_received`
- `received`
- `cancelled`

### Key Rule

Procurement status changes no longer directly mutate order header status. Orders change because line quantities and allocations changed, and the display status is projected from that state.

## Inventory Flow

The operating model is public-inventory-first.

1. Procurement ordering records intent.
2. Receipt moves stock into public inventory.
3. Inventory may be allocated to order lines later.
4. Inventory may be reserved for fulfillment as a separate step.
5. Shipment will later consume from reserved stock.

Phase one may allow the UI to allocate immediately during receipt, but that is a convenience on top of the public-inventory-first model rather than a hard architectural dependency.

## Product Snapshot Policy

Order lines preserve historical truth using snapshots.

Each line stores:

- Current catalog references: `product_id`, `variant_id`
- Immutable historical fields: name, SKU, variant/spec labels, image metadata

UI behavior:

- Order views default to the historical snapshot
- The system may additionally show whether the current product has changed, been archived, or diverged from the original snapshot

Product edits remain allowed in the catalog and must not rewrite historical order content.

## Write Path Architecture

All high-risk inventory-affecting mutations should flow through one application-service boundary. Routes should stop applying inventory side effects directly.

Responsibilities of the unified service layer:

- Validate mutation preconditions
- Write domain events
- Update transactional projections
- Recompute line and header display states
- Record reversible references
- Emit audit metadata and notifications where appropriate

The system should prefer rejecting a write over accepting one that leaves inventory, procurement, and order projections inconsistent.

## Error Handling and Rollback

Phase one supports controlled reversals, not arbitrary time travel.

Supported reversal scenarios should include:

- Receipt reversal
- Allocation release
- Procurement cancellation
- Order-line cancellation

Rollbacks should be implemented by writing reversal events and replaying projection logic, not by mutating history in place.

Every reversible operation must preserve explicit lineage to the original event or allocation record.

## Migration Strategy

Use parallel migration rather than reinterpreting old columns in place.

1. Add new tables for `order_lines`, `purchase_receipts`, `order_line_allocations`, and `inventory_events`.
2. Migrate each historical order into a single order line.
3. Populate snapshot fields during migration.
4. Move new writes toward the new model.
5. Keep old read contracts working temporarily by projecting compatibility fields.
6. Remove legacy branches only after UI and API consumers have switched.

This reduces cutover risk and provides a safer rollback posture during rollout.

## API Strategy

### Compatibility

Existing endpoints stay available during the transition:

- `/api/manage/orders`
- `/api/manage/orders/:id`
- `/api/sales/:token/orders`
- `/api/manage/purchase-orders`

Responses should gradually include richer structures such as `lines`, while temporarily preserving compatibility fields like aggregate `status` and `procurementStatus`.

### New Capability Endpoints

Phase-one additions are expected around:

- Order-line creation and editing
- Receipt creation
- Allocation creation and release
- Fulfillment/procurement detail reads per order

The UI should stop inferring business truth from a single mutable header status field.

## Frontend Direction

Three management surfaces should remain distinct:

1. Product management
   Shows current catalog state and current inventory projections.
2. Order management
   Shows order header plus line-level progress and snapshots.
3. Procurement management
   Shows procurement items, receipts, and allocations.

Phase-one UI changes should focus on:

- Multi-line order detail display
- Aggregated order list statuses
- Receipt and allocation workflows inside procurement detail
- Product-page visibility into linked unfinished order lines

Phase one should not attempt every future UX at once.

## Testing Strategy

Coverage must be expanded across four layers:

1. Pure projection/unit tests
   Quantity-to-state mapping, allocation math, reversal math.
2. Service-level tests
   Receipt, allocation, reversal, and line/header projection behaviors.
3. API integration tests
   New and legacy-compatible flows, partial receipt scenarios, and transaction boundaries.
4. Replay consistency tests
   Rebuild balances and statuses from event streams and compare them with online projections.

The system should add consistency checks during rollout to detect divergence between event-driven recomputation and stored projections.

## Rollout Plan

Recommended rollout sequence:

1. Land schema additions and migration tooling.
2. Introduce unified write services and event recording.
3. Shift procurement receipt and allocation flows to the new model.
4. Shift order detail and procurement detail reads to new projections.
5. Update order list displays and compatibility fields.
6. Remove legacy side-effect branches after validation.

## Success Criteria

Phase one is successful when:

- Historical orders are safely represented as migrated single-line orders
- New data paths support partial procurement and partial receipt without status drift
- Inventory balances are derived from events and remain consistent with order/procurement projections
- Product edits no longer corrupt historical order views
- Order display states reflect line-level progress rather than ad hoc route-side mutations
- The system is structurally prepared for later partial shipment, split/merge flows, and replay tooling


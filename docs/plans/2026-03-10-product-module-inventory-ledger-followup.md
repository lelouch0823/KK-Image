# Product Module Inventory Ledger Follow-up

**Date:** 2026-03-10

## Goal

Define the P2 migration path from a single mutable `product_variants.stock_quantity` field to an inventory ledger with explicit `on_hand`, `reserved`, and `available` semantics.

## Proposed Schema

### 1. `inventory_ledger`

Append-only fact table.

Suggested columns:

- `id`
- `variant_id`
- `event_type`
- `quantity_delta`
- `reference_type`
- `reference_id`
- `occurred_at`
- `created_at`
- `metadata`

Expected `event_type` set:

- `purchase_arrival`
- `manual_adjustment`
- `order_shipment`
- `reservation_hold`
- `reservation_release`
- `inventory_correction`

### 2. `inventory_balances`

Projection table for fast reads.

Suggested columns:

- `variant_id`
- `on_hand`
- `reserved`
- `available`
- `updated_at`

Derived invariant:

- `available = max(on_hand - reserved, 0)`

### 3. Optional `inventory_reservations`

Only needed if reservation records must be independently queryable before full ledger replay is standard.

Suggested columns:

- `id`
- `order_id`
- `variant_id`
- `quantity`
- `status`
- `created_at`
- `updated_at`

## Invariants

- `inventory_ledger` is append-only. No in-place quantity rewrites.
- `on_hand` changes only from stock-affecting facts such as arrival, shipment, and adjustment.
- `reserved` changes only from demand lifecycle events such as hold and release.
- `available` is a projection, not a separately authored business fact.
- Ledger replay must be able to rebuild `inventory_balances` deterministically.

## Migration Sequencing

### Phase 1: Introduce schema without changing API contracts

- Add `inventory_ledger`.
- Add `inventory_balances`.
- Keep `product_variants.stock_quantity` as the active read/write field.

### Phase 2: Dual-write through service boundaries

- `InventoryService` writes both:
  - existing `product_variants.stock_quantity`
  - new `inventory_ledger`
- Projection updater populates `inventory_balances`.

### Phase 3: Move reads to projection

- Procurement suggestions read `inventory_balances.on_hand` and `available`.
- Demand-facing views read `reserved` and `available`.
- Keep `product_variants.stock_quantity` as compatibility shadow data.

### Phase 4: Deprecate direct stock field ownership

- Mark `product_variants.stock_quantity` as compatibility-only.
- Stop treating it as the source of truth in new code.
- Backfill any legacy report queries onto `inventory_balances`.

### Phase 5: Final cleanup

- Remove direct write paths to `product_variants.stock_quantity`.
- Either:
  - drop the column later, or
  - keep it as a denormalized projection if legacy integrations still need it.

## Compatibility Strategy

- Existing APIs can continue returning `stock_quantity` by mapping from `inventory_balances.on_hand`.
- Existing reports that only need current stock can read the projection instead of replaying the ledger.
- Existing variant payloads should not expose ledger internals until the service layer is stable.
- Order and procurement APIs can adopt `reserved` and `available` incrementally without breaking today’s response shape.

## YAGNI Guardrails

- Do not introduce batch-level cost ledger coupling in this phase.
- Do not add multi-warehouse semantics in this phase.
- Do not expose a public ledger API before internal service boundaries are stable.

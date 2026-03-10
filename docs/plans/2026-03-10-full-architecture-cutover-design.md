# Full Architecture Cutover Design

**Date:** 2026-03-10

**Goal:** Migrate the entire repository to the new product/inventory/demand architecture in a single controlled cutover, complete data migration during downtime, and remove all compatibility layers and old-architecture code paths.

---

## 1. Scope

This cutover includes all direct and indirect consumers of product, inventory, demand, procurement, and stock-derived reporting semantics.

Included modules:

- `functions/lib/hono/routes/manage/products/*`
- `functions/lib/hono/routes/manage/orders/*`
- `functions/lib/hono/routes/sales/orders.js`
- `functions/lib/hono/routes/manage/purchase-orders.js`
- `functions/lib/hono/routes/manage/goods-overview.js`
- `functions/lib/hono/routes/manage/ai.js`
- `functions/services/*` related to products, inventory, demand, purchase, AI
- `functions/repositories/*` related to product, order mutation, goods overview, purchase reporting
- `src/components/product/*`
- `src/components/order/*`
- `src/views/PurchaseOrders.vue`
- all import/export flows, tests, fixtures, and supporting docs

Excluded:

- unrelated modules with no product/inventory/demand dependency

---

## 2. Target Architecture

The target system has four explicit boundaries.

### 2.1 Product Catalog Boundary

`ProductCatalogService` becomes the only orchestration layer for:

- product create/update
- dimension/value sync
- variant sync
- variant image sync
- product validation
- catalog rollback/compensation

Routes become thin adapters for auth, request parsing, and error mapping only.

### 2.2 Inventory Boundary

`InventoryService` becomes the only inventory fact write entry point for:

- purchase arrival
- manual adjustment
- order shipment / delivery deductions
- reservation release side effects
- future correction flows

No module may directly mutate `product_variants.stock_quantity`.

### 2.3 Demand Boundary

`DemandService` becomes the only place that defines:

- when demand is created
- when demand is released
- how reserved quantity is represented
- when shipment/delivery moves from reserved semantics to stock deduction semantics

### 2.4 Ledger + Projection Boundary

Inventory source of truth moves to:

- `inventory_ledger` for append-only facts
- `inventory_balances` for read-optimized projection

Projection semantics:

- `on_hand`
- `reserved`
- `available`

Invariant:

- `available = max(on_hand - reserved, 0)`

`product_variants.stock_quantity` ceases to be a source-of-truth field.

---

## 3. Old Architecture to Remove

The cutover is not complete until the following are removed.

### 3.1 Direct stock writes

Delete all business paths that directly execute stock mutation SQL such as:

- `UPDATE product_variants SET stock_quantity ...`
- repository or route-local stock adjustment logic

### 3.2 Old catalog orchestration

Delete route-local and batch-local orchestration that duplicates:

- product validation
- product/variant sync ordering
- rollback logic
- image sync compensation

### 3.3 Old demand/shortage semantics

Delete all ad hoc shortage calculations that derive demand directly from local SQL instead of shared demand + inventory semantics.

### 3.4 Compatibility branching

Delete all temporary code that:

- supports both old and new inventory semantics
- treats `stock_quantity` as both projection and mutable fact
- conditionally falls back to legacy inventory logic

---

## 4. Data Migration Strategy

This project will use a single cutover window with downtime allowed.

### 4.1 Pre-cutover preparation

Before downtime:

- all runtime modules are refactored to depend on new service boundaries
- all old write paths remain present only until cutover branch is complete
- migration scripts are prepared but not yet applied
- verification scripts and reconciliation queries are prepared

### 4.2 Downtime sequence

During downtime:

1. freeze writes
2. apply schema migrations
3. backfill ledger from current stock state
4. derive reservation state from live orders
5. build `inventory_balances`
6. run reconciliation checks
7. enable new runtime code
8. remove old compatibility code from deployed build

### 4.3 Initial backfill model

Starting point:

- current `product_variants.stock_quantity` seeds `inventory_balances.on_hand`
- active order states seed `reserved`
- existing procurement history seeds ledger arrival facts only where needed for audit continuity

This is sufficient for operational correctness. Full historical replay is optional if not needed for launch.

---

## 5. Module Migration Requirements

### 5.1 Products

- move `manage/products/batch.js` to `ProductCatalogService`
- remove any route-local variant rollback logic
- stop exposing existing-variant stock as editable catalog authority

### 5.2 Orders

- move all order stock side effects behind `InventoryService`
- move all demand side effects behind `DemandService`
- remove direct stock mutation in `repositories/order/mutations.js`

### 5.3 Procurement

- ensure purchase arrivals use `InventoryService`
- ensure purchase suggestions read demand + balances projection
- preserve moving-average-cost behavior while separating it from stock truth ownership

### 5.4 Reporting and Query Modules

- `GoodsOverviewRepository` must read new demand/inventory semantics
- AI routes must stop reading legacy shortage semantics
- frontend views must consume `on_hand / reserved / available` or mapped equivalents

### 5.5 Import/Export

- import flows must stop authoring existing inventory as mutable fact
- export flows must read projection-backed values

---

## 6. Testing Requirements

Three gates are required.

### 6.1 Migration correctness

- per-variant stock reconciliation
- per-variant reservation reconciliation
- projection replay validation
- procurement impact reconciliation
- cutover runbook executed in downtime order
- rollback trigger points documented before launch

### 6.2 Behavioral correctness

- product CRUD
- product batch import/export
- order create/edit/status/batch
- procurement create/status/suggestions
- goods overview
- AI management flows
- sales-side product binding and stock display

### 6.3 Deletion completeness

Repository-wide checks must confirm there are no remaining:

- direct business writes to `stock_quantity`
- legacy shortage SQL paths
- old batch product orchestration
- dual-path compatibility branches

---

## 7. Rollback Strategy

Rollback must be defined before implementation starts.

Allowed rollback shape:

- restore pre-cutover database snapshot
- redeploy pre-cutover runtime

Not allowed:

- partially rolling back only one domain boundary while leaving others on the new schema

This cutover is atomic at the deployment level.

---

## 8. Success Criteria

The cutover is complete only when all of the following are true:

- all in-scope modules run through the new service boundaries
- `inventory_ledger` and `inventory_balances` are authoritative
- all compatibility layers are deleted
- all targeted test suites pass
- migration reconciliation passes
- the repository no longer contains old-architecture write paths

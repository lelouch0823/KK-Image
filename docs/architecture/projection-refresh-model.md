# Projection Refresh Model

This document records the current source of truth for product, inventory, and demand projections.

## Projection Tables

- `product_projection`
  - aggregates active variant price, cost, stock, available stock, alert threshold, and active variant count per product
  - backs product list status, stock filters, and sales product availability
- `variant_demand_projection`
  - aggregates active order demand per variant
  - backs goods overview and replenishment decisions
- `variant_snapshot_projection`
  - stores denormalized variant/product snapshot data for high-volume goods overview and export paths

## Product Projection

`ProductProjectionRefreshService` is the shared refresh path for product-level projection changes.

It delegates to `ProductProjectionRepository`, which:

- removes empty ids
- deduplicates repeated product or variant ids
- resolves variant ids to product ids
- refreshes `product_projection` in D1-sized chunks

Current product status in product reads is derived from the projection:

```sql
CASE
  WHEN COALESCE(pp.active_variant_count, 0) > 0 THEN 'active'
  ELSE 'archived'
END AS status
```

Do not treat `products.status` as the current product lifecycle source of truth. A product is active for list, filter, and sales visibility purposes when it has at least one active variant in `product_projection`.

## Product Projection Refresh Triggers

Current direct refresh triggers include:

- product create, patch, put, import, and archive flows through `ProductCatalogService` or product route handlers
- dimension archive flows that archive or merge affected variants
- batch variant status changes in `/api/manage/products/batch/status`
- inventory mutations through `InventoryService.applyMutation` and `InventoryService.applyBatch`
- order demand reservation transitions through `DemandService.syncOrderTransition`
- purchase receipts and reversals that change inventory or linked order-line progress

When a command knows variant ids, refresh through `refreshByVariantIds(...)`; when it knows product ids directly, refresh through `refreshByProductIds(...)` or `refreshByProductId(...)`.

## Product Cache Events

Product cache invalidation is outbox-driven.

`functions/lib/hono/routes/manage/products/cache-helpers.js` publishes cache-only product domain events whose payload includes:

- `product_id` for a single affected product
- `product_ids` for all affected products

Product writes that only change metadata or media still publish product cache events even when the projection values do not change. Batch variant status updates must publish product ids, not just variant ids, so the cache consumer can invalidate product, space, and sales read models consistently.

## Variant Demand Projection

`VariantDemandProjectionRefreshService` is the synchronous entry point for variant demand projection refreshes.

It:

- accepts affected variant ids
- removes empty ids
- deduplicates repeated ids in the same command
- delegates one batched refresh call to `VariantDemandProjectionRepository`

Current flows that refresh through this path:

- `OrderLineFulfillmentService.shipLine`
- `OrderLineFulfillmentService.unshipLine`
- `OrderProcurementDomainService.recordPurchaseOrderReceipts`
- `OrderProcurementReceiptReversalService.reverseReceipt`
- `PurchaseOrderShortageClosureService.closeShortages`

Flows that intentionally do not refresh variant demand here:

- line reserve/release commands, because they change order-line allocation state but not demand semantics
- order-status demand refreshes already handled by `DemandService`

## Maintenance Rule

Projection refresh ownership should stay narrow and visible. New write paths that change product variant status, inventory balance, order demand, purchase receipt state, or product import/update state must either call the shared refresh service directly or document why an existing service already refreshes the affected projection. New write paths that only change product metadata or media should still publish the product cache event.

# Projection Refresh Model

## Shared Refresh Path

`VariantDemandProjectionRefreshService` is now the synchronous entry point for variant demand projection refreshes.

It:

- accepts affected variant ids
- removes empty ids
- deduplicates repeated ids in the same command
- delegates one batched refresh call to `VariantDemandProjectionRepository`

## Flows That Refresh Through This Path

- `OrderLineFulfillmentService.shipLine`
- `OrderLineFulfillmentService.unshipLine`
- `OrderProcurementDomainService.recordPurchaseOrderReceipts`
- `OrderProcurementReceiptReversalService.reverseReceipt`
- `PurchaseOrderShortageClosureService.closeShortages`

## Flows That Intentionally Do Not Refresh Here

- line reserve/release commands, because they change reservation state but not demand semantics
- order-status demand refreshes already handled by `DemandService`

The goal is to keep projection-refresh ownership narrow and visible instead of scattering direct repository writes across multiple command services.

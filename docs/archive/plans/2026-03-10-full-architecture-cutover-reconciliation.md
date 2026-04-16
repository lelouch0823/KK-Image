# Full Architecture Cutover Reconciliation

## Stock Reconciliation

Purpose: confirm on-hand projection matches the seeded stock baseline.

Example query:

```sql
SELECT
  pv.id AS variant_id,
  pv.stock_quantity AS legacy_stock_quantity,
  COALESCE(ib.on_hand, 0) AS projected_on_hand
FROM product_variants pv
LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
WHERE COALESCE(pv.stock_quantity, 0) != COALESCE(ib.on_hand, 0);
```

Pass criteria: zero rows.

## Reservation Reconciliation

Purpose: confirm reserved projection matches active order demand.

Example query:

```sql
SELECT
  o.variant_id,
  COALESCE(SUM(o.quantity), 0) AS active_order_qty,
  COALESCE(MAX(ib.reserved), 0) AS projected_reserved
FROM orders o
LEFT JOIN inventory_balances ib ON ib.variant_id = o.variant_id
WHERE o.status IN ('confirmed', 'production', 'shipping')
  AND o.variant_id IS NOT NULL
GROUP BY o.variant_id
HAVING COALESCE(SUM(o.quantity), 0) != COALESCE(MAX(ib.reserved), 0);
```

Pass criteria: zero rows.

## Procurement Reconciliation

Purpose: confirm procurement suggestion shortage uses projected availability.

Check:

- sample the top shortage variants from `PurchaseOrderService.getSuggestions()`
- verify `shortage = max(total_demand - available, 0)`
- verify `available = max(on_hand - reserved, 0)`

Pass criteria: sampled rows match projection math and no negative available values appear.

## Ledger Replay Reconciliation

Purpose: confirm balances can be rebuilt from ledger rows deterministically.

Check:

- replay ledger rows grouped by variant
- compare replayed `on_hand`, `reserved`, and `available` to `inventory_balances`

Pass criteria: zero mismatches.

## Cutover Gate

Cutover passes only if:

- stock reconciliation returns zero rows
- reservation reconciliation returns zero rows
- procurement spot checks match projection math
- ledger replay matches `inventory_balances`

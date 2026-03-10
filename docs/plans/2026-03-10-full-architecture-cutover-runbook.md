# Full Architecture Cutover Runbook

## Pre-Cutover Checks

- confirm application deploy is pinned to the cutover commit set
- confirm write traffic can be paused for the cutover window
- confirm latest database snapshot exists and restore procedure is tested
- confirm `0050_inventory_ledger.sql` is ready to apply
- confirm ledger backfill and reconciliation scripts are available
- confirm target verification suites are green on the release candidate

## Downtime Sequence

1. disable write access for admin and sales order/product/procurement flows
2. take a final pre-cutover database snapshot
3. apply `migrations/0050_inventory_ledger.sql`
4. run ledger backfill from current variant stock state
5. derive reservation ledger rows from active orders
6. populate `inventory_balances`
7. run reconciliation checks
8. deploy the cutover runtime
9. re-enable write traffic

## Migration Commands

```bash
pnpm db:migrate:preview
node scripts/inventory/backfill_ledger.js
node scripts/inventory/reconcile_balances.js
```

Use the production migration target instead of preview during the live cutover window.

## Validation Sequence

1. verify reconciliation output has no mismatches
2. verify targeted backend architecture suites pass
3. verify targeted frontend suites pass
4. smoke test product list/detail, sales binding, order delivery, procurement suggestions, and goods overview
5. run deletion tests to confirm legacy write and shortage paths are gone

## Rollback Triggers

- migration application fails
- reconciliation reports mismatched balances
- order delivery or procurement suggestion smoke tests fail
- deletion tests or architecture suites fail after deploy

## Rollback

1. keep write traffic disabled
2. restore the pre-cutover database snapshot
3. redeploy the pre-cutover runtime
4. verify legacy runtime health before reopening writes

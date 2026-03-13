# Operation Audit Coverage Baseline

Date: 2026-03-13

## Admin P0 route coverage

- `functions/lib/hono/routes/manage/orders/detail.js`
- `functions/lib/hono/routes/manage/customers.js`
- `functions/lib/hono/routes/manage/files.js`
- `functions/lib/hono/routes/manage/products/index.js`
- `functions/lib/hono/routes/manage/products/[id].js`
- `functions/lib/hono/routes/v1/users.js`
- `functions/lib/hono/routes/manage/settings.js`
- `functions/lib/hono/routes/manage/salespersons.js`
- `functions/lib/hono/routes/manage/purchase-orders.js`
- `functions/lib/hono/routes/manage/notifications.js`
- `functions/lib/hono/routes/manage/folders.js`
- `functions/lib/hono/routes/manage/backups.js`
- `functions/lib/hono/routes/manage/spaces/crud.js`
- `functions/lib/hono/routes/manage/spaces/files.js`

## Sales critical route coverage

- `functions/lib/hono/routes/sales/orders.js`
- `functions/lib/hono/routes/sales/files.js`
- `functions/lib/hono/routes/sales/auth.js`

## Guardrail

Run:

```bash
node scripts/qa/check-audit-route-coverage.mjs
```

Expected:

```text
Audit coverage OK (14 files checked)
```

## Phase 2 Notes

- Coverage script now uses write-route extraction plus route audit declarations.
- Non-mutating exploratory POST endpoints are explicitly excluded instead of being silently ignored.
- Sales-side route declarations exist, but current hard gate still focuses on the admin high-risk set.

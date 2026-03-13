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
Audit coverage OK
```

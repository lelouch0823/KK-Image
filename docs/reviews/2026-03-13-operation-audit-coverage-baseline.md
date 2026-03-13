# Operation Audit Coverage Baseline

Date: 2026-03-13

## Current guardrail baseline

Run:

```bash
node scripts/qa/check-audit-route-coverage.mjs
```

Expected:

```text
Audit coverage OK (32 files checked)
```

The current baseline is built from extracted write routes under:

- `functions/lib/hono/routes/manage`
- `functions/lib/hono/routes/sales`
- `functions/lib/hono/routes/v1`

The script reports `32 files checked` because it scans every route file that contains at least one write route, including `functions/lib/hono/routes/manage/ai.js`, whose write endpoints are all intentionally excluded from the main audit ledger.

The coverage script now validates:

- every discovered mutating route has a declaration unless it is explicitly excluded
- every declaration still maps to a discovered route
- visible `scheduleAuditEvent(...)` literals still match declaration `action`, `domain`, `targetType`, and `severity`
- excluded non-mutating POST routes come from a shared registry instead of a script-local magic-string set

## Covered mutating route groups

These route files are currently part of the mutating-route inventory checked by the audit coverage script:

- `functions/lib/hono/routes/manage/albums.js`
- `functions/lib/hono/routes/manage/backups.js`
- `functions/lib/hono/routes/manage/customers.js`
- `functions/lib/hono/routes/manage/files.js`
- `functions/lib/hono/routes/manage/folders.js`
- `functions/lib/hono/routes/manage/notifications.js`
- `functions/lib/hono/routes/manage/orders/create.js`
- `functions/lib/hono/routes/manage/orders/detail.js`
- `functions/lib/hono/routes/manage/products/[id].js`
- `functions/lib/hono/routes/manage/products/batch.js`
- `functions/lib/hono/routes/manage/products/index.js`
- `functions/lib/hono/routes/manage/purchase-orders.js`
- `functions/lib/hono/routes/manage/salespersons.js`
- `functions/lib/hono/routes/manage/settings.js`
- `functions/lib/hono/routes/manage/spaces/crud.js`
- `functions/lib/hono/routes/manage/spaces/files.js`
- `functions/lib/hono/routes/manage/spaces/subspaces.js`
- `functions/lib/hono/routes/manage/tags.js`
- `functions/lib/hono/routes/manage/trash.js`
- `functions/lib/hono/routes/manage/upload.js`
- `functions/lib/hono/routes/sales/auth.js`
- `functions/lib/hono/routes/sales/files.js`
- `functions/lib/hono/routes/sales/notifications.js`
- `functions/lib/hono/routes/sales/orders.js`
- `functions/lib/hono/routes/sales/profile.js`
- `functions/lib/hono/routes/v1/auth.js`
- `functions/lib/hono/routes/v1/files.js`
- `functions/lib/hono/routes/v1/folders.js`
- `functions/lib/hono/routes/v1/permissions.js`
- `functions/lib/hono/routes/v1/users.js`
- `functions/lib/hono/routes/v1/webhooks.js`

## Intentionally excluded non-mutating POST routes

These routes are intentionally kept outside the main operation audit ledger and are now registered in `functions/lib/hono/_shared/audit-route-exclusions.js` with explicit reason metadata:

- `POST /:id/dimensions/impact` — non-mutating impact preview for dimension changes
- `POST /ai/models` — non-mutating AI connectivity and model discovery probe
- `POST /ai/test` — non-mutating AI configuration verification endpoint
- `POST /check-hash` — non-mutating upload deduplication preflight check
- `POST /chat` — non-mutating AI chat interaction outside the operation audit ledger
- `POST /report` — non-mutating AI report generation request
- `POST /stream` — non-mutating AI streaming interaction outside the operation audit ledger
- `POST /check` — non-mutating health or validation probe

## Behavior-level assertions added in P0 hardening

Route-level audit behavior assertions now exist for these representative write surfaces:

- `functions/lib/hono/routes/manage/albums.js`
- `functions/lib/hono/routes/manage/upload.js`
- `functions/lib/hono/routes/manage/folders.js`
- `functions/lib/hono/routes/manage/notifications.js`
- `functions/lib/hono/routes/manage/backups.js`
- `functions/lib/hono/routes/manage/tags.js`
- `functions/lib/hono/routes/manage/trash.js`
- `functions/lib/hono/routes/manage/orders/create.js`
- `functions/lib/hono/routes/manage/products/batch.js`
- `functions/lib/hono/routes/manage/spaces/subspaces.js`
- `functions/lib/hono/routes/sales/notifications.js`
- `functions/lib/hono/routes/sales/profile.js`
- `functions/lib/hono/routes/v1/files.js`
- `functions/lib/hono/routes/v1/folders.js`
- `functions/lib/hono/routes/v1/webhooks.js`

Existing behavior-level audit assertions also remain in place for previously covered surfaces such as:

- `functions/lib/hono/routes/manage/orders/detail.js`
- `functions/lib/hono/routes/manage/purchase-orders.js`
- `functions/lib/hono/routes/sales/orders.js`
- `functions/lib/hono/routes/sales/files.js`
- `functions/lib/hono/routes/sales/auth.js`
- `functions/lib/hono/_shared/auth-helpers.js`

## Deferred runtime-semantic checks

The current P0 baseline proves declaration presence and visible source alignment. The following route groups are still primarily protected by declaration/coverage checks and should move to runtime emitted-event assertions in `P1.1`:

- remaining admin write groups not yet covered by focused route assertions
- denied-write and failed-write representative paths across admin, sales, and `v1`
- declaration-to-runtime parity for `result`, `severity`, and target metadata on representative create/update/delete flows

## Notes

- `P0.2` migration cleanup is effectively complete in active route code: `logAudit(...)` only remains in the legacy utility and its direct unit tests, not in live Hono route handlers.
- This baseline is inventory-oriented. It does not yet prove full runtime-emitted event parity for every declared route.

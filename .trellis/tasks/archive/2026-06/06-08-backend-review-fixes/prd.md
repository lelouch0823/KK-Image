# brainstorm: 修复后端审查问题

## Goal

Fix the backend issues found by the parallel code review, prioritizing startup-blocking, security, authorization, and data-consistency defects so the Cloudflare/Hono backend is loadable, safer against SSRF/token exposure, and covered by regression tests.

## What I already know

* The backend is a Cloudflare Pages Functions / Workers app using Hono, D1, R2/KV, OPA authz, and mixed JS/TS backend modules under `functions/`.
* The current dirty worktree before this task only contains unrelated frontend utility changes:
  * `src/utils/__tests__/dashboard-charts.test.js`
  * `src/utils/dashboard-charts.ts`
* Four review agents found issues across module loading, upload/file proxy security, AI action authorization, D1 schema drift, order/procurement concurrency, payment math, audit logging, webhook/ERP SSRF controls, and token exposure.
* The main session confirmed these high-risk findings:
  * `node --input-type=module -e "import('./functions/lib/hono/app.js')"` fails on `NotificationRepository.js`.
  * `node --input-type=module -e "import('./functions/api/cron/outbox.js')"` fails on `NotificationRepository.js`.
  * Upload handling trusts caller-provided `contentHash` and file serving proxies `http(s)` `storage_key` values.
  * AI salesperson action lacks `requiredPermission`, and the AI route only requires `stats:read`.
  * `scripts/init-database.sql` omits `failed` from `command_idempotency.status`.
  * Order-line fulfillment CAS statements run after side effects and inspect `changes` rather than `meta.changes`.
  * Payment code treats `orders.quantity` as order amount.
  * Salesperson listing/detail exposes `accessToken` to `users:read`.
  * Error handler calls `shouldAuditRequest()` without the request path.

## Assumptions

* "All issues" means all Critical, Important, and Minor findings from the review report unless a fix proves obsolete or technically incorrect during implementation.
* Fixes should be incremental and regression-tested where practical.
* Existing public seeded external image behavior should not justify allowing arbitrary `http(s)` storage keys created through authenticated upload.
* Unrelated frontend utility changes must be preserved.

## Open Questions

None currently blocking. If a reviewed item proves to require product policy input, pause only that item and continue independent fixes.

## Requirements

* Restore backend module loadability for the Hono app and outbox cron entry.
* Add smoke coverage to catch missing backend imports.
* Prevent uploaded files from using caller-controlled arbitrary hash/storage keys.
* Prevent URL-shaped uploaded storage keys from being proxied as same-origin content.
* Require write-grade permission for AI actions that create salespeople and guard all write actions from missing permission metadata.
* Sync bootstrap schema with current migration behavior for command idempotency failed status.
* Fix or guard procurement/order fulfillment concurrency checks so side effects cannot commit before a failed optimistic guard.
* Make payment receivable calculations use actual order monetary totals rather than item quantity.
* Remove salesperson `accessToken` from low-privilege read responses.
* Harden SSRF-sensitive URL handling for ERP, webhooks, and AI config tests.
* Add resource limits/timeouts to ERP sync loops and external calls where missing.
* Ensure failed audit logging sees the request path.
* Ensure archived orders and soft-deleted files are consistently excluded from ordinary public/sales/reporting views.
* Fix public JSON parse errors to return stable 400 responses.
* Add or update targeted tests for each changed behavior.

## Acceptance Criteria

* [ ] `functions/lib/hono/app.js` imports successfully in a backend smoke test.
* [ ] `functions/api/cron/outbox.js` imports successfully in a backend smoke test.
* [ ] Upload tests reject non-SHA-256 `contentHash` / `originalHash` values and cannot create URL storage keys.
* [ ] File proxy tests cover safe handling of URL-shaped storage keys or assert they are not reachable through upload-created records.
* [ ] AI salesperson creation requires `users:write`, and write-action adapters without `requiredPermission` are rejected by tests.
* [ ] Bootstrap schema allows `command_idempotency.status = 'failed'`.
* [ ] Order/procurement concurrency tests fail before side effects or assert guarded batch behavior.
* [ ] Payment tests prove order amount is not derived from `orders.quantity`.
* [ ] Salesperson list/detail tests prove `accessToken` is not returned to `users:read` responses.
* [ ] URL security tests cover localhost/private/redirect behavior in production and allowed dev/test cases.
* [ ] ERP sync tests cover max page/item/duration limits.
* [ ] Failed audit test covers high-risk GET path audit logging.
* [ ] Public share password JSON parse errors return 400.
* [ ] Focused backend tests pass.
* [ ] Lint/type/smoke checks relevant to backend pass or any remaining known baseline failures are documented.

## Definition of Done

* Tests added/updated before production fixes where feasible.
* Focused unit/integration tests green.
* Backend import smoke checks green.
* No unrelated frontend changes reverted.
* Any broad or risky leftover work is documented with exact file references.

## Out of Scope

* Rewriting the full backend module system beyond what is required to restore loadability.
* Broad UI redesign or frontend dashboard work.
* Remote deployment or database migration execution.

## Technical Notes

* Key backend paths:
  * `functions/lib/hono/`
  * `functions/api/`
  * `functions/file/`
  * `functions/services/`
  * `functions/repositories/`
  * `migrations/`
  * `scripts/init-database.sql`
* Current package scripts include `lint`, `test`, `test:unit:run`, many targeted backend tests, and `test:audit`.
* `package.json` currently lacks a general backend typecheck script; module-load smoke tests are needed because many JS imports cross TS repository boundaries.

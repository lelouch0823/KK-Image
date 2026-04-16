# 2026-04-15 Severe Issues Closure Note

## Status

- Verification scope completed for severe issues remediation plan.
- User-approved residual risk remains on issues `03` and `04`: folder / space share passwords are still stored in plaintext at rest.
- All other severe issues in the register have regression coverage or rollout verification evidence below.

## Issue Mapping

| Issue | Closure Evidence |
| --- | --- |
| 01 | `functions/api/utils/__tests__/id.test.js`, `functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js`, `functions/lib/hono/routes/v1/__tests__/users-permissions-validation.test.js` |
| 02 | `functions/api/utils/__tests__/id.test.js`, `functions/lib/hono/routes/manage/__tests__/salespersons-routes.test.js` (write path), `test/sales-real-api-utils.test.js` |
| 03 | Accepted residual risk by user scope override. Transport / exposure hardening covered by `functions/api/gallery/__tests__/public-gallery-access.test.js`. |
| 04 | Accepted residual risk by user scope override. Transport / exposure hardening covered by `functions/api/space/__tests__/public-space-access.test.js`. |
| 05 | `functions/api/gallery/__tests__/public-gallery-access.test.js` |
| 06 | `functions/api/gallery/__tests__/public-gallery-access.test.js`, `test/folders-real-api.test.js` |
| 07 | `functions/api/gallery/__tests__/public-gallery-access.test.js` |
| 08 | `functions/api/space/__tests__/public-space-access.test.js`, `functions/lib/hono/middleware/__tests__/public-share-rate-limit.test.js` |
| 09 | `functions/lib/hono/routes/v1/__tests__/auth-me-context.test.js` |
| 10 | `functions/lib/hono/middleware/__tests__/rateLimit.test.js` |
| 11 | `functions/lib/hono/middleware/__tests__/rateLimit.test.js` |
| 12 | `functions/api/utils/__tests__/cron-auth.test.js`, `scripts/deploy-check.js` verification via `pnpm deploy:check` |
| 13 | `functions/file/__tests__/file-access.test.js`, `pnpm qa:check-direct-protected-fetch` |
| 14 | `functions/file/__tests__/file-access.test.js` |
| 15 | `functions/file/__tests__/file-access.test.js`, `pnpm qa:check-direct-protected-fetch` |
| 16 | `functions/api/utils/__tests__/file-utils-dup.test.js`, `functions/lib/hono/routes/manage/__tests__/upload-route.test.js`, `test/uploads-real-api.test.js` |
| 17 | `functions/file/__tests__/file-access.test.js`, `test/uploads-real-api.test.js` |
| 18 | `functions/lib/hono/routes/v1/__tests__/file-folder-audit-routes.test.js`, `functions/lib/hono/routes/v1/__tests__/permissions-contract.test.js`, `test/v1-files-folders.test.js` |
| 19 | `functions/lib/hono/routes/v1/__tests__/file-folder-audit-routes.test.js`, `functions/lib/hono/routes/v1/__tests__/permissions-contract.test.js`, `test/v1-files-folders.test.js` |
| 20 | `functions/lib/hono/routes/v1/__tests__/file-folder-audit-routes.test.js`, `test/v1-files-folders.test.js` |
| 21 | `functions/lib/hono/routes/v1/__tests__/file-folder-audit-routes.test.js`, `functions/lib/hono/routes/v1/__tests__/permissions-contract.test.js`, `test/v1-files-folders.test.js` |
| 22 | `functions/lib/hono/routes/v1/__tests__/file-folder-audit-routes.test.js`, `functions/lib/hono/routes/v1/__tests__/permissions-contract.test.js`, `test/v1-files-folders.test.js` |
| 23 | `functions/repositories/__tests__/WebhookRepository.test.js`, `functions/lib/hono/routes/manage/__tests__/webhooks-routes.test.js`, `test/webhooks-real-api.test.js` |
| 24 | `functions/lib/hono/routes/v1/__tests__/webhooks-routes.test.js`, `test/webhooks-real-api.test.js` |
| 25 | `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`, `functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js`, `functions/ai/__tests__/action-service.test.js` |
| 26 | `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`, `functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js`, `functions/ai/__tests__/action-service.test.js` |
| 27 | `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`, `functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js`, `functions/ai/__tests__/action-submitters.test.js` |
| 28 | `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`, `functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js`, `functions/ai/__tests__/action-submitters.test.js` |
| 29 | `functions/lib/hono/routes/sales/__tests__/files-routes.test.js`, `test/sales-real-api-utils.test.js` |
| 30 | `functions/lib/hono/routes/sales/__tests__/order-create-folder-archive.test.js`, `functions/repositories/__tests__/order-mutations.test.js`, `test/sales-real-api-utils.test.js` |

## Final Verification Snapshot

- Focused unit suites: `25` files passed, `1` intentionally skipped real-API-gated file.
- Policy / QA guards: `OPA policy tests PASS`, `qa:check-direct-protected-fetch PASS`.
- Real API regression slice: `test/folders-real-api.test.js`, `test/uploads-real-api.test.js`, `test/webhooks-real-api.test.js` all passed.
- Build / rollout gate: `pnpm build && pnpm deploy:check` passed.

# brainstorm: 前端自动化冒烟审查

## Goal

Use automated browser scripts to exercise the running frontend and validate core workflows after the recent backend fixes. Focus on whether key pages load and whether business operations such as product creation/deletion, salesperson creation, and order creation work end-to-end.

## What I already know

* The user wants the project started and frontend pages exercised with automation.
* The user specifically called out product create/delete, salesperson create, and order create.
* The project has Vite frontend, Hono/Cloudflare-style backend routes, Vitest tests, and existing real-api scripts.

## Assumptions

* Prefer non-destructive or self-cleaning test data where possible.
* Use the local running server if available; otherwise start the dev server.
* Use Playwright or available browser automation from the local dependency set.
* Report both functional failures and obvious frontend console/network errors.

## Requirements

* Confirm the app is reachable.
* Log in or establish an authenticated session using local dev credentials/patterns.
* Visit major admin pages and sales-facing pages.
* Exercise product create/delete.
* Exercise salesperson create.
* Exercise order create.
* Capture console errors, failed network requests, screenshots, and exact reproduction notes for failures.

## Acceptance Criteria

* [x] Automation can reach the frontend.
* [x] Authentication path is verified or blocker documented.
* [x] Product create/delete flow is tested.
* [x] Salesperson create flow is tested.
* [x] Order create flow is tested.
* [x] Additional major pages are smoke-tested for load/console/network failures.
* [x] Findings are summarized with commands, URLs, and artifacts.

## Definition of Done

* Automated checks run against local frontend.
* Any generated test data is cleaned up when feasible.
* Screenshots/traces/logs are saved outside the repo or under task artifacts if useful.
* No production code changes unless a verified bug requires a fix and the user approves continuing into implementation.

## Out of Scope

* Full exhaustive E2E suite authoring.
* Remote production testing.
* Changing business logic during the initial audit.

## Technical Notes

* Tested frontend URL: `http://127.0.0.1:3000`.
* Vite proxies API calls to the Wrangler/API process on `http://127.0.0.1:8080`; direct SPA routes such as `http://127.0.0.1:8080/login` return 404.
* Auth credentials used for local automation: `ADMIN_USER=admin ADMIN_PASS=123`.
* Product `DELETE /api/manage/products/:id` is a soft-delete/archive operation. The backend returns `Product variants archived`; the product entity can still be found by management product search, so smoke verification checks that the UI sends a successful DELETE and `/api/manage/products/variants` no longer returns active variants for the created SPU.
* Repeated fast page sweeps can trigger local API rate limiting (`429`) on some admin endpoints. The final core workflow run skipped full page smoke with `SMOKE_SKIP_PAGE_SMOKE=1` and used the earlier successful 20-route page sweep as route coverage evidence.
* Fixed follow-up issues from the smoke review:
  * Product import automation now targets the real `Select` roles (`combobox` and `option`) and waits for the refreshed product list before opening detail.
  * Batch product import refreshes `product_projection` for successful product ids, so replaced price/stock values are visible after import.
  * Purchase-order picker flow now searches the global active-variant rows and waits for the variant search response.
  * Purchase-order detail numeric edits normalize `quantity` / `unit_cost` before PATCH and force-refresh the detail snapshot when reopened.
  * Recorded Vue warnings were fixed by adding missing imports/props, icon support, and route title locale keys.
  * Full repository lint errors were cleared. The remaining lint output is warning-only and `pnpm lint` exits successfully.

## Execution Results

* Existing command attempted: `ADMIN_BASE_URL=http://127.0.0.1:3000 ADMIN_USER=admin ADMIN_PASS=123 HEADLESS=1 pnpm qa:admin-flows`.
  * Result: failed at product CSV import mapping (`product-import-spec-column-0` timeout).
* Extended page and workflow command:
  * `ADMIN_BASE_URL=http://127.0.0.1:3000 ADMIN_USER=admin ADMIN_PASS=123 HEADLESS=1 node .trellis/tasks/06-08-frontend-automation-smoke-review/artifacts/extended-admin-smoke.cjs`
  * First useful page sweep artifact: `.trellis/tasks/06-08-frontend-automation-smoke-review/artifacts/run-1780851930774/report.json`
  * Result: login passed; 20 admin routes loaded without error fallback; `/admin/forbidden` correctly rendered permission denied state.
* Final focused core workflow command:
  * `SMOKE_SKIP_PAGE_SMOKE=1 ADMIN_BASE_URL=http://127.0.0.1:3000 ADMIN_USER=admin ADMIN_PASS=123 HEADLESS=1 node .trellis/tasks/06-08-frontend-automation-smoke-review/artifacts/extended-admin-smoke.cjs`
  * Final artifact: `.trellis/tasks/06-08-frontend-automation-smoke-review/artifacts/run-1780853133755/report.json`
  * Result: 6 passed, 0 failed.
  * Passed steps: login, product create through UI, product soft-delete/archive through UI, salesperson create through UI, order create through UI, order cleanup plus salesperson delete through UI.

## Findings

* Core workflows passed in the final focused run.
* Follow-up fix verification:
  * `ADMIN_BASE_URL=http://127.0.0.1:3000 ADMIN_USER=admin ADMIN_PASS=123 HEADLESS=1 pnpm qa:admin-flows` now passes and returns `success: true`.
  * Targeted unit tests pass for QA script helpers, `AppInput`, `Select`, purchase-order detail shell, and product catalog import boundaries.
  * Targeted ESLint for changed files passes.
  * Full `pnpm lint` passes with 0 errors and warning-only output.
  * `pnpm build` passes; it only reports the existing Browserslist data age warning.
* Fixed console warning sources:
  * `EmptyState` now accepts `chart-bar` and `chart-pie`.
  * `ProductTable` imports `AppIcon`.
  * FileManager imports/props/events cover `AppIcon`, `AppButton`, `selectedIds`, and mobile card selection.
  * `router.reminders` and `router.forbidden` locale keys exist in zh-CN and en.
* Final report includes expected or non-blocking network noise:
  * Initial unauthenticated `/api/v1/auth/me` returned `401` before login.
  * Some polling/list requests were `net::ERR_ABORTED` during route changes.
  * Notification fetch logged `Failed to fetch` once during teardown/navigation.

# brainstorm: backend logic review fixes

## Goal

Fix confirmed backend logic/security issues found by the multi-agent backend review, prioritizing trust-boundary leaks, authorization bypasses, archived-order write safety, projection/cache consistency, and regression coverage.

## What I already know

* User requested a full review, development plan, and implementation after review.
* Six subagents reviewed API routes, order fulfillment, product/currency/cache logic, security, tests, and architecture.
* Backend spec already requires PBKDF2 share password storage, strict product projection refresh before cache invalidation, typed client validation errors, and archived-order write guards.
* Existing working tree already has many uncommitted backend/frontend changes; edits must avoid reverting unrelated work.

## Confirmed Problems

### Implement in this task

* AI chat/stream routes require only `stats:read` while AI tools can read orders/customers/products/purchase-order data.
* `GET /api/manage/settings` caches secret-bearing settings with public cache headers.
* Folder create/update writes share passwords as plaintext, bypassing the PBKDF2 storage contract.
* AI order creation directly calls `OrderCreationService.createManagedOrder`, bypassing route-side file archiving.
* Managed order creation swallows demand-sync failures after order persistence.
* Order line fulfillment writes can race with order archiving because the active-order guard is only on the initial read.
* `shipLine` can release global reserved inventory for quantities not reserved by the line.
* Product projection refresh failures are treated as best-effort before cache invalidation.
* Space projections treat archived products as active because product status is hard-coded to `NULL`.
* Upload hash validation and malformed JSON in some routes return 500 instead of 400.
* `toNonNegativeInt` can return `Infinity`.
* Product filter cache is not invalidated by product changes.
* `draft` product status is accepted but reads back as archived.

### Plan, but defer schema-heavy implementation unless explicitly continued

* Historical order amount uses current `product_variants.price` because `order_lines` does not snapshot unit price/currency.
* Multi-currency order totals directly add values without conversion.
* Payment balance checks should move to atomic SQL/minor-unit money handling; this overlaps the money model fix.

## Requirements

* Fix security issues without weakening existing route-level auth.
* Preserve existing public response shapes unless the response is currently unsafe.
* Add regression tests before production code changes where practical.
* Avoid broad refactors unrelated to confirmed defects.
* For schema-heavy money fixes, document exact migration/contract work and avoid half-migrating data.

## Acceptance Criteria

* [ ] Viewer/stats-only users cannot execute AI tools requiring stronger read/manage permissions.
* [ ] Settings responses are never public-cacheable.
* [ ] Folder create/update stores new share passwords as PBKDF2 records when pepper exists.
* [ ] AI order creation archives attached files through the same env/folder utilities as manage order creation.
* [ ] Demand sync failures after order create propagate or produce recoverable partial-result behavior.
* [ ] Order line fulfillment batches assert parent order is still active before side effects.
* [ ] Shipping only releases reservations actually owned by the line.
* [ ] Product projection refresh can be strict in mutation paths before cache invalidation.
* [ ] Space product projections do not surface archived products as active.
* [ ] Client-caused invalid hash/JSON errors return 400.
* [ ] `toNonNegativeInt` returns finite non-negative integers only.
* [ ] Product filter cache URLs are included in product invalidation.
* [ ] Product `draft` is either removed from accepted route contracts or implemented as a real readable state.
* [ ] Money snapshot/multi-currency migration plan is documented with tests to expose current failure.

## Definition of Done

* Targeted tests pass for modified backend areas.
* Backend module-load smoke passes.
* No unrelated dirty files are reverted.
* Trellis task context is updated.

## Out of Scope

* Full historical money migration and frontend display changes for multi-currency orders in this immediate implementation pass.
* Running full real API suite unless targeted backend tests indicate the need.

## Technical Notes

* Relevant spec: `.trellis/spec/backend/quality-guidelines.md`.
* Relevant files include:
  * `functions/lib/hono/routes/manage/ai.js`
  * `functions/services/AIService.js`
  * `functions/services/ai-tool-orchestrator.js`
  * `functions/utils/ai-tool-executor.js`
  * `functions/lib/hono/routes/manage/settings.js`
  * `functions/lib/hono/routes/manage/folders.js`
  * `functions/services/OrderCreationService.js`
  * `functions/services/OrderLineFulfillmentService/*`
  * `functions/services/ProductProjectionRefreshService.js`
  * `functions/repositories/SpaceRepository.js`
  * `functions/api/space/[token].js`
  * `functions/api/utils/file-utils.js`
  * `functions/api/utils/number.js`

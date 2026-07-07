# fix: full test suite regressions

## Goal

Run the full local quality and test matrix, including real API profiles, and fix any regressions required for the suite to pass.

## What I already know

* `pnpm exec vue-tsc --noEmit -p tsconfig.json` passed.
* `pnpm lint` passed with existing warnings only.
* `pnpm build` passed.
* `pnpm check:minisales`, `pnpm authz:policy:test`, and `pnpm sdk:build` passed.
* `pnpm test` failed 9 assertions across 4 files:
  * `src/components/__tests__/table-wrap-migrations.test.js`
  * `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
  * `src/components/order/__tests__/OrderStatusChanger.force-flow.test.js`
  * `src/components/order/__tests__/OrderStatusHeader.test.js`

## Requirements

* Fix root causes for the current full-suite failures without broad refactors.
* Preserve current product behavior unless tests expose a stale expectation.
* Re-run focused failing suites, then the full verification matrix.

## Acceptance Criteria

* [x] Focused failing suites pass.
* [x] Root `pnpm test` passes.
* [x] Real API test profiles pass.
* [x] E2E test suite passes or any environment blocker is clearly identified.
* [x] Working tree status is reported at the end.

## Verification

* Focused failing suites passed after fixes.
* `pnpm lint` passed with existing warnings only.
* `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.json` passed.
* `pnpm build` passed.
* `pnpm check:minisales` passed.
* `pnpm authz:policy:test` passed.
* `pnpm sdk:build` passed.
* `pnpm test` passed.
* `pnpm test:real-api:fast` passed: 18 files, 43 tests.
* `pnpm test:e2e` passed: 6 tests.

## Out of Scope

* Unrelated lint warning cleanup.
* Feature changes outside the current test failures.

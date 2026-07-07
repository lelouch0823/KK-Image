# Frontend Review Remediation Plan

## Goal

Fix all confirmed findings from the comprehensive frontend review while keeping changes scoped and verifiable.

## Constraints

- Keep Vue SFC scripts plain JavaScript unless the repo ESLint stack is changed in the same patch.
- Do not refactor unrelated frontend modules.
- Add focused tests or QA guard updates where changed behavior is high-risk.
- Preserve existing public API contracts unless a finding requires a narrow contract change.

## Task 1: Restore root frontend type safety

Files to inspect and likely modify:

- `src/composables/useResource.ts`
- `src/composables/product-import/useImportParsing.ts`
- `src/utils/import-validators.ts`
- `src/composables/useStatsCharts.ts`
- `package.json`

Plan:

1. Import `ResourceItem`, `ApiResponse`, and `PaginationMeta` as real local type bindings in `useResource.ts` while preserving exported type surface.
2. Add narrow product-import row/object types so mapped rows are not inferred as `{}`.
3. Type `sanitizeMappedRow()` enough for callers to access normalized fields without unsafe `{}` inference.
4. Remove or replace the invalid Chart.js `grid.opacity` option.
5. Add a root typecheck script such as `typecheck:frontend` and optionally include it in the relevant check command.

Verification:

- `pnpm exec vue-tsc --noEmit -p tsconfig.json`
- Focused existing tests for product import and chart helpers.

## Task 2: Fix request timeout and protected fetch consistency

Files to inspect and likely modify:

- `src/utils/http-core.ts`
- `src/composables/useAuth.ts`
- `src/components/product/PriceRuleManager.vue`
- `src/composables/__tests__/useAuth.test.js`
- Existing tests near `PriceRuleManager` if available, or add focused coverage.

Plan:

1. Preserve `request()` timeout behavior when callers pass a signal by composing caller abort and timeout abort instead of disabling timeout.
2. Keep logout/global abort semantics for `authFetch`.
3. Migrate `PriceRuleManager.vue` protected calls to `authFetch` / `authFetchJson`.
4. Ensure 401 handling still clears auth state.

Verification:

- `pnpm qa:check-direct-protected-fetch`
- `pnpm exec vitest run src/composables/__tests__/useAuth.test.js`
- Relevant product manager / price rule tests or a new focused test.

## Task 3: Fix global notification polling ownership

Files to inspect and likely modify:

- `src/composables/useNotifications.ts`
- `src/components/layout/Header.vue`
- `src/components/common/NotificationList.vue`
- `src/views/Sales.vue`
- `src/composables/__tests__/useNotifications.test.js`
- `src/composables/__tests__/useNotifications.refresh-bus.test.js`

Plan:

1. Prevent passive `useNotifications()` consumers from stopping a poller they did not start.
2. Keep Header/admin and Sales portal able to start and stop their own polling.
3. Avoid duplicate intervals and keep existing permission-denied stop behavior.
4. Add a regression test for transient consumer unmount behavior if feasible.

Verification:

- Focused notification composable tests.
- `pnpm test:unit:run src`

## Task 4: Harden PWA API runtime caching

Files to inspect and likely modify:

- `vite.config.js`
- Existing PWA/config tests if present, or add a narrow config assertion test.

Plan:

1. Stop caching private `/api/*` responses by default.
2. Cache only explicitly public, safe endpoints if needed, or remove the broad API runtime cache entirely.
3. Keep static file caching behavior for `/file/*` only if it does not expose private files across sessions; otherwise narrow it too.

Verification:

- `pnpm build`
- Focused config/unit check if added.

## Task 5: Centralize safe new-tab opening

Files to inspect and likely modify:

- `src/utils/` for an existing browser/url helper.
- `src/views/FileManager/index.vue`
- `src/components/SpaceDetailModal.vue`
- `src/components/SpaceProductEditor.vue`
- `src/components/common/AIChatWidget.vue`
- `src/composables/order/useOrderBatch.ts`
- `src/components/order/ProductBindingSection.vue`

Plan:

1. Search existing helpers before adding a new utility.
2. If no helper exists, create a small browser helper for `window.open(url, '_blank', 'noopener,noreferrer')` and explicitly null `opener` when a window handle is returned.
3. Update direct new-tab open callsites and add `rel="noopener noreferrer"` on anchors.
4. Keep same user-facing behavior.

Verification:

- Focused unit tests for the helper if created.
- `pnpm exec eslint src`

## Final Verification

Run these before completion:

- `pnpm exec eslint src`
- `pnpm exec vue-tsc --noEmit -p tsconfig.json`
- `pnpm qa:check-direct-protected-fetch`
- `pnpm qa:check-design-system`
- `pnpm test:unit:run src`
- `pnpm build`
- `pnpm check:minisales`

Report any command that cannot be run with the exact blocker.

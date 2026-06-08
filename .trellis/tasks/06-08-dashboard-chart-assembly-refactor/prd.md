# brainstorm: Dashboard 图表装配重构

## Goal

Reduce Dashboard chart assembly cost by moving data normalization, theme color resolution, and Chart.js configuration construction out of `Dashboard.vue` into focused, tested utilities. The Dashboard view should keep API state, canvas refs, and Chart instance lifecycle only.

## What I Already Know

* The user requested an independent development plan and completion for the Dashboard chart function assembly refactor.
* `src/views/Dashboard.vue` currently mixes API data updates, status label mapping, color token parsing, Chart.js config objects, and Chart instance lifecycle in one SFC.
* The template only renders `salesTrendChart` and `statusDistributionChart`; the old `chart1` through `chart4` setup/update code no longer has matching canvas elements.
* `src/utils/display-labels.ts` already provides `formatOrderStatusLabel`, so Dashboard should not maintain another order-status label map.
* `src/utils/chart-setup.ts` is the shared Chart.js registration entrypoint.

## Assumptions

* This is a maintainability refactor, not a visual redesign.
* Existing Dashboard API response shape remains unchanged.
* Hidden / stale chart setup for removed canvases can be deleted if it has no visible UI surface.

## Requirements

* Extract Dashboard chart data shaping and Chart.js config construction to a utility module.
* Reuse shared order status display labels instead of Dashboard-local status label maps.
* Preserve the current visible Dashboard chart behavior: sales trend line chart and status distribution doughnut chart.
* Keep Chart.js instance creation, DOM refs, and destroy lifecycle in `Dashboard.vue`.
* Add focused unit tests for chart data/config helpers.

## Acceptance Criteria

* [x] `Dashboard.vue` no longer contains large inline Chart.js config objects or duplicate status label maps.
* [x] Sales trend chart labels and values are generated through tested helpers.
* [x] Status distribution labels use `formatOrderStatusLabel` and unknown statuses degrade to readable labels.
* [x] Dashboard chart palette/color helpers handle CSS tokens, hex/rgb values, and fallbacks.
* [x] Unit tests cover the new chart helper module.
* [x] Targeted tests, lint, and build pass.

## Definition of Done

* Tests added/updated for the refactor.
* `pnpm test:unit:run` targeted test files pass.
* `pnpm lint` passes.
* `pnpm build` passes.
* Changes are ready for commit after verification.

## Out of Scope

* Backend Dashboard API changes.
* Adding new chart types or changing Dashboard layout.
* Refactoring the full Stats page chart assembly in this task.

## Technical Notes

* Relevant files inspected:
  * `src/views/Dashboard.vue`
  * `src/utils/chart-setup.ts`
  * `src/utils/display-labels.ts`
  * `src/utils/status.ts`
  * `src/design-system/toneContract.ts`
  * `src/views/__tests__/Dashboard.order-detail-workflow.test.js`
  * `src/utils/__tests__/chart-setup.test.js`
* Frontend spec constraints:
  * Keep `.vue` scripts as plain JavaScript syntax because current ESLint config does not parse TypeScript SFC syntax.
  * Add focused formatter/config tests when moving user-facing display logic.

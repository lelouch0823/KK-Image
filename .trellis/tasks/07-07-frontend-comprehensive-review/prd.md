# review: frontend comprehensive audit

## Goal

Comprehensively review the current root frontend codebase for correctness, maintainability, spec compliance, design-system consistency, and test/build health, then remediate every confirmed finding from the review. The final output should include actionable fixes, verification evidence, and any residual risks.

## What I already know

* User requested a comprehensive frontend review.
* User then requested an implementation plan and for all reviewed issues to be fixed.
* Project is a Vue 3/Vite admin and sales frontend with shared components, composables, design-system utilities, and extensive unit tests.
* The review is scoped to the current root workspace, not historical `.worktrees/` copies.
* Frontend Trellis specs currently emphasize admin feature manifest centralization, JavaScript-only Vue SFC scripts under the current ESLint stack, friendly audit/operational labels, and tested Chart.js config helper assembly.
* Confirmed review findings to fix:
  * Root `vue-tsc --noEmit -p tsconfig.json` fails due to type-only imports used as local names, product-import mapped row typing, import-validator row typing, and an invalid Chart.js grid option.
  * Global notification polling can be stopped by any `useNotifications()` caller that unmounts.
  * PWA runtime caching currently caches all `/api/*` responses, including private user/admin data.
  * `authFetch` always supplies a signal, which disables the default `request()` timeout path.
  * `PriceRuleManager.vue` directly calls protected `/api/manage/*` endpoints and fails `pnpm qa:check-direct-protected-fetch`.
  * Several new-tab openings omit `noopener` / `noreferrer`.

## Assumptions

* This task began as a review/audit task; remediation is now in scope because the user explicitly requested it.
* Findings should be ordered by severity and include reproducible evidence.
* Full frontend health includes static checks plus targeted source inspection; unavailable or failing commands should be reported.

## Requirements

* Inspect frontend structure, configuration, routing, shared UI, composables, views, and high-risk domain flows.
* Check compliance with `.trellis/spec/frontend/` guidance.
* Run or attempt relevant frontend validation commands: lint, unit tests, build, and design-system QA where practical.
* Look for correctness bugs, stale contracts, duplicate route/navigation metadata, raw backend codes in UI, unsafe request/auth patterns, and test gaps.
* Produce a code-review style report: findings first, ordered by severity, with file/line references.
* Implement fixes for every confirmed finding listed above.
* Add or update focused tests/QA guards for changed behavior where practical.
* Preserve existing design-system conventions and avoid broad unrelated refactors.

## Acceptance Criteria

* [ ] Frontend source and config structure has been mapped.
* [ ] Static checks have been run or explicitly reported as blocked.
* [ ] High-risk frontend paths have been inspected with evidence.
* [ ] Findings include severity, impact, and file/line references.
* [ ] Any residual risk or test gaps are clearly stated.
* [ ] Root `pnpm exec vue-tsc --noEmit -p tsconfig.json` passes or any remaining failure is explicitly justified.
* [ ] `pnpm qa:check-direct-protected-fetch` passes.
* [ ] `authFetch` retains global logout abort behavior while preserving request timeouts.
* [ ] Notification polling remains active while the owner that started it is mounted, and transient `useNotifications()` consumers cannot stop it.
* [ ] PWA caching no longer stores private `/api/*` user/admin responses.
* [ ] New-tab open paths consistently use `noopener` / `noreferrer` semantics.

## Definition of Done

* All confirmed frontend review findings are fixed.
* Review notes are grounded in current repository state.
* Trellis task files capture the review scope for follow-up work.
* Relevant verification commands are run and recorded in the final report.

## Out of Scope

* Reviewing archived docs as source of truth.
* Reviewing `.worktrees/` historical copies.
* Exhaustive visual QA in a browser unless a specific UI defect requires it.

## Technical Notes

* Package scripts of interest: `pnpm exec eslint src`, `pnpm test:unit:run src`, `pnpm exec vue-tsc --noEmit -p tsconfig.json`, `pnpm qa:check-direct-protected-fetch`, `pnpm build`, `pnpm qa:check-design-system`, `pnpm check:minisales`.
* Existing frontend docs include `docs/architecture/modules/frontend-components.md`, `docs/architecture/modules/frontend-composables.md`, `docs/architecture/modules/frontend-views.md`, and design-system docs under `docs/design-system/`.

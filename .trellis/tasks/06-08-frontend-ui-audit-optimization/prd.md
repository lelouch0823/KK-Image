# brainstorm: Frontend UI Audit Optimization

## Goal

Audit the existing frontend UI across layout, design-system usage, interaction states, responsiveness, accessibility, and visual consistency, then apply focused improvements that preserve the current information architecture and product workflows.

## Design Read

Reading this as an existing internal management product UI for operational users, with a restrained product-interface language, leaning toward targeted evolution of the current Vue/Tailwind design system rather than a marketing-page redesign.

Dial values:

- DESIGN_VARIANCE: 3-4
- MOTION_INTENSITY: 2-3
- VISUAL_DENSITY: 7-8

## What I Already Know

- The frontend is Vue 3 + Vite + Tailwind v4.
- The project already has a design-system ownership model:
  `src/styles/tokens/*` -> `src/components/ui/*` -> `src/design-system/composed/*` -> `src/design-system/patterns/*` -> domain pages.
- Existing docs require semantic tokens, shared UI primitives, shared page shells, `AppIcon`, and shared status/tone contracts.
- Existing QA checks pass:
  - `pnpm qa:check-ui-token-integrity`
  - `pnpm qa:check-ui-foundation-usage`
- This is an operational admin/product UI, so the applicable part of `design-taste-frontend` is audit-first redesign discipline, contrast/state/responsive checks, and avoiding visual gimmicks. The landing-page image/hero guidance is out of scope.

## Audit Findings

- `src/layouts/AdminLayout.vue` uses `h-screen`, which can cause mobile viewport height jumps. The shell should use dynamic viewport units.
- `src/components/layout/Header.vue` closes the mobile search overlay by clearing the shared search query even though the inline comment says to keep it. This can surprise users when dismissing the overlay.
- A few production UI files still contain raw SVG glyphs outside the shared `AppIcon` entry point. Current QA allowlists do not cover every one of these files.
- Some components still use direct window scroll listeners for product UI behavior. Some are acceptable event listeners, but scroll-driven UI should be reviewed carefully and moved to container-based or composable patterns where appropriate.
- The existing page shell migration is strong: most dashboard and management pages already consume `DashboardShell` or `ManagementListShell`.

## Assumptions

- Preserve route structure, nav labels, form order, and workflows.
- Prefer improving shared primitives and shell behavior over one-off page styling.
- Do not introduce a new design system or icon family.
- Treat public viewer and mobile sales surfaces as separate UI patterns with existing shell ownership.

## Requirements

- Maintain design-system QA checks.
- Improve UI stability and interaction consistency without changing business behavior.
- Keep all edits within current Vue/Tailwind design-system conventions.
- Avoid local visual primitives when a shared primitive exists.
- Record larger audit items for later instead of expanding this task into a broad redesign.

## Acceptance Criteria

- [x] Admin shell no longer depends on `h-screen`.
- [x] Closing mobile search does not unexpectedly clear the shared search query.
- [x] Raw decorative/product SVGs touched in this task are replaced with `AppIcon`.
- [x] Existing design-system QA still passes.
- [x] Unit/build verification is run for the changed scope.

## Out of Scope

- Route or IA changes.
- Rewriting dashboard/table page layouts wholesale.
- Introducing new third-party UI libraries.
- Replacing all remaining raw inputs/selects across the app.
- Reworking every scroll listener in the product.
- Public marketing/landing-page visual overhaul.

## Technical Notes

- Design-system docs inspected:
  - `docs/design-system/MASTER.md`
  - `docs/design-system/foundations.md`
  - `docs/design-system/patterns.md`
  - `docs/design-system/typography.md`
  - `docs/design-system/status-tone-contract.md`
- Code inspected:
  - `src/layouts/AdminLayout.vue`
  - `src/components/layout/Header.vue`
  - `src/components/layout/Sidebar.vue`
  - `src/design-system/patterns/DashboardShell.vue`
  - `src/design-system/patterns/ManagementListShell.vue`
  - `src/components/ui/AppButton.vue`
  - `src/components/ui/AppCard.vue`
- Baseline QA:
  - `pnpm qa:check-design-system` passes before implementation.
- Final verification:
  - `pnpm test:unit:run src/components/__tests__/Header.notification-mode.test.js` passes.
  - `pnpm qa:check-design-system` passes.
  - `pnpm build` passes.
  - `pnpm lint` exits 0 with existing warnings.
  - `pnpm exec vue-tsc --noEmit -p tsconfig.json` passes.
  - Playwright visual smoke against `http://127.0.0.1:3000` passes for `/login` and auth-mocked `/admin/dashboard` with no console errors or horizontal overflow.
- Typecheck follow-up fixes:
  - `src/composables/order/useOrderBatch.ts` now declares printable optional order fields explicitly.
  - `src/composables/useCategories.ts` now satisfies the shared `ResourceItem` constraint.
  - `src/composables/useCommandPalette.ts` now allows router navigation actions that resolve to router result values.
- Visual artifacts:
  - `artifacts/login-desktop.png`
  - `artifacts/admin-dashboard-desktop.png`

## Definition of Done

- Tests added or updated if behavior changes require coverage.
- Design-system QA passes.
- Build or focused unit tests pass.
- Changes summarized with any residual audit risks.

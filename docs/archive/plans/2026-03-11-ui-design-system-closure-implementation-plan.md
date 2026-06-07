# UI Design System Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the frontend design system into a gradual closed loop across tokens, shared components, page patterns, and governance without rewriting business functionality.

**Architecture:** First repair and restructure the design core so tokens, foundation components, composed components, and page shells are dependable. Then migrate four high-impact demonstration pages to validate the system. Finally roll the new system through the remaining modules while adding lint and documentation safeguards to prevent regression.

**Tech Stack:** Vue 3, Tailwind CSS v4, Vite, Vitest, ESLint, CSS custom properties, existing `src/components/ui` and `src/styles` architecture

---

### Task 1: Lock the current UI debt into an inventory document

**Files:**

- Create: `docs/plans/2026-03-11-ui-design-system-migration-checklist.md`
- Modify: `docs/plans/2026-03-11-ui-design-system-closure-design.md`

**Step 1: Write the migration inventory skeleton**

Create sections for:

- token debt
- foundation component debt
- composed component gaps
- page-pattern candidates
- module migration status

**Step 2: Record the current high-risk UI debt**

List at minimum:

- undefined token aliases
- multiple icon systems
- inconsistent typography families
- duplicated modal patterns
- duplicated stat/list/filter implementations

**Step 3: Review the inventory for scope discipline**

Keep only actionable migration items. Remove cosmetic commentary that does not affect implementation sequencing.

**Step 4: Commit**

```bash
git add docs/plans/2026-03-11-ui-design-system-migration-checklist.md docs/plans/2026-03-11-ui-design-system-closure-design.md
git commit -m "docs(ui): add design system migration inventory"
```

### Task 2: Restructure style files into explicit token layers

**Files:**

- Create: `src/styles/tokens/primitive.css`
- Create: `src/styles/tokens/semantic.css`
- Create: `src/styles/tokens/motion.css`
- Create: `src/styles/tokens/charts.css`
- Create: `src/styles/tokens/themes.css`
- Modify: `src/styles/main.css`
- Modify: `src/styles/variables.css`
- Test: `src/composables/__tests__/useTheme.test.js`

**Step 1: Write a failing token contract test or snapshot**

Add a focused test or style snapshot assertion that checks the theme entry points expose the expected token file imports and do not rely on undefined token names.

**Step 2: Run the focused test to verify failure**

Run: `pnpm test:unit src/composables/__tests__/useTheme.test.js`
Expected: FAIL or reveal missing imports/legacy token assumptions after the new assertions are added.

**Step 3: Create primitive and semantic token files**

Move visual primitives out of `variables.css` into explicit token layers and define semantic aliases for:

- surfaces
- text roles
- border roles
- action roles
- status roles
- focus rings
- overlay layers

**Step 4: Move motion and chart values into dedicated token files**

Create dedicated files for transition timing, easing, and chart colors so they are not mixed into general surface tokens.

**Step 5: Update main style entrypoints**

Ensure `main.css` imports the new token files in a stable order and remains the single runtime theme entry.

**Step 6: Run the focused test again**

Run: `pnpm test:unit src/composables/__tests__/useTheme.test.js`
Expected: PASS

**Step 7: Commit**

```bash
git add src/styles/tokens/primitive.css src/styles/tokens/semantic.css src/styles/tokens/motion.css src/styles/tokens/charts.css src/styles/tokens/themes.css src/styles/main.css src/styles/variables.css src/composables/__tests__/useTheme.test.js
git commit -m "refactor(ui): split theme tokens into explicit layers"
```

### Task 3: Remove undefined and pseudo token references

**Files:**

- Modify: `src/components/ui/AppButton.vue`
- Modify: `src/components/ui/AppInput.vue`
- Modify: `src/components/ui/AppStatCard.vue`
- Modify: `src/components/common/AIChatWidget.vue`
- Modify: `src/components/common/NotificationList.vue`
- Modify: `src/components/order/OrderList.vue`
- Modify: `src/views/Stats.vue`
- Modify: `src/views/stats/StatsChartWrapper.vue`

**Step 1: Add a failing audit script or test expectation**

Add a targeted test or script assertion that no production UI files contain known invalid tokens such as:

- `varinfo`
- `varsuccess`
- `vardanger`
- `varwarning`
- `--bg-input`
- `--bg-subtle`
- `--text-quaternary`
- `--bg-card-hover`
- `--color-danger-hover`

**Step 2: Run the audit to verify failure**

Run: `rg -n "varinfo|varsuccess|vardanger|varwarning|--bg-input|--bg-subtle|--text-quaternary|--bg-card-hover|--color-danger-hover" src`
Expected: multiple matches

**Step 3: Replace invalid references with semantic tokens**

Update each file to use valid semantic tokens introduced in Task 2. Do not introduce new hardcoded color values.

**Step 4: Re-run the audit**

Run: `rg -n "varinfo|varsuccess|vardanger|varwarning|--bg-input|--bg-subtle|--text-quaternary|--bg-card-hover|--color-danger-hover" src`
Expected: no matches

**Step 5: Run targeted UI tests**

Run: `pnpm test:unit src/components/ui/__tests__/AppImage.test.js src/components/ui/__tests__/Tooltip.test.js src/composables/__tests__/useTheme.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/ui/AppButton.vue src/components/ui/AppInput.vue src/components/ui/AppStatCard.vue src/components/common/AIChatWidget.vue src/components/common/NotificationList.vue src/components/order/OrderList.vue src/views/Stats.vue src/views/stats/StatsChartWrapper.vue
git commit -m "fix(ui): replace invalid token references with semantic tokens"
```

### Task 4: Standardize typography and icon policy

**Files:**

- Modify: `src/styles/main.css`
- Modify: `src/components/ui/AppIcon.vue`
- Modify: `src/views/Dashboard.vue`
- Modify: `src/components/product/ProductOptionsBuilder.vue`
- Modify: additional UI files still using `material-symbols-outlined`
- Create: `docs/design-system/typography.md`
- Create: `docs/design-system/iconography.md`

**Step 1: Add a failing grep-based audit for typography and icon drift**

Run:

```bash
rg -n "material-symbols-outlined|font-\\[|font-display|Outfit" src
```

Expected: multiple matches in production files.

**Step 2: Define typography rules in documentation**

Document:

- primary UI sans
- mono usage policy
- forbidden page-local font families

**Step 3: Define icon rules in documentation**

Document:

- `AppIcon` as the single icon entry point
- sizing rules
- deprecation of Material Symbols in shared page UI

**Step 4: Migrate the first wave of high-visibility icon offenders**

Replace Material Symbols usage in dashboard and other top-level pages with `AppIcon`.

**Step 5: Re-run the audit**

Run:

```bash
rg -n "material-symbols-outlined|font-display|Outfit" src/views/Dashboard.vue src/components/product/ProductOptionsBuilder.vue src/views/Stats.vue
```

Expected: no matches in first-wave target files

**Step 6: Commit**

```bash
git add src/styles/main.css src/components/ui/AppIcon.vue src/views/Dashboard.vue src/components/product/ProductOptionsBuilder.vue docs/design-system/typography.md docs/design-system/iconography.md
git commit -m "refactor(ui): standardize typography and icon policy"
```

### Task 5: Rebuild foundation components v1

**Files:**

- Modify: `src/components/ui/AppButton.vue`
- Modify: `src/components/ui/AppInput.vue`
- Modify: `src/components/ui/Select.vue`
- Modify: `src/components/ui/AppCard.vue`
- Modify: `src/components/ui/AppTable.vue`
- Modify: `src/components/ui/Modal.vue`
- Modify: `src/components/ui/ConfirmDialog.vue`
- Modify: `src/components/ui/EmptyState.vue`
- Modify: `src/components/ui/PermissionDeniedState.vue`
- Create: `src/components/ui/__tests__/AppButton.design-contract.test.js`
- Create: `src/components/ui/__tests__/AppInput.design-contract.test.js`
- Create: `src/components/ui/__tests__/Modal.design-contract.test.js`

**Step 1: Write failing design-contract tests**

Cover:

- semantic token usage
- visible focus states
- consistent variant contracts
- no undefined token references
- stable dark-mode class behavior

**Step 2: Run the focused tests to verify failure**

Run: `pnpm test:unit src/components/ui/__tests__/AppButton.design-contract.test.js src/components/ui/__tests__/AppInput.design-contract.test.js src/components/ui/__tests__/Modal.design-contract.test.js`
Expected: FAIL

**Step 3: Rebuild button and input contracts**

Ensure:

- variants map only to valid semantic tokens
- focus behavior is consistent
- disabled/loading states are standardized

**Step 4: Rebuild card, table, and modal contracts**

Ensure:

- surfaces and borders are derived from semantic tokens
- modal backdrops and containers no longer vary by file
- table headers, row hover, and empty states follow shared rules

**Step 5: Rebuild empty, error, and permission state hierarchy**

Ensure these states share one visual family with severity-based differentiation instead of unrelated custom styles.

**Step 6: Run the design-contract tests again**

Run: `pnpm test:unit src/components/ui/__tests__/AppButton.design-contract.test.js src/components/ui/__tests__/AppInput.design-contract.test.js src/components/ui/__tests__/Modal.design-contract.test.js`
Expected: PASS

**Step 7: Run adjacent shared-component tests**

Run: `pnpm test:unit src/components/ui/__tests__/Tooltip.test.js src/components/ui/__tests__/AppImage.test.js`
Expected: PASS

**Step 8: Commit**

```bash
git add src/components/ui/AppButton.vue src/components/ui/AppInput.vue src/components/ui/Select.vue src/components/ui/AppCard.vue src/components/ui/AppTable.vue src/components/ui/Modal.vue src/components/ui/ConfirmDialog.vue src/components/ui/EmptyState.vue src/components/ui/PermissionDeniedState.vue src/components/ui/__tests__/AppButton.design-contract.test.js src/components/ui/__tests__/AppInput.design-contract.test.js src/components/ui/__tests__/Modal.design-contract.test.js
git commit -m "refactor(ui): rebuild foundation components v1"
```

### Task 6: Build composed components and page shells v1

**Files:**

- Create: `src/design-system/composed/PageHeader.vue`
- Create: `src/design-system/composed/StatGroup.vue`
- Create: `src/design-system/composed/StatePanel.vue`
- Create: `src/design-system/composed/ActionBar.vue`
- Create: `src/design-system/patterns/DashboardShell.vue`
- Create: `src/design-system/patterns/ManagementListShell.vue`
- Create: `src/design-system/patterns/WorkflowDetailShell.vue`
- Create: `src/design-system/patterns/PublicViewerShell.vue`
- Create: `src/design-system/patterns/MobileSalesShell.vue`
- Create: `src/design-system/__tests__/DashboardShell.test.js`
- Create: `src/design-system/__tests__/ManagementListShell.test.js`

**Step 1: Write failing shell tests**

Cover:

- shell structure
- slot contracts
- loading/error/empty placement
- action and filter zones

**Step 2: Run the focused shell tests to verify failure**

Run: `pnpm test:unit src/design-system/__tests__/DashboardShell.test.js src/design-system/__tests__/ManagementListShell.test.js`
Expected: FAIL because shells do not exist yet

**Step 3: Implement composed components**

Build the shared section and header building blocks using foundation components only.

**Step 4: Implement page shells**

Build first-wave shells with documented slots for:

- header
- actions
- filters
- summary
- main content
- side content
- state blocks

**Step 5: Run the shell tests**

Run: `pnpm test:unit src/design-system/__tests__/DashboardShell.test.js src/design-system/__tests__/ManagementListShell.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add src/design-system/composed/PageHeader.vue src/design-system/composed/StatGroup.vue src/design-system/composed/StatePanel.vue src/design-system/composed/ActionBar.vue src/design-system/patterns/DashboardShell.vue src/design-system/patterns/ManagementListShell.vue src/design-system/patterns/WorkflowDetailShell.vue src/design-system/patterns/PublicViewerShell.vue src/design-system/patterns/MobileSalesShell.vue src/design-system/__tests__/DashboardShell.test.js src/design-system/__tests__/ManagementListShell.test.js
git commit -m "feat(ui): add composed components and page shells v1"
```

### Task 7: Migrate `Dashboard.vue` to the new system

**Files:**

- Modify: `src/views/Dashboard.vue`
- Modify: supporting domain components if extraction is needed
- Create: `src/views/__tests__/Dashboard.design-system-migration.test.js`

**Step 1: Write a failing migration test**

Assert:

- dashboard uses shared shell structure
- no Material Symbols remain
- no page-local stat-card system remains
- loading and permission states use shared state components

**Step 2: Run the focused test to verify failure**

Run: `pnpm test:unit src/views/__tests__/Dashboard.design-system-migration.test.js`
Expected: FAIL

**Step 3: Refactor the dashboard into shared shells and composed components**

Use:

- `DashboardShell`
- shared stat cards or stat groups
- shared state panels
- shared action patterns

Keep business data flow unchanged.

**Step 4: Run the focused dashboard test**

Run: `pnpm test:unit src/views/__tests__/Dashboard.design-system-migration.test.js`
Expected: PASS

**Step 5: Run adjacent workflow tests**

Run: `pnpm test:unit src/views/__tests__/Dashboard.order-detail-workflow.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add src/views/Dashboard.vue src/views/__tests__/Dashboard.design-system-migration.test.js
git commit -m "refactor(dashboard): migrate to design system shells"
```

### Task 8: Migrate `Stats.vue` to the new system

**Files:**

- Modify: `src/views/Stats.vue`
- Modify: `src/views/stats/StatsCard.vue`
- Modify: `src/views/stats/StatsChartWrapper.vue`
- Create: `src/views/__tests__/Stats.design-system-migration.test.js`

**Step 1: Write a failing migration test**

Assert:

- stats no longer defines its own incompatible card language
- chart wrappers use shared card and shell rules
- page title and action zones use shared layout structure

**Step 2: Run the focused test to verify failure**

Run: `pnpm test:unit src/views/__tests__/Stats.design-system-migration.test.js`
Expected: FAIL

**Step 3: Refactor stats to shared shells and cards**

Remove page-local special card systems unless they become promoted shared components.

**Step 4: Run the focused migration test**

Run: `pnpm test:unit src/views/__tests__/Stats.design-system-migration.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/views/Stats.vue src/views/stats/StatsCard.vue src/views/stats/StatsChartWrapper.vue src/views/__tests__/Stats.design-system-migration.test.js
git commit -m "refactor(stats): migrate to shared dashboard system"
```

### Task 9: Migrate `GoodsOverview.vue` and `PurchaseOrders.vue`

**Files:**

- Modify: `src/views/GoodsOverview.vue`
- Modify: `src/views/PurchaseOrders.vue`
- Create: `src/views/__tests__/GoodsOverview.design-system-migration.test.js`
- Create: `src/views/__tests__/PurchaseOrders.design-system-migration.test.js`

**Step 1: Write failing migration tests**

Assert for both pages:

- shared list shell usage
- shared filter/action/stat patterns
- no page-local modal base patterns remain where shared workflow shells apply

**Step 2: Run the focused tests to verify failure**

Run: `pnpm test:unit src/views/__tests__/GoodsOverview.design-system-migration.test.js src/views/__tests__/PurchaseOrders.design-system-migration.test.js`
Expected: FAIL

**Step 3: Refactor both pages to `ManagementListShell` and `WorkflowDetailShell`**

Promote any repeated pieces into composed components before duplicating them.

**Step 4: Run the focused tests**

Run: `pnpm test:unit src/views/__tests__/GoodsOverview.design-system-migration.test.js src/views/__tests__/PurchaseOrders.design-system-migration.test.js`
Expected: PASS

**Step 5: Run adjacent workflow regressions**

Run: `pnpm test:unit src/views/__tests__/PurchaseOrders.detail-shell.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add src/views/GoodsOverview.vue src/views/PurchaseOrders.vue src/views/__tests__/GoodsOverview.design-system-migration.test.js src/views/__tests__/PurchaseOrders.design-system-migration.test.js
git commit -m "refactor(procurement-ui): migrate overview and purchase pages to shared shells"
```

### Task 10: Add governance and rollout guards

**Files:**

- Modify: `eslint.config.js`
- Create: `scripts/qa/check-ui-token-integrity.mjs`
- Create: `docs/design-system/MASTER.md`
- Create: `docs/design-system/foundations.md`
- Create: `docs/design-system/patterns.md`
- Modify: `README.md`

**Step 1: Add a failing governance check**

Create a script or lint rule that fails on:

- known invalid token names
- direct brand hex usage in page code
- new Material Symbols usage in production UI

**Step 2: Run the governance check to verify failure on current offenders**

Run: `node scripts/qa/check-ui-token-integrity.mjs`
Expected: FAIL until first-wave migration and cleanup are complete

**Step 3: Add lint or QA enforcement**

Integrate the script into project QA or document the command as a mandatory pre-merge step.

**Step 4: Write the design-system reference docs**

Document:

- token rules
- foundation component usage
- page shell usage
- migration and deprecation policy

**Step 5: Re-run governance check**

Run: `node scripts/qa/check-ui-token-integrity.mjs`
Expected: PASS for the first-wave migrated codebase

**Step 6: Commit**

```bash
git add eslint.config.js scripts/qa/check-ui-token-integrity.mjs docs/design-system/MASTER.md docs/design-system/foundations.md docs/design-system/patterns.md README.md
git commit -m "chore(ui): add design system governance and reference docs"
```

### Task 11: Expand migration packs across remaining modules

**Files:**

- Modify: `src/views/FileManager/index.vue`
- Modify: `src/components/ProductManager.vue`
- Modify: `src/components/OrderManager.vue`
- Modify: `src/views/Sales.vue`
- Modify: `src/views/Gallery.vue`
- Modify: `src/views/Space.vue`
- Add tests as needed per module pack

**Step 1: Define one migration pack at a time**

Do not mix unrelated modules in a single commit. Preferred packs:

- file manager
- product and order management
- sales shell
- public pages

**Step 2: For each pack, write failing migration tests**

Lock in shell usage, state component usage, and removal of local visual primitives.

**Step 3: Implement migration pack using shared shells**

Promote missing repeated UI into the design system before duplicating module code.

**Step 4: Run focused tests for the pack**

Use the smallest related component and view suites first.

**Step 5: Commit each pack separately**

Example:

```bash
git add src/views/FileManager/index.vue
git commit -m "refactor(files-ui): migrate file manager to shared design system"
```

### Task 12: Final verification before implementation closure

**Files:**

- Verify only

**Step 1: Run the token integrity check**

Run: `node scripts/qa/check-ui-token-integrity.mjs`
Expected: PASS

**Step 2: Run targeted shared-component suites**

Run: `pnpm test:unit src/components/ui/__tests__/AppButton.design-contract.test.js src/components/ui/__tests__/AppInput.design-contract.test.js src/components/ui/__tests__/Modal.design-contract.test.js src/design-system/__tests__/DashboardShell.test.js src/design-system/__tests__/ManagementListShell.test.js`
Expected: PASS

**Step 3: Run demonstration-page suites**

Run: `pnpm test:unit src/views/__tests__/Dashboard.design-system-migration.test.js src/views/__tests__/Stats.design-system-migration.test.js src/views/__tests__/GoodsOverview.design-system-migration.test.js src/views/__tests__/PurchaseOrders.design-system-migration.test.js`
Expected: PASS

**Step 4: Run broader regression suites around migrated modules**

Run the smallest relevant existing suites for dashboard, purchase orders, stats, and shared UI. Expand only if failures indicate hidden coupling.

**Step 5: Inspect the final diff scope**

Run: `git diff --stat`
Expected: changes limited to styles, design system, migrated pages, tests, docs, and governance files

**Step 6: Commit final stabilization if needed**

```bash
git add .
git commit -m "chore(ui): finalize design system closure phase"
```

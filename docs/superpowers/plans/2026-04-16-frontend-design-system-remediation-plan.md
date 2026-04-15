# Frontend Design System Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the full frontend design-system drift across Web and minisales so shared tokens, shared primitives, shared shells, and status/tone contracts become the only supported path.

**Architecture:** Fix the problem in dependency order instead of page order. First, lock the shared token/icon/typography/status contracts and clean the shared layer itself. Second, add the missing shared overlay/surface primitives that business modules are currently re-inventing. Third, migrate Web domains by module. Fourth, converge minisales tokens/status surfaces. Finish by adding guardrails so the same drift cannot re-enter.

**Tech Stack:** Vue 3, Vite, Tailwind v4, CSS variable token system, Vitest, ESLint, minisales WeChat miniprogram SCSS/WXML/TS.

---

## Planning Assumptions

- The audit baseline is the source of truth:
  - `docs/reviews/2026-04-16-frontend-design-system-audit.md`
  - `docs/reviews/2026-04-16-frontend-audit-agent-1-shared-system.md`
  - `docs/reviews/2026-04-16-frontend-audit-agent-2-views.md`
  - `docs/reviews/2026-04-16-frontend-audit-agent-3-commerce-domain.md`
  - `docs/reviews/2026-04-16-frontend-audit-agent-4-space-customer-common.md`
  - `docs/reviews/2026-04-16-frontend-audit-agent-5-minisales.md`
- This work must be delivered in waves, not one giant patch.
- After Wave 1 lands, Web domain migrations can be split into parallel workstreams.
- Minisales should converge on the same governance principles, but does not need to reuse Vue component files.

## Sequencing Rationale

1. **Shared contract first**
   If `AppIcon`, tone/status token mapping, typography, and foundation surfaces are still inconsistent, any page-level cleanup will just encode the same drift into new places.

2. **Missing primitives second**
   Procurement drawers, space editor shells, AI cards, and minisales panels are bypassing the system because the system is missing some abstractions. Add the primitives before trying to migrate the callers.

3. **Business module migrations third**
   Once shared primitives exist, migrate business domains in parallel by bounded module families.

4. **Governance last**
   Add repo-wide checks only after the codebase is mostly clean; otherwise the first guardrail patch becomes a giant allowlist.

## Delivery Waves

- **Wave A: Shared Contract Repair**
  - Blocking wave. Must land before domain cleanup.
- **Wave B: Shared Primitive Backfill**
  - Blocking wave. Must land before heavy modal/drawer/page migrations.
- **Wave C: Web Domain Migration**
  - Can be split into 3 parallel workstreams after Wave B.
- **Wave D: Minisales Convergence**
  - Can run partly in parallel with late Wave C, but only after status/tone contract is locked.
- **Wave E: Governance and Final Sweep**
  - Final cleanup, tests, docs, lint/QA enforcement.

---

### Task 1: Lock the Shared Design Contract

**Why now:** This is the dependency root. Every downstream task needs one agreed token/status/icon/typography contract.

**Files:**
- Modify: `docs/design-system/MASTER.md`
- Modify: `docs/design-system/foundations.md`
- Modify: `docs/design-system/patterns.md`
- Modify: `docs/design-system/typography.md`
- Modify: `docs/design-system/iconography.md`
- Create: `docs/design-system/status-tone-contract.md`
- Create: `docs/design-system/minisales-token-contract.md`
- Reference: `docs/reviews/2026-04-16-frontend-design-system-audit.md`

- [ ] **Step 1: Define the missing contract surface**
  - Standardize:
    - allowed semantic tones (`primary`, `success`, `warning`, `danger`, `info`, `neutral`)
    - allowed status mapping ownership
    - icon entrypoint policy
    - typography exceptions policy
    - overlay surface policy
    - minisales token naming policy

- [ ] **Step 2: Document which layer owns which visual responsibility**
  - Clarify:
    - tokens own values
    - foundation owns controls and interaction states
    - composed owns reusable shells/surfaces/headers/action bars
    - pages only compose

- [ ] **Step 3: Document the banned patterns explicitly**
  - Ban:
    - local `svg` in production UI when `AppIcon` should own the glyph
    - `font-[Outfit]`
    - local status `hex`/`rgba` maps in business modules
    - business-layer modal/drawer chrome
    - minisales `style="{{color/background}}"` status injection

- [ ] **Step 4: Review docs for consistency**

Run:
```bash
pnpm format docs/design-system/**/*.md docs/reviews/2026-04-16-frontend-design-system-audit.md docs/superpowers/plans/2026-04-16-frontend-design-system-remediation-plan.md
```

Expected:
- Markdown formatting succeeds.

- [ ] **Step 5: Commit**

```bash
git add docs/design-system/*.md docs/design-system/status-tone-contract.md docs/design-system/minisales-token-contract.md
git commit -m "docs: lock frontend design remediation contract"
```

---

### Task 2: Repair Shared Tokens, Typography, Iconography, and Foundation Contracts

**Why now:** The shared layer itself currently contains drift. It must be cleaned before any consumer migration.

**Files:**
- Modify: `src/styles/main.css`
- Modify: `src/styles/tokens/primitive.css`
- Modify: `src/styles/tokens/semantic.css`
- Modify: `src/styles/tokens/themes.css`
- Modify: `src/styles/tokens/charts.css`
- Modify: `src/components/ui/AppCard.vue`
- Modify: `src/components/ui/AppStatCard.vue`
- Modify: `src/components/ui/StatusBadge.vue`
- Modify: `src/components/ui/StatusSelector.vue`
- Modify: `src/components/ui/PermissionDeniedState.vue`
- Modify: `src/components/ui/AppImage.vue`
- Modify: `src/components/ui/AppTable.vue`
- Modify: `src/components/ui/AppIcon.vue`
- Modify: `src/design-system/composed/MetricTile.vue`
- Modify or remove: `src/components/ui/ProductSpecCard.vue`
- Modify or remove: `src/components/ui/ProductSpecCardDemo.vue`
- Test: `src/components/ui/__tests__/*.test.js`
- Test: `src/design-system/__tests__/MetricTile.test.js`

- [ ] **Step 1: Remove legacy/global bypass paths**
  - Delete `.material-symbols-outlined` support from `src/styles/main.css` if no production dependency remains.
  - Remove or migrate any remaining local icon shortcuts into `AppIcon`.

- [ ] **Step 2: Normalize shared tone/status mapping**
  - Make `StatusBadge`, `StatusSelector`, `MetricTile`, `AppCard`, and `AppStatCard` consume one tone contract.
  - Replace ad hoc `blue-500/purple-500/cyan-500` and RGBA glow with semantic tokens.

- [ ] **Step 3: Remove foundation-level second visual system**
  - Decide whether `ProductSpecCard` is a valid shared primitive.
  - If yes, rewrite it to consume the standard token/tone/icon contracts.
  - If no, demote it to a demo-only or domain-scoped artifact and remove it from foundation.

- [ ] **Step 4: Normalize shared typography**
  - Remove shared-layer support for `font-[Outfit]`-style exceptions.
  - Ensure chart/documented numeric emphasis uses the documented mono family or existing shared sans rules.

- [ ] **Step 5: Add/adjust contract tests**

Run:
```bash
pnpm test:unit:run -- src/components/ui/__tests__/AppButton.design-contract.test.js src/components/ui/__tests__/AppCard.design-contract.test.js src/components/ui/__tests__/AppInput.design-contract.test.js src/components/ui/__tests__/Modal.design-contract.test.js src/design-system/__tests__/MetricTile.test.js
pnpm lint -- src/components/ui src/design-system src/styles
```

Expected:
- Shared design-contract tests pass.
- Lint passes for the shared layer.

- [ ] **Step 6: Commit**

```bash
git add src/styles src/components/ui src/design-system/composed docs/design-system
git commit -m "refactor: repair shared frontend design contracts"
```

---

### Task 3: Add Missing Shared Primitives for Overlay and Surface Composition

**Why now:** Business domains are bypassing the system because the system lacks some shells they clearly need.

**Files:**
- Create: `src/design-system/composed/OverlayScaffold.vue`
- Create: `src/design-system/composed/SurfaceSection.vue`
- Create: `src/design-system/composed/CalloutPanel.vue`
- Create or modify: `src/design-system/composed/PageHeader.vue`
- Modify: `src/components/ui/Modal.vue`
- Modify: `src/design-system/composed/ActionBar.vue`
- Modify: `src/design-system/composed/StatePanel.vue`
- Test: `src/design-system/__tests__/OverlayScaffold.test.js`
- Test: `src/design-system/__tests__/SummaryStrip.test.js`
- Test: `src/components/ui/__tests__/Modal.design-contract.test.js`

- [ ] **Step 1: Define the minimum reusable primitives**
  - `OverlayScaffold`: shared header/body/footer chrome for dialog/drawer-style content.
  - `SurfaceSection`: shared internal section shell for cards/panels.
  - `CalloutPanel`: shared info/warning/error callout block for pages/forms/drawers.

- [ ] **Step 2: Wire the primitives to existing foundation contracts**
  - `OverlayScaffold` must sit on top of `Modal`, not bypass it.
  - New primitives must consume token/tone rules from Task 2.

- [ ] **Step 3: Add tests for the new primitives**
  - Verify semantic classes/slots/variants.
  - Verify no local palette values are needed in consumers.

- [ ] **Step 4: Verify shared primitives**

Run:
```bash
pnpm test:unit:run -- src/components/ui/__tests__/Modal.design-contract.test.js src/design-system/__tests__/OverlayScaffold.test.js src/design-system/__tests__/MetricTile.test.js
pnpm lint -- src/components/ui src/design-system
```

Expected:
- Shared primitive tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Modal.vue src/design-system/composed
git commit -m "feat: add shared overlay and surface primitives"
```

---

### Task 4: Migrate Web Views to Consume the Shared System Properly

**Why now:** Views already use shells in some places, but still keep page-local visual systems. Fix them before domain components spread more page-level styling.

**Files:**
- Modify: `src/views/Dashboard.vue`
- Modify: `src/views/Stats.vue`
- Modify: `src/views/stats/StatsCard.vue`
- Modify: `src/views/stats/StatsChartWrapper.vue`
- Modify: `src/views/GoodsOverview.vue`
- Modify: `src/views/SpaceManager/index.vue`
- Modify: `src/views/Login.vue`
- Modify: `src/views/FileManager/index.vue`
- Modify: `src/views/FileManager/*.vue`
- Reference: `src/design-system/patterns/*.vue`

- [ ] **Step 1: Replace page-local surfaces with shared surfaces**
  - Remove glass-card/blob/local surface implementations from `Dashboard.vue` and `Stats.vue`.
  - Route repeated cards/sections through `AppCard`, `AppStatCard`, `MetricTile`, `SurfaceSection`, `PageHeader`, `SummaryStrip`, or other shared primitives.

- [ ] **Step 2: Remove page-local icon/typography exceptions**
  - Replace local `svg` and font exceptions in view-level files.

- [ ] **Step 3: Ensure shell usage is structural, not decorative**
  - Each page should rely on shell + composed components for top-level structure instead of rebuilding that structure inside the view.

- [ ] **Step 4: Verify the view layer**

Run:
```bash
pnpm test:unit:run -- src/design-system/__tests__/DashboardShell.test.js src/design-system/__tests__/ManagementListShell.test.js
pnpm lint -- src/views
```

Expected:
- Shell contract tests still pass.
- View-layer lint passes.

- [ ] **Step 5: Commit**

```bash
git add src/views src/design-system
git commit -m "refactor: align views with shared page system"
```

---

### Task 5: Migrate Product, Order, and Purchase-Order Domains

**Why now:** This is the largest Web drift area and the highest volume of business-layer primitive duplication.

**Files:**
- Modify: `src/components/product/ProductCreateModal.vue`
- Modify: `src/components/product/ProductVariantTable.vue`
- Modify: `src/components/product/VariantBatchBuilderModal.vue`
- Modify: `src/components/product/ProductTable.vue`
- Modify: `src/components/product/ProductDetail.vue`
- Modify: `src/components/order/OrderForm.vue`
- Modify: `src/components/OrderStatusChanger.vue`
- Modify: `src/components/order/OrderWorkflowModal.vue`
- Modify: `src/components/order/OrderTable.vue`
- Modify: `src/components/order/ProductBindingSection.vue`
- Modify: `src/components/purchase-order/ProductPickerModal.vue`
- Modify: `src/components/purchase-order/OrderPickerModal.vue`
- Modify: `src/components/purchase-order/PurchaseOrderCreateDrawer.vue`
- Modify: `src/components/purchase-order/PurchaseOrderDetailDrawer.vue`
- Modify: `src/components/purchase-order/PurchaseOrderCostModal.vue`
- Modify: `src/components/purchase-order/PurchaseOrderReceiptModal.vue`
- Modify: `src/components/purchase-order/PurchaseOrderShortageModal.vue`
- Modify: `src/components/purchase-order/PurchaseOrderReceiptReversalModal.vue`
- Modify: `src/components/purchase-order/PurchaseOrderSuggestionsDrawer.vue`
- Modify: `src/components/purchase-order/PurchaseOrderSupportOverlays.vue`

- [ ] **Step 1: Replace local overlay shells**
  - Migrate procurement/product overlay files to `Modal` + `OverlayScaffold`.

- [ ] **Step 2: Replace raw form controls where shared controls are appropriate**
  - Convert raw `button`/`input`/`select`/`textarea` to `AppButton`, `AppInput`, `Select`, `AppCheckbox`, `StatusBadge`, `AppTable`.
  - Only leave raw controls where a shared foundation equivalent genuinely does not exist; if missing, add the capability to foundation instead of styling locally.

- [ ] **Step 3: Remove local icon and palette systems**
  - Replace local `svg`, raw palette utilities, local gradients, local status `:style` injection, and `font-[Outfit]` usage.

- [ ] **Step 4: Extract repeated domain visuals that appear in 3+ places**
  - Promote repeated chips/cards/section blocks into `src/design-system/composed` or `src/components/ui`.

- [ ] **Step 5: Verify the commerce domain**

Run:
```bash
pnpm test:unit:run -- src/components/product/__tests__/ProductBasicInfoSection.contract.test.js src/components/product/__tests__/ProductOptionsBuilder.contract.test.js src/components/product/__tests__/ProductVariantTable.test.js src/components/order/__tests__/*.test.js
pnpm lint -- src/components/product src/components/order src/components/purchase-order src/components/OrderStatusChanger.vue src/components/OrderManager.vue src/components/OrderCreateModal.vue src/components/OrderEditModal.vue
```

Expected:
- Existing domain tests pass or are updated with the new shared contracts.
- Lint passes for all commerce modules.

- [ ] **Step 6: Commit**

```bash
git add src/components/product src/components/order src/components/purchase-order src/components/OrderStatusChanger.vue src/components/OrderManager.vue src/components/OrderCreateModal.vue src/components/OrderEditModal.vue
git commit -m "refactor: converge commerce ui on shared design system"
```

---

### Task 6: Migrate Space, Customer, Settings, Salesperson, and Common UI Domains

**Why now:** This is the second large Web drift cluster, especially around public-viewer flows, AI surfaces, detail panels, and field/dialog shells.

**Files:**
- Modify: `src/components/SpaceProductEditor.vue`
- Modify: `src/components/SpaceCreateModal.vue`
- Modify: `src/components/SpaceDetailModal.vue`
- Modify: `src/components/FileSelector.vue`
- Modify: `src/components/MoveItemModal.vue`
- Modify: `src/components/TagModal.vue`
- Modify: `src/components/ReloadPrompt.vue`
- Modify: `src/components/space/*.vue`
- Modify: `src/components/customer/*.vue`
- Modify: `src/components/settings/**/*.vue`
- Modify: `src/components/salesperson/*.vue`
- Modify: `src/components/common/**/*.vue`
- Modify: `src/components/outbox/*.vue`
- Modify: `src/views/Gallery.vue`
- Modify: `src/views/Space.vue`

- [ ] **Step 1: Migrate high-risk shells and panels**
  - Start with:
    - `SpaceProductEditor.vue`
    - `SpaceProductDetail.vue`
    - `CustomerDetailPanel.vue`
    - `DestructiveConfirmModal.vue`
    - `AIChatWidget.vue`
    - `AIChart.vue`
    - `SalespersonSelectModal.vue`
    - `AISettings.vue`

- [ ] **Step 2: Unify public viewer composition**
  - Align `space/public viewer` flows around `PublicViewerShell`, `Lightbox`, `PasswordGate`, and shared sticky action patterns.

- [ ] **Step 3: Remove domain-local icons, inputs, and callouts**
  - Replace local `svg`, raw buttons/inputs, local callout surfaces, local chip fields, and repeated upload tiles.

- [ ] **Step 4: Verify the domain**

Run:
```bash
pnpm test:unit:run -- src/components/space/__tests__/SpaceSettingsTab.contract.test.js src/components/space/__tests__/SpaceCollection.contract.test.js
pnpm lint -- src/components/space src/components/customer src/components/settings src/components/salesperson src/components/common src/components/outbox src/components/SpaceProductEditor.vue src/components/SpaceCreateModal.vue src/components/SpaceDetailModal.vue src/components/FileSelector.vue src/components/MoveItemModal.vue src/components/TagModal.vue src/components/ReloadPrompt.vue
```

Expected:
- Existing contract tests pass.
- No new local visual systems remain in the highest-risk files.

- [ ] **Step 5: Commit**

```bash
git add src/components/space src/components/customer src/components/settings src/components/salesperson src/components/common src/components/outbox src/components/SpaceProductEditor.vue src/components/SpaceCreateModal.vue src/components/SpaceDetailModal.vue src/components/FileSelector.vue src/components/MoveItemModal.vue src/components/TagModal.vue src/components/ReloadPrompt.vue src/views/Gallery.vue src/views/Space.vue
git commit -m "refactor: converge space and common ui on shared primitives"
```

---

### Task 7: Converge Minisales Tokens, Status Mapping, and Shared Surfaces

**Why now:** minisales drift is structurally different from Web, but the same contract problems exist. It should converge after the Web tone/status contract is stable.

**Files:**
- Modify: `minisales/miniprogram/styles/variables.scss`
- Modify: `minisales/miniprogram/app.scss`
- Modify: `minisales/miniprogram/app.json`
- Modify: `minisales/miniprogram/custom-tab-bar/*`
- Modify: `minisales/miniprogram/utils/constants.ts`
- Modify: `minisales/miniprogram/components/sales/order-card/index.ts`
- Modify: `minisales/miniprogram/pages/detail/controller.ts`
- Modify: `minisales/miniprogram/pages/stats/controller.ts`
- Modify: `minisales/miniprogram/components/sales/app-shell/*`
- Modify: `minisales/miniprogram/components/sales/state-panel/*`
- Modify: `minisales/miniprogram/components/sales/order-summary/*`
- Modify: `minisales/miniprogram/components/sales/product-binding/*`
- Modify: `minisales/miniprogram/components/sales/notification-drawer/*`
- Modify: `minisales/miniprogram/pages/**/*.scss`

- [ ] **Step 1: Centralize minisales tone/status ownership**
  - Move to one source of truth for status metadata.
  - Replace hex-returning helpers with `statusKey/tone` and component-level class selection.

- [ ] **Step 2: Remove style-string UI composition**
  - Eliminate `style="{{...}}"` or computed `color/background` string injection for status chips and stat cards.

- [ ] **Step 3: Define minisales shared surfaces**
  - Build/extend shared minisales surfaces for:
    - chips
    - cards
    - overlay/drawer shells
    - section headers
  - Route order card, summary card, notification drawer, and stats surfaces through them.

- [ ] **Step 4: Normalize SCSS variable usage**
  - Replace scattered hex/rgba/gradient values in pages/components with shared variables or documented semantic aliases.
  - Keep only token definitions in the variable layer.

- [ ] **Step 5: Verify minisales**

Run:
```bash
pnpm test:minisales
pnpm typecheck:minisales
```

Expected:
- minisales unit tests pass.
- TypeScript passes.

- [ ] **Step 6: Commit**

```bash
git add minisales/miniprogram
git commit -m "refactor: converge minisales ui tokens and surfaces"
```

---

### Task 8: Add Guardrails and Perform the Final Audit Sweep

**Why now:** Only after the migrations land can enforcement be tightened without a large temporary allowlist.

**Files:**
- Modify: `scripts/qa/check-ui-token-integrity.mjs`
- Create: `scripts/qa/check-ui-foundation-usage.mjs`
- Create: `scripts/qa/check-minisales-ui-contract.mjs`
- Modify: `package.json`
- Modify: `eslint.config.js`
- Modify: `docs/design-system/MASTER.md`
- Modify: `docs/reviews/2026-04-16-frontend-design-system-audit.md`

- [ ] **Step 1: Expand automated checks**
  - Detect:
    - `material-symbols-outlined`
    - local production `svg` escapes where disallowed
    - `font-[Outfit]`
    - banned token aliases
    - hardcoded brand/status hex in business layers
    - raw Web controls in business layers where foundation should be used
    - minisales status style string injection

- [ ] **Step 2: Wire checks into the normal workflow**
  - Add QA scripts to `package.json`.
  - Ensure they can run in CI and locally without special setup.

- [ ] **Step 3: Re-run the final audit**
  - Revisit the original audit files.
  - Close fixed findings and document any intentionally deferred exceptions.

- [ ] **Step 4: Full verification**

Run:
```bash
pnpm lint
pnpm test:unit:run
pnpm test:minisales
pnpm typecheck:minisales
node scripts/qa/check-ui-token-integrity.mjs
node scripts/qa/check-ui-foundation-usage.mjs
node scripts/qa/check-minisales-ui-contract.mjs
```

Expected:
- All checks pass.
- Remaining exceptions, if any, are explicit and documented.

- [ ] **Step 5: Commit**

```bash
git add scripts/qa package.json eslint.config.js docs/design-system docs/reviews
git commit -m "chore: enforce frontend design system guardrails"
```

---

## Recommended Execution Strategy

### Wave Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4, Task 5, Task 6 in parallel
5. Task 7
6. Task 8

### Parallelization Notes

- **Do not parallelize** Tasks 1-3. They define the contracts and primitives.
- **Can parallelize** Tasks 4-6 once Task 3 is merged.
- **Can partially overlap** Task 7 with late Task 6 if the status/tone contract and shared token language are already stable.
- **Do not start** Task 8 before the migration tasks are substantially complete.

### Suggested PR Breakdown

1. `docs/design-system` contract PR
2. shared token/foundation cleanup PR
3. shared overlay/surface primitives PR
4. views cleanup PR
5. commerce domain cleanup PR
6. space/common domain cleanup PR
7. minisales convergence PR
8. governance/final audit PR

## Done Criteria

- No production-path Material Symbols escape remains.
- No high-visibility `font-[Outfit]` escape remains.
- Shared status/tone mapping is centralized and documented.
- Business-layer modal/drawer chrome is built on shared primitives.
- Web business domains primarily consume shared foundation/composed primitives.
- minisales status and surface styling is centralized and no longer composed via color/background style strings.
- QA scripts enforce the new rules.
- The audit can be re-run with only documented low-priority exceptions, if any.

## Risks and Mitigations

- **Risk:** Shared contract changes break many consumers.
  - **Mitigation:** Land Wave A/B first with contract tests before mass migration.

- **Risk:** Procurement and space domains each invent new abstractions during migration.
  - **Mitigation:** Require extraction into `ui`/`design-system/composed` when a pattern appears in 3+ places.

- **Risk:** QA guardrails become noisy.
  - **Mitigation:** Add them only after cleanup; keep checks path-scoped and explicit.

- **Risk:** minisales diverges again because it cannot reuse Vue components directly.
  - **Mitigation:** Reuse the same contract vocabulary and token/tone ownership model even if implementation files differ.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-16-frontend-design-system-remediation-plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session in batches with checkpoints.

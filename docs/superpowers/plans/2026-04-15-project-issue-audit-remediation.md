# Project Issue Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the low-risk, directly verifiable findings from the 2026-04-15 audit first, then leave structural refactors as an explicit second-stage track.

**Architecture:** Execute the audit in four Stage 1 waves: tooling/quality gates, storage defaults, helper consolidation, and document-template completion. Keep Stage 2 architectural debt out of the first execution pass unless a direct bug cannot be fixed without it.

**Tech Stack:** pnpm, ESLint, Prettier, Vitest, Vue 3, Hono, Cloudflare Pages Functions

---

## Execution Status

- 状态：partially completed on 2026-04-15
- 结案说明：[docs/reviews/2026-04-15-project-issue-audit-closure-note.md](/home/bjw/Code/KK-Image/docs/reviews/2026-04-15-project-issue-audit-closure-note.md)
- 执行结果：`01-25` 与 `30` 已完成落地；`26-29` 完成了首轮 helper / read-model 抽离，但“大文件职责过载”仍需继续治理。
- 新鲜验证：
  - targeted `eslint` PASS：覆盖原审查中直接点名的 Node/Vitest globals、Workers globals、Vue 规则作用域、死代码和无效抑制项
  - targeted audit suites PASS：`10` files / `14` tests
- follow-up：
  - `pnpm typecheck:minisales` 已证明类型检查改为 `tsconfig.json` 驱动，且本轮已把 `minisales` 接入 root `lint` / `ci-test` 默认门禁。
  - `26-29` 对应的四个大文件仍需继续拆分，当前只完成了首轮可验证抽离。

## Scope Split

### Stage 1: Execute now

- `01-10`
- `11-13`
- `15`
- `17-25`
- `30`

### Stage 2: Separate follow-up plan

- `14`
- `16`
- `26-29`

## Task 1: Repair Tooling and Quality Gates

**Files:**
- Modify: `package.json`
- Modify: `minisales/package.json`
- Modify: `eslint.config.js`
- Test: `scripts/qa/__tests__/check-direct-protected-fetch.test.mjs` (only if command changes need coverage)
- Verify: targeted `eslint` commands

- [ ] **Step 1: Write or identify failing verification for current toolchain gaps**

Run:

```bash
npx eslint src/components/__tests__/OrderManager.design-system-migration.test.js
npx eslint functions/utils/__tests__/ai-utils-health.test.js
npx eslint functions/lib/hono/routes/manage/__tests__/audit-replay-routes.test.js
```

Expected:

- `process is not defined`
- `ReadableStream is not defined`
- `vue/multi-word-component-names` false positive on JS test files

- [ ] **Step 2: Update repository scripts so lint/format/test coverage matches active code areas**

Required outcomes:

- `lint` includes `src`, `functions`, `scripts`, `test`
- add a dedicated minisales lint/typecheck command at root or document it in CI-facing scripts
- `ci-test` includes `pnpm test:unit`
- `deploy:verify` replaces fixed sleep and global `pkill` with `wait-on` and PID-scoped cleanup

- [ ] **Step 3: Update ESLint flat config to scope globals and Vue rules correctly**

Required outcomes:

- Node/Vitest globals for frontend test files
- `ReadableStream` and related runtime globals for backend tests
- Vue component-name rule applies only to `.vue`
- `better-tailwindcss` warning is removed by configuring a real entry point or disabling the plugin until configured

- [ ] **Step 4: Replace minisales manual file enumeration with tsconfig-driven typecheck**

Required outcomes:

- `minisales/package.json` runs `tsc --noEmit -p tsconfig.json`
- `minisales/tsconfig.json` owns include/exclude coverage

- [ ] **Step 5: Run focused verification**

Run:

```bash
npx eslint src/components/__tests__/OrderManager.design-system-migration.test.js
npx eslint functions/utils/__tests__/ai-utils-health.test.js
npx eslint functions/lib/hono/routes/manage/__tests__/audit-replay-routes.test.js
npx eslint functions/api/utils/id.js functions/api/utils/file-utils.js functions/lib/hono/routes/manage/products/[id].js functions/repositories/order/mutations.js functions/utils/ai-utils.js
pnpm test:unit -- --runInBand
```

- [ ] **Step 6: Commit**

```bash
git add package.json minisales/package.json minisales/tsconfig.json eslint.config.js
git commit -m "fix: tighten project quality gates"
```

## Task 2: Align Storage Defaults With Product Documentation

**Files:**
- Modify: `functions/storage/index.js`
- Modify: `functions/storage/router.js`
- Test: add focused storage router/provider tests if missing

- [ ] **Step 1: Write failing tests for default provider selection**

Assertions:

- no explicit provider => defaults to `r2`
- `single`/`redundant` mode without explicit primary => resolves to `r2`
- default routing rules do not send `<5MB` files to `telegram`

- [ ] **Step 2: Run focused tests and confirm RED**

- [ ] **Step 3: Implement the minimal default-alignment changes**

- [ ] **Step 4: Re-run focused tests and confirm GREEN**

- [ ] **Step 5: Commit**

```bash
git add functions/storage/index.js functions/storage/router.js
git commit -m "fix: align storage defaults with docs"
```

## Task 3: Consolidate Shared Helpers and Constants

**Files:**
- Modify: `functions/lib/utils/variant-meta.js`
- Modify: `functions/_shared/utils.js`
- Modify: `functions/lib/_shared/utils.js`
- Modify: `functions/lib/hono/_shared/utils.js`
- Modify: `src/utils/sales-space.js`
- Modify: `src/composables/useProductForm.js`
- Modify: `functions/api/utils/order-binding-snapshot.js`
- Modify: `src/components/product/ProductDetail.vue`
- Modify: `src/views/sales/SalesFormView.vue`
- Modify: `src/components/OrderEditModal.vue`
- Modify: `src/components/OrderCreateModal.vue`
- Modify: `src/composables/useUploadQueue.js`
- Create: `src/utils/json.js`
- Create: `src/constants/currency.js`
- Test: focused frontend/backend helper tests

- [ ] **Step 1: Write failing tests for shared parsing and constant ownership where coverage is missing**
- [ ] **Step 2: Introduce one frontend JSON helper module and one currency constants module**
- [ ] **Step 3: Rewire obvious direct `JSON.parse(...)` call sites to the shared helper**
- [ ] **Step 4: Collapse duplicate `variant-meta` backend file into a thin re-export or direct shared import**
- [ ] **Step 5: Remove unnecessary multi-hop barrel exports where a direct shared export is sufficient**
- [ ] **Step 6: Run focused tests and touched lint scope**
- [ ] **Step 7: Commit**

```bash
git add src/utils/json.js src/constants/currency.js src/utils/sales-space.js src/composables/useProductForm.js functions/api/utils/order-binding-snapshot.js src/components/product/ProductDetail.vue src/views/sales/SalesFormView.vue src/components/OrderEditModal.vue src/components/OrderCreateModal.vue src/composables/useUploadQueue.js src/utils/variant-meta.js functions/lib/utils/variant-meta.js functions/_shared/utils.js functions/lib/_shared/utils.js functions/lib/hono/_shared/utils.js
git commit -m "refactor: consolidate duplicated helpers"
```

## Task 4: Complete the Document Space Template Path

**Files:**
- Create: `src/components/space/SpaceDocument.vue`
- Modify: `src/views/Space.vue`
- Modify: `src/views/sales/SalesSpaceDetailView.vue`
- Test: add or update space-view tests

- [ ] **Step 1: Write failing tests that `document` spaces no longer resolve to masonry**
- [ ] **Step 2: Create the dedicated `SpaceDocument.vue` renderer with document-oriented layout semantics**
- [ ] **Step 3: Rewire both public and sales space detail views to use the dedicated component**
- [ ] **Step 4: Re-run focused tests and confirm `document` routes render through the new component**
- [ ] **Step 5: Commit**

```bash
git add src/components/space/SpaceDocument.vue src/views/Space.vue src/views/sales/SalesSpaceDetailView.vue
git commit -m "feat: add dedicated space document template"
```

## Task 5: Remove Deterministic Dead Code and Invalid Suppressions

**Files:**
- Modify: `functions/api/utils/id.js`
- Modify: `functions/api/utils/file-utils.js`
- Modify: `functions/lib/hono/routes/manage/products/[id].js`
- Modify: `functions/repositories/order/mutations.js`
- Modify: `functions/utils/ai-utils.js`

- [ ] **Step 1: Use the existing lint warnings as the RED baseline**
- [ ] **Step 2: Delete unused imports, rename intentionally unused args, and remove invalid eslint-disable comments**
- [ ] **Step 3: Re-run the exact lint command and confirm warnings are gone**
- [ ] **Step 4: Commit**

```bash
git add functions/api/utils/id.js functions/api/utils/file-utils.js functions/lib/hono/routes/manage/products/[id].js functions/repositories/order/mutations.js functions/utils/ai-utils.js
git commit -m "chore: remove deterministic lint noise"
```

## Stage 2 Follow-Up

Create a dedicated second-stage plan for:

- `providerCache` env-keying (`14`)
- cross-runtime purchase-order projection deduplication (`16`)
- large-file decomposition in `PurchaseOrders.vue`, `useProductForm.js`, `ProductCatalogService.js`, and `PurchaseOrderRepository.js` (`26-29`)

# API Constants Dead Export Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead constant exports from `functions/api/utils/constants.js` without affecting live consumers.

**Architecture:** Add a static audit test that forbids `constants.js` from exporting five unused constants, then delete those exports while preserving the rest of the module. Reuse an existing order-query consumer test to confirm the still-live procurement filter helpers remain intact.

**Tech Stack:** Vitest, ESLint, API utility constants

---

### Task 1: Lock the Dead Export Contract

**Files:**
- Create: `functions/api/utils/__tests__/constants-dead-exports.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/api/utils/constants.js` no longer exports `WEBHOOK_TIMEOUT_MS`, `MAX_WEBHOOK_RETRIES`, `SHARE_TOKEN_LENGTH`, `DEFAULT_PAGE_SIZE`, or `MAX_PAGE_SIZE`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/api/utils/__tests__/constants-dead-exports.audit.test.js
```

Expected: FAIL because the five exports still exist.

### Task 2: Remove the Dead Constant Exports

**Files:**
- Modify: `functions/api/utils/constants.js`
- Test: `functions/api/utils/__tests__/constants-dead-exports.audit.test.js`
- Test: `functions/repositories/__tests__/order-queries.progress-filter.test.js`

- [ ] **Step 1: Delete the five dead constant exports**

Remove only the unused constants and keep the live procurement filter helpers untouched.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/api/utils/__tests__/constants-dead-exports.audit.test.js functions/repositories/__tests__/order-queries.progress-filter.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/api/utils/constants.js functions/api/utils/__tests__/constants-dead-exports.audit.test.js functions/repositories/__tests__/order-queries.progress-filter.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/api/utils/__tests__/constants-dead-exports.audit.test.js functions/repositories/__tests__/order-queries.progress-filter.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-api-constants-dead-export-cleanup-design.md docs/superpowers/plans/2026-04-02-api-constants-dead-export-cleanup-plan.md functions/api/utils/constants.js functions/api/utils/__tests__/constants-dead-exports.audit.test.js
git commit -m "refactor: remove api constants dead exports"
```

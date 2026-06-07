# Route Helper Dead Export Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the dead `createCacheInvalidator` export from shared route helpers.

**Architecture:** Add a static audit test that forbids `route-helpers.js` from exporting `createCacheInvalidator`, then delete that function. Reuse the existing list-cache helper tests to verify the remaining cache helper surface still behaves correctly.

**Tech Stack:** Vitest, ESLint, shared route helpers

---

### Task 1: Lock the Dead Export Contract

**Files:**

- Create: `functions/lib/hono/_shared/__tests__/route-helpers-dead-exports.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/lib/hono/_shared/route-helpers.js` no longer defines `createCacheInvalidator`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/route-helpers-dead-exports.audit.test.js
```

Expected: FAIL because the export still exists.

### Task 2: Delete the Dead Export

**Files:**

- Modify: `functions/lib/hono/_shared/route-helpers.js`

- [ ] **Step 1: Remove `createCacheInvalidator`**

Delete the dead export from `route-helpers.js`.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/route-helpers-dead-exports.audit.test.js functions/lib/hono/_shared/__tests__/route-helpers.list-cache.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/lib/hono/_shared/route-helpers.js functions/lib/hono/_shared/__tests__/route-helpers-dead-exports.audit.test.js functions/lib/hono/_shared/__tests__/route-helpers.list-cache.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/route-helpers-dead-exports.audit.test.js functions/lib/hono/_shared/__tests__/route-helpers.list-cache.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-route-helper-dead-export-cleanup-design.md docs/superpowers/plans/2026-04-02-route-helper-dead-export-cleanup-plan.md functions/lib/hono/_shared/route-helpers.js functions/lib/hono/_shared/__tests__/route-helpers-dead-exports.audit.test.js
git commit -m "refactor: remove route helper dead export"
```

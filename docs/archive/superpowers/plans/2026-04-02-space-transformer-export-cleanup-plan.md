# Space Transformer Export Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink the space transformer module to expose only the exports the repository actually uses.

**Architecture:** Add a static audit test that forbids `transformers.js` from exporting `transformFile` and `transformSpaceStats`, then convert `transformFile` into a local helper and remove `transformSpaceStats`. Reuse the existing transformer tests to verify the remaining public API is unchanged.

**Tech Stack:** Vitest, ESLint, manage spaces transformers

---

### Task 1: Lock the Export Surface Contract

**Files:**

- Create: `functions/lib/hono/routes/manage/spaces/__tests__/transformers-thin-exports.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/lib/hono/routes/manage/spaces/transformers.js` no longer exports `transformFile` or `transformSpaceStats`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/spaces/__tests__/transformers-thin-exports.audit.test.js
```

Expected: FAIL because both exports still exist.

### Task 2: Remove the Unused Exports

**Files:**

- Modify: `functions/lib/hono/routes/manage/spaces/transformers.js`

- [ ] **Step 1: Remove the extra exports**

Make `transformFile` local-only and delete `transformSpaceStats`.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/spaces/__tests__/transformers-thin-exports.audit.test.js functions/lib/hono/routes/manage/spaces/__tests__/transformers.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/lib/hono/routes/manage/spaces/transformers.js functions/lib/hono/routes/manage/spaces/__tests__/transformers-thin-exports.audit.test.js functions/lib/hono/routes/manage/spaces/__tests__/transformers.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/spaces/__tests__/transformers-thin-exports.audit.test.js functions/lib/hono/routes/manage/spaces/__tests__/transformers.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-space-transformer-export-cleanup-design.md docs/superpowers/plans/2026-04-02-space-transformer-export-cleanup-plan.md functions/lib/hono/routes/manage/spaces/transformers.js functions/lib/hono/routes/manage/spaces/__tests__/transformers-thin-exports.audit.test.js
git commit -m "refactor: remove space transformer dead exports"
```

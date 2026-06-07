# Audit Failure Recorded Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `hasAuditFailureRecorded` thin wrapper so the global error handler checks the audit-failure flag directly.

**Architecture:** Add a static audit test that forbids `audit-helpers.js` from exporting `hasAuditFailureRecorded`, then inline the boolean context lookup in `errorHandler.js`. Reuse the audit runtime alignment test to confirm failed write attempts still emit the expected audit event.

**Tech Stack:** Vitest, ESLint, Hono middleware, audit helpers

---

### Task 1: Lock the Wrapper Removal Contract

**Files:**

- Create: `functions/lib/hono/_shared/__tests__/audit-helpers-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/lib/hono/_shared/audit-helpers.js` no longer defines `hasAuditFailureRecorded`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/audit-helpers-thin-wrappers.audit.test.js
```

Expected: FAIL because the wrapper still exists.

### Task 2: Inline the Context Flag Check

**Files:**

- Modify: `functions/lib/hono/_shared/audit-helpers.js`
- Modify: `functions/lib/hono/middleware/errorHandler.js`

- [ ] **Step 1: Remove the wrapper and update the call site**

Delete `hasAuditFailureRecorded` and have `errorHandler.js` check `Boolean(c.get('auditFailureRecorded'))` directly.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/audit-helpers-thin-wrappers.audit.test.js functions/lib/hono/_shared/__tests__/audit-runtime-alignment.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/lib/hono/_shared/audit-helpers.js functions/lib/hono/middleware/errorHandler.js functions/lib/hono/_shared/__tests__/audit-helpers-thin-wrappers.audit.test.js functions/lib/hono/_shared/__tests__/audit-runtime-alignment.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/audit-helpers-thin-wrappers.audit.test.js functions/lib/hono/_shared/__tests__/audit-runtime-alignment.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-audit-failure-recorded-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-audit-failure-recorded-wrapper-cleanup-plan.md functions/lib/hono/_shared/audit-helpers.js functions/lib/hono/middleware/errorHandler.js functions/lib/hono/_shared/__tests__/audit-helpers-thin-wrappers.audit.test.js
git commit -m "refactor: remove audit failure-recorded wrapper"
```

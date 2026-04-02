# Audit Helper Dead Export Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the dead `recordAuditEvents` export from shared audit helpers without affecting live audit flows.

**Architecture:** Add a static audit test that forbids `audit-helpers.js` from exporting `recordAuditEvents`, then delete that unused helper. Reuse existing auth-helper and audit-runtime tests to confirm the real audit event pipelines still work after the export surface shrinks.

**Tech Stack:** Vitest, ESLint, shared audit helpers

---

### Task 1: Lock the Dead Export Contract

**Files:**
- Create: `functions/lib/hono/_shared/__tests__/audit-helper-dead-exports.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/lib/hono/_shared/audit-helpers.js` no longer exports `recordAuditEvents`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/audit-helper-dead-exports.audit.test.js
```

Expected: FAIL because the export still exists.

### Task 2: Remove the Dead Export

**Files:**
- Modify: `functions/lib/hono/_shared/audit-helpers.js`
- Test: `functions/lib/hono/_shared/__tests__/audit-helper-dead-exports.audit.test.js`
- Test: `functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js`
- Test: `functions/lib/hono/_shared/__tests__/audit-runtime-alignment.test.js`

- [ ] **Step 1: Delete `recordAuditEvents`**

Remove the dead export and keep the live single-event audit helpers unchanged.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/audit-helper-dead-exports.audit.test.js functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js functions/lib/hono/_shared/__tests__/audit-runtime-alignment.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/lib/hono/_shared/audit-helpers.js functions/lib/hono/_shared/__tests__/audit-helper-dead-exports.audit.test.js functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js functions/lib/hono/_shared/__tests__/audit-runtime-alignment.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/audit-helper-dead-exports.audit.test.js functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js functions/lib/hono/_shared/__tests__/audit-runtime-alignment.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-audit-helper-dead-export-cleanup-design.md docs/superpowers/plans/2026-04-02-audit-helper-dead-export-cleanup-plan.md functions/lib/hono/_shared/audit-helpers.js functions/lib/hono/_shared/__tests__/audit-helper-dead-exports.audit.test.js
git commit -m "refactor: remove audit helper dead export"
```

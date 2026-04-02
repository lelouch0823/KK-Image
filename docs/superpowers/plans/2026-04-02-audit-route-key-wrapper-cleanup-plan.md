# Audit Route Key Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the dead `getIgnoredAuditRouteKeys` wrapper from audit route exclusions.

**Architecture:** Add a static audit test that forbids `audit-route-exclusions.js` from exporting `getIgnoredAuditRouteKeys`, then delete the unused wrapper. Verification is static because the helper has no repository call sites.

**Tech Stack:** Vitest, ESLint, audit route helper module

---

### Task 1: Lock the Wrapper Removal Contract

**Files:**
- Create: `functions/lib/hono/_shared/__tests__/audit-route-exclusions-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/lib/hono/_shared/audit-route-exclusions.js` no longer defines `getIgnoredAuditRouteKeys`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/audit-route-exclusions-thin-wrappers.audit.test.js
```

Expected: FAIL because the wrapper still exists.

### Task 2: Delete the Dead Wrapper

**Files:**
- Modify: `functions/lib/hono/_shared/audit-route-exclusions.js`

- [ ] **Step 1: Remove the wrapper**

Delete `getIgnoredAuditRouteKeys`.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/audit-route-exclusions-thin-wrappers.audit.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/lib/hono/_shared/audit-route-exclusions.js functions/lib/hono/_shared/__tests__/audit-route-exclusions-thin-wrappers.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/audit-route-exclusions-thin-wrappers.audit.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-audit-route-key-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-audit-route-key-wrapper-cleanup-plan.md functions/lib/hono/_shared/audit-route-exclusions.js functions/lib/hono/_shared/__tests__/audit-route-exclusions-thin-wrappers.audit.test.js
git commit -m "refactor: remove audit route key wrapper"
```

# V1 Permissions Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `findUnknownPermissions` thin wrapper so v1 permission validation uses `findUnknownPolicyActions` directly.

**Architecture:** Add a static audit test that forbids `permissions-validation.js` from exporting `findUnknownPermissions`, then update the shared validator and v1 permissions route to call `findUnknownPolicyActions` directly. Reuse existing contract tests to confirm unknown-permission rejection remains intact.

**Tech Stack:** Vitest, ESLint, Hono v1 routes, authz helpers

---

### Task 1: Lock the Wrapper Removal Contract

**Files:**
- Create: `functions/lib/hono/routes/v1/__tests__/permissions-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/lib/hono/routes/v1/_shared/permissions-validation.js` no longer defines `findUnknownPermissions`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/v1/__tests__/permissions-thin-wrappers.audit.test.js
```

Expected: FAIL because the wrapper still exists.

### Task 2: Inline the Real Unknown-Action Helper

**Files:**
- Modify: `functions/lib/hono/routes/v1/_shared/permissions-validation.js`
- Modify: `functions/lib/hono/routes/v1/permissions.js`

- [ ] **Step 1: Remove the wrapper and update call sites**

Delete `findUnknownPermissions`, have `assertKnownPermissions` call `findUnknownPolicyActions` directly, and import `findUnknownPolicyActions` directly in `permissions.js`.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/v1/__tests__/permissions-thin-wrappers.audit.test.js functions/lib/hono/routes/v1/__tests__/permissions-contract.test.js functions/lib/hono/routes/v1/__tests__/users-permissions-validation.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/lib/hono/routes/v1/permissions.js functions/lib/hono/routes/v1/_shared/permissions-validation.js functions/lib/hono/routes/v1/__tests__/permissions-thin-wrappers.audit.test.js functions/lib/hono/routes/v1/__tests__/permissions-contract.test.js functions/lib/hono/routes/v1/__tests__/users-permissions-validation.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/v1/__tests__/permissions-thin-wrappers.audit.test.js functions/lib/hono/routes/v1/__tests__/permissions-contract.test.js functions/lib/hono/routes/v1/__tests__/users-permissions-validation.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-v1-permissions-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-v1-permissions-wrapper-cleanup-plan.md functions/lib/hono/routes/v1/permissions.js functions/lib/hono/routes/v1/_shared/permissions-validation.js functions/lib/hono/routes/v1/__tests__/permissions-thin-wrappers.audit.test.js
git commit -m "refactor: remove v1 permissions wrapper"
```

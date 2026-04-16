# Auth Helper Cookie Export Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the dead `setSalesTokenCookie` export from shared auth helpers while preserving sales auth behavior.

**Architecture:** Add a static audit test that forbids `auth-helpers.js` from exporting `setSalesTokenCookie`, then convert that helper into a file-local function. Reuse the existing auth helper audit tests to verify the lockout and failure audit flows still work after the export surface is reduced.

**Tech Stack:** Vitest, ESLint, shared auth helpers

---

### Task 1: Lock the Dead Export Contract

**Files:**
- Create: `functions/lib/hono/_shared/__tests__/auth-helper-dead-exports.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/lib/hono/_shared/auth-helpers.js` no longer defines `setSalesTokenCookie` as an exported function.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/auth-helper-dead-exports.audit.test.js
```

Expected: FAIL because the export still exists.

### Task 2: Remove the Dead Export

**Files:**
- Modify: `functions/lib/hono/_shared/auth-helpers.js`
- Test: `functions/lib/hono/_shared/__tests__/auth-helper-dead-exports.audit.test.js`
- Test: `functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js`

- [ ] **Step 1: Convert `setSalesTokenCookie` into a local helper**

Keep the cookie-setting behavior unchanged, but remove the `export` keyword so only `generateSalesToken` uses it internally.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/auth-helper-dead-exports.audit.test.js functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/lib/hono/_shared/auth-helpers.js functions/lib/hono/_shared/__tests__/auth-helper-dead-exports.audit.test.js functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/auth-helper-dead-exports.audit.test.js functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-auth-helper-cookie-export-cleanup-design.md docs/superpowers/plans/2026-04-02-auth-helper-cookie-export-cleanup-plan.md functions/lib/hono/_shared/auth-helpers.js functions/lib/hono/_shared/__tests__/auth-helper-dead-exports.audit.test.js
git commit -m "refactor: remove auth helper cookie export"
```

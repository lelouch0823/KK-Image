# Auth Dead Export Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the dead `generateApiKey` export from `functions/api/utils/auth.js` without affecting live auth flows.

**Architecture:** Add a static audit test that forbids `auth.js` from exporting `generateApiKey`, then delete that unused helper. Reuse the existing auth util test suite to confirm JWT generation, API key verification, and Turnstile verification still behave normally.

**Tech Stack:** Vitest, ESLint, auth utilities

---

### Task 1: Lock the Dead Export Contract

**Files:**

- Create: `functions/api/utils/__tests__/auth-dead-exports.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/api/utils/auth.js` no longer exports `generateApiKey`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/api/utils/__tests__/auth-dead-exports.audit.test.js
```

Expected: FAIL because the export still exists.

### Task 2: Remove the Dead Export

**Files:**

- Modify: `functions/api/utils/auth.js`
- Test: `functions/api/utils/__tests__/auth-dead-exports.audit.test.js`
- Test: `functions/api/utils/__tests__/auth.test.js`

- [ ] **Step 1: Delete `generateApiKey`**

Remove the dead export and keep all remaining auth util behavior unchanged.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/api/utils/__tests__/auth-dead-exports.audit.test.js functions/api/utils/__tests__/auth.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/api/utils/auth.js functions/api/utils/__tests__/auth-dead-exports.audit.test.js functions/api/utils/__tests__/auth.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/api/utils/__tests__/auth-dead-exports.audit.test.js functions/api/utils/__tests__/auth.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-auth-dead-export-cleanup-design.md docs/superpowers/plans/2026-04-02-auth-dead-export-cleanup-plan.md functions/api/utils/auth.js functions/api/utils/__tests__/auth-dead-exports.audit.test.js
git commit -m "refactor: remove auth dead export"
```

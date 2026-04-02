# Auth Helpers Locked Message Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `getLockedMessage` thin wrapper so auth helper lockout responses format the locked message inline.

**Architecture:** Add a static audit test that forbids `auth-helpers.js` from exporting `getLockedMessage`, then inline the locked-message formatting at the two current response sites. Reuse the existing auth-helper integration tests to confirm lockout and failure flows still behave correctly.

**Tech Stack:** Vitest, ESLint, Hono auth helpers

---

### Task 1: Lock the Wrapper Removal Contract

**Files:**
- Create: `functions/lib/hono/_shared/__tests__/auth-helpers-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/lib/hono/_shared/auth-helpers.js` no longer defines `getLockedMessage`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/auth-helpers-thin-wrappers.audit.test.js
```

Expected: FAIL because the wrapper still exists.

### Task 2: Inline the Locked Message Formatting

**Files:**
- Modify: `functions/lib/hono/_shared/auth-helpers.js`

- [ ] **Step 1: Remove the wrapper and inline the format**

Delete `getLockedMessage` and inline `MSG.AUTH.ACCOUNT_LOCKED.replace('{time}', formatRetryAfter(...))` in the two lockout response bodies.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/auth-helpers-thin-wrappers.audit.test.js functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/lib/hono/_shared/auth-helpers.js functions/lib/hono/_shared/__tests__/auth-helpers-thin-wrappers.audit.test.js functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/_shared/__tests__/auth-helpers-thin-wrappers.audit.test.js functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-auth-helpers-locked-message-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-auth-helpers-locked-message-wrapper-cleanup-plan.md functions/lib/hono/_shared/auth-helpers.js functions/lib/hono/_shared/__tests__/auth-helpers-thin-wrappers.audit.test.js
git commit -m "refactor: remove auth locked-message wrapper"
```

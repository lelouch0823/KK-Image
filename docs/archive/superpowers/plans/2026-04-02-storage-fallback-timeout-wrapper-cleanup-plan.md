# Storage Fallback Timeout Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `getFallbackTimeout` wrapper so storage fallback timeout parsing happens directly inside `getFileWithFallback`.

**Architecture:** Add a static audit test that forbids `router.js` from exporting `getFallbackTimeout`, then inline the timeout parsing inside `getFileWithFallback`. Add a focused behavior test that simulates a timed-out first provider and confirms fallback proceeds to the next provider using the env timeout value.

**Tech Stack:** Vitest, ESLint, storage redundancy helpers

---

### Task 1: Lock the Wrapper Removal Contract

**Files:**

- Create: `functions/storage/__tests__/router-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/storage/router.js` no longer defines `getFallbackTimeout`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/storage/__tests__/router-thin-wrappers.audit.test.js
```

Expected: FAIL because the wrapper still exists.

### Task 2: Inline the Timeout Parsing

**Files:**

- Create: `functions/storage/__tests__/redundancy-fallback-timeout.test.js`
- Modify: `functions/storage/router.js`
- Modify: `functions/storage/redundancy.js`

- [ ] **Step 1: Add the behavior test and remove the wrapper**

Write a focused timeout fallback test for `getFileWithFallback`, then delete `getFallbackTimeout` and inline `parseInt(env.STORAGE_FALLBACK_TIMEOUT || '3000', 10)` in `redundancy.js`.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/storage/__tests__/router-thin-wrappers.audit.test.js functions/storage/__tests__/redundancy-fallback-timeout.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/storage/router.js functions/storage/redundancy.js functions/storage/__tests__/router-thin-wrappers.audit.test.js functions/storage/__tests__/redundancy-fallback-timeout.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/storage/__tests__/router-thin-wrappers.audit.test.js functions/storage/__tests__/redundancy-fallback-timeout.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-storage-fallback-timeout-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-storage-fallback-timeout-wrapper-cleanup-plan.md functions/storage/router.js functions/storage/redundancy.js functions/storage/__tests__/router-thin-wrappers.audit.test.js functions/storage/__tests__/redundancy-fallback-timeout.test.js
git commit -m "refactor: remove storage fallback-timeout wrapper"
```

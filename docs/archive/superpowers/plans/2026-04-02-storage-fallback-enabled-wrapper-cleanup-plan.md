# Storage Fallback Enabled Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `isFallbackEnabled` wrapper so fallback enablement is checked directly inside `getFileWithFallback`.

**Architecture:** Extend the existing storage router audit test to forbid `isFallbackEnabled`, then inline the env flag check in `getFileWithFallback`. Extend the storage redundancy behavior tests to cover the disabled-fallback branch and ensure only the default provider is called.

**Tech Stack:** Vitest, ESLint, storage redundancy helpers

---

### Task 1: Lock the Wrapper Removal Contract

**Files:**
- Modify: `functions/storage/__tests__/router-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing audit assertion**

Extend the audit test so `functions/storage/router.js` may not define `isFallbackEnabled`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/storage/__tests__/router-thin-wrappers.audit.test.js
```

Expected: FAIL because the wrapper still exists.

### Task 2: Inline the Fallback Enabled Check

**Files:**
- Modify: `functions/storage/router.js`
- Modify: `functions/storage/redundancy.js`
- Modify: `functions/storage/__tests__/redundancy-fallback-timeout.test.js`

- [ ] **Step 1: Add the behavior assertion and remove the wrapper**

Add a disabled-fallback behavior test, then delete `isFallbackEnabled` and inline `env.STORAGE_FALLBACK_ENABLED !== 'false'` in `redundancy.js`.

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
git add docs/superpowers/specs/2026-04-02-storage-fallback-enabled-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-storage-fallback-enabled-wrapper-cleanup-plan.md functions/storage/router.js functions/storage/redundancy.js functions/storage/__tests__/router-thin-wrappers.audit.test.js functions/storage/__tests__/redundancy-fallback-timeout.test.js
git commit -m "refactor: remove storage fallback-enabled wrapper"
```

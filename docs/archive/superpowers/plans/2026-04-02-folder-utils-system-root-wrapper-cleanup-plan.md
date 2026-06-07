# Folder Utils System Root Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the exported `ensureSystemRoot` wrapper so folder utility callers create the `_System` root directly via `ensureFolder`.

**Architecture:** Add a static audit test that forbids `folder-utils.js` from defining `ensureSystemRoot`, then inline `ensureFolder(env, '_System', null, true)` inside `ensureProductFolder`, `ensureOrderFolder`, and `ensureSpaceFolder`. Update the folder-utils tests to verify the nested creation behavior without importing the wrapper.

**Tech Stack:** Vitest, ESLint, folder utility helpers

---

### Task 1: Lock the Cleanup Contract

**Files:**

- Create: `functions/api/utils/__tests__/folder-utils-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/api/utils/folder-utils.js` no longer defines `ensureSystemRoot`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/api/utils/__tests__/folder-utils-thin-wrappers.audit.test.js
```

Expected: FAIL because the wrapper still exists.

### Task 2: Inline `_System` Root Creation

**Files:**

- Modify: `functions/api/utils/folder-utils.js`
- Modify: `functions/api/utils/__tests__/folder-utils.test.js`

- [ ] **Step 1: Remove the wrapper and update tests**

Delete `ensureSystemRoot`, inline its body at the three current call sites, and adjust tests to stop importing it while still verifying `_System` root creation.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/api/utils/__tests__/folder-utils-thin-wrappers.audit.test.js functions/api/utils/__tests__/folder-utils.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/api/utils/folder-utils.js functions/api/utils/__tests__/folder-utils.test.js functions/api/utils/__tests__/folder-utils-thin-wrappers.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/api/utils/__tests__/folder-utils-thin-wrappers.audit.test.js functions/api/utils/__tests__/folder-utils.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-folder-utils-system-root-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-folder-utils-system-root-wrapper-cleanup-plan.md functions/api/utils/folder-utils.js functions/api/utils/__tests__/folder-utils.test.js functions/api/utils/__tests__/folder-utils-thin-wrappers.audit.test.js
git commit -m "refactor: remove folder utils system-root wrapper"
```

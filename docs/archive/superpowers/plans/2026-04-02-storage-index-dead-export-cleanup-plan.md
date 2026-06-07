# Storage Index Dead Export Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the dead storage index exports that have no repository call sites.

**Architecture:** Add a static audit test that forbids `storage/index.js` from exporting `getProviderForFile`, `listAvailableProviders`, and `clearProviderCache`, then delete those exports. Verification is static plus lint because the removed APIs have no repository runtime usage.

**Tech Stack:** Vitest, ESLint, storage factory module

---

### Task 1: Lock the Dead Export Removal Contract

**Files:**

- Create: `functions/storage/__tests__/index-dead-exports.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/storage/index.js` no longer defines `getProviderForFile`, `listAvailableProviders`, or `clearProviderCache`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/storage/__tests__/index-dead-exports.audit.test.js
```

Expected: FAIL because the dead exports still exist.

### Task 2: Delete the Dead Exports

**Files:**

- Modify: `functions/storage/index.js`

- [ ] **Step 1: Remove the dead exports**

Delete `getProviderForFile`, `listAvailableProviders`, and `clearProviderCache`.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/storage/__tests__/index-dead-exports.audit.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/storage/index.js functions/storage/__tests__/index-dead-exports.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/storage/__tests__/index-dead-exports.audit.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-storage-index-dead-export-cleanup-design.md docs/superpowers/plans/2026-04-02-storage-index-dead-export-cleanup-plan.md functions/storage/index.js functions/storage/__tests__/index-dead-exports.audit.test.js
git commit -m "refactor: remove dead storage index exports"
```

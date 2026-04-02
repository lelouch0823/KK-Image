# Storage Index Provider Re-Export Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unused provider class re-exports from the storage index module.

**Architecture:** Add a static audit test that forbids `storage/index.js` from re-exporting the provider classes, then delete those re-export lines. Verification is static plus lint because no repository runtime code imports those re-exports.

**Tech Stack:** Vitest, ESLint, storage factory module

---

### Task 1: Lock the Re-Export Removal Contract

**Files:**
- Create: `functions/storage/__tests__/index-provider-reexports.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/storage/index.js` no longer re-exports `BaseStorageProvider`, `TelegramStorageProvider`, `R2StorageProvider`, or `S3StorageProvider`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/storage/__tests__/index-provider-reexports.audit.test.js
```

Expected: FAIL because the re-export lines still exist.

### Task 2: Delete the Unused Re-Exports

**Files:**
- Modify: `functions/storage/index.js`

- [ ] **Step 1: Remove the re-export lines**

Delete the provider class re-exports from `storage/index.js`.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/storage/__tests__/index-provider-reexports.audit.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/storage/index.js functions/storage/__tests__/index-provider-reexports.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/storage/__tests__/index-provider-reexports.audit.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-storage-index-provider-reexport-cleanup-design.md docs/superpowers/plans/2026-04-02-storage-index-provider-reexport-cleanup-plan.md functions/storage/index.js functions/storage/__tests__/index-provider-reexports.audit.test.js
git commit -m "refactor: remove storage provider re-exports"
```

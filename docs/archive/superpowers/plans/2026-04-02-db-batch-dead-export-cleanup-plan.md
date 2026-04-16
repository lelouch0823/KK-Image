# DB Batch Dead Export Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead exports from `functions/lib/db/batch.js` while preserving the live shared batch helpers.

**Architecture:** Add a static audit test that forbids `batch.js` from exporting six unused symbols, then delete the dead exports and dead helper implementations. Keep `chunkArray` and `executeBatchChunks` as the only public surface, and reuse existing db/repository tests to verify the active batching paths stay intact.

**Tech Stack:** Vitest, ESLint, shared D1 batch helpers

---

### Task 1: Lock the Dead Export Contract

**Files:**
- Create: `functions/lib/db/__tests__/batch-dead-exports.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/lib/db/batch.js` no longer exports `D1_MAX_BATCH_SIZE`, `batchInsert`, `batchUpdate`, `batchDelete`, `batchUpsert`, or `transaction`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/db/__tests__/batch-dead-exports.audit.test.js
```

Expected: FAIL because the dead exports still exist.

### Task 2: Remove the Dead Exports

**Files:**
- Modify: `functions/lib/db/batch.js`
- Test: `functions/lib/db/__tests__/batch-dead-exports.audit.test.js`
- Test: `functions/lib/db/__tests__/batch.test.js`
- Test: `functions/repositories/__tests__/batch-safety-repositories.test.js`

- [ ] **Step 1: Delete the dead exports**

Remove the six unused exported symbols and keep `chunkArray` plus `executeBatchChunks` unchanged for active consumers.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/db/__tests__/batch-dead-exports.audit.test.js functions/lib/db/__tests__/batch.test.js functions/repositories/__tests__/batch-safety-repositories.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/lib/db/batch.js functions/lib/db/__tests__/batch-dead-exports.audit.test.js functions/lib/db/__tests__/batch.test.js functions/repositories/__tests__/batch-safety-repositories.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/db/__tests__/batch-dead-exports.audit.test.js functions/lib/db/__tests__/batch.test.js functions/repositories/__tests__/batch-safety-repositories.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-db-batch-dead-export-cleanup-design.md docs/superpowers/plans/2026-04-02-db-batch-dead-export-cleanup-plan.md functions/lib/db/batch.js functions/lib/db/__tests__/batch-dead-exports.audit.test.js
git commit -m "refactor: remove db batch dead exports"
```

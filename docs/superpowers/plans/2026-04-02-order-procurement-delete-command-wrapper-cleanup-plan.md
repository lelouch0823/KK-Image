# Order Procurement Delete Command Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `buildDeleteCommandStatement` wrapper so reserved-command cleanup builds its fallback delete statement inline.

**Architecture:** Add a static audit test that forbids `order-procurement-shared.js` from exporting `buildDeleteCommandStatement`, then inline the delete statement in `cleanupReservedCommand`. Update the shared unit tests so fallback cleanup behavior is verified through the real call path instead of the removed helper export.

**Tech Stack:** Vitest, ESLint, shared order procurement helpers

---

### Task 1: Lock the Wrapper Removal Contract

**Files:**
- Create: `functions/services/__tests__/order-procurement-shared-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/services/order-procurement-shared.js` no longer defines `buildDeleteCommandStatement`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-procurement-shared-thin-wrappers.audit.test.js
```

Expected: FAIL because the wrapper still exists.

### Task 2: Inline the Fallback Delete Statement

**Files:**
- Modify: `functions/services/order-procurement-shared.js`
- Modify: `functions/services/__tests__/order-procurement-shared.test.js`

- [ ] **Step 1: Remove the wrapper and update tests**

Delete `buildDeleteCommandStatement`, inline the delete statement in `cleanupReservedCommand`, and replace the direct helper test with a fallback cleanup-path assertion.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-procurement-shared-thin-wrappers.audit.test.js functions/services/__tests__/order-procurement-shared.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/services/order-procurement-shared.js functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/order-procurement-shared-thin-wrappers.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-procurement-shared-thin-wrappers.audit.test.js functions/services/__tests__/order-procurement-shared.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-order-procurement-delete-command-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-order-procurement-delete-command-wrapper-cleanup-plan.md functions/services/order-procurement-shared.js functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/order-procurement-shared-thin-wrappers.audit.test.js
git commit -m "refactor: remove procurement delete-command wrapper"
```

# Order Helper Dead Export Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead helper exports from `functions/repositories/order/helpers.js` without changing order mapping behavior.

**Architecture:** Add a static audit test that forbids `helpers.js` from exporting `mapOrderLine` and `aggregateOrderDisplayStatus`, then convert both helpers into file-local functions. Reuse the existing order helper and order query tests to verify procurement status defaults and aggregated display-status behavior remain unchanged.

**Tech Stack:** Vitest, ESLint, repository order helpers

---

### Task 1: Lock the Dead Export Contract

**Files:**
- Create: `functions/repositories/__tests__/order-helper-dead-exports.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/repositories/order/helpers.js` no longer exports `mapOrderLine` or `aggregateOrderDisplayStatus`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/repositories/__tests__/order-helper-dead-exports.audit.test.js
```

Expected: FAIL because both exports still exist.

### Task 2: Remove the Dead Exports

**Files:**
- Modify: `functions/repositories/order/helpers.js`
- Test: `functions/repositories/__tests__/order-helper-dead-exports.audit.test.js`
- Test: `functions/repositories/__tests__/order-helpers.procurement-status.test.js`
- Test: `functions/repositories/__tests__/order-queries.display-model.test.js`

- [ ] **Step 1: Convert the dead exports into local helpers**

Keep the mapping and aggregation logic unchanged, but remove the `export` keyword from `mapOrderLine` and `aggregateOrderDisplayStatus`.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/repositories/__tests__/order-helper-dead-exports.audit.test.js functions/repositories/__tests__/order-helpers.procurement-status.test.js functions/repositories/__tests__/order-queries.display-model.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/repositories/order/helpers.js functions/repositories/__tests__/order-helper-dead-exports.audit.test.js functions/repositories/__tests__/order-helpers.procurement-status.test.js functions/repositories/__tests__/order-queries.display-model.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/repositories/__tests__/order-helper-dead-exports.audit.test.js functions/repositories/__tests__/order-helpers.procurement-status.test.js functions/repositories/__tests__/order-queries.display-model.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-order-helper-dead-export-cleanup-design.md docs/superpowers/plans/2026-04-02-order-helper-dead-export-cleanup-plan.md functions/repositories/order/helpers.js functions/repositories/__tests__/order-helper-dead-exports.audit.test.js
git commit -m "refactor: remove order helper dead exports"
```

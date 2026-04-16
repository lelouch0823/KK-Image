# Order Mutations Inventory Service Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the local `resolveInventoryService` wrapper from order mutations so inventory service fallback is inlined at each current call site.

**Architecture:** Add a static audit test that forbids `mutations.js` from defining `resolveInventoryService`, then inline `options.inventoryService || new InventoryService(db)` inside `updateStatus` and `batchUpdateStatus`. Use the current order inventory flow and order mutations tests as regression coverage.

**Tech Stack:** Vitest, ESLint, repository-layer order mutations

---

### Task 1: Lock the Cleanup Contract

**Files:**
- Create: `functions/repositories/__tests__/order-inventory-service-wrapper.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/repositories/order/mutations.js` no longer defines `resolveInventoryService`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/repositories/__tests__/order-inventory-service-wrapper.audit.test.js
```

Expected: FAIL because the wrapper still exists.

### Task 2: Inline Inventory Service Fallback

**Files:**
- Modify: `functions/repositories/order/mutations.js`

- [ ] **Step 1: Remove the local wrapper**

Delete `resolveInventoryService` and inline `options.inventoryService || new InventoryService(db)` in the two current call sites.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/repositories/__tests__/order-inventory-service-wrapper.audit.test.js functions/repositories/__tests__/order-inventory-flow.test.js functions/repositories/__tests__/order-mutations.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/repositories/order/mutations.js functions/repositories/__tests__/order-inventory-service-wrapper.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/repositories/__tests__/order-inventory-service-wrapper.audit.test.js functions/repositories/__tests__/order-inventory-flow.test.js functions/repositories/__tests__/order-mutations.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-order-mutations-inventory-service-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-order-mutations-inventory-service-wrapper-cleanup-plan.md functions/repositories/order/mutations.js functions/repositories/__tests__/order-inventory-service-wrapper.audit.test.js
git commit -m "refactor: remove order inventory service wrapper"
```

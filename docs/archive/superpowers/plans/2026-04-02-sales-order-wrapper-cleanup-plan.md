# Sales Order Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the local `requireSalesOrder` wrapper from the sales order route so those entity lookups call `requireEntity` directly.

**Architecture:** Extend the existing route thin-wrapper audit test to forbid `sales/orders.js` from defining `requireSalesOrder`, then inline `requireEntity(orderRepo.findByIdAndSalesperson(...), ...)` at each current call site. Use the existing sales order resilience tests for behavior coverage.

**Tech Stack:** Hono routes, Vitest, ESLint

---

### Task 1: Expand the Audit Contract

**Files:**

- Modify: `functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing audit assertion**

Extend the target list so the audit test also forbids:

- `functions/lib/hono/routes/sales/orders.js` `requireSalesOrder`

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js
```

Expected: FAIL because `requireSalesOrder` still exists.

### Task 2: Inline Sales Order Entity Guards

**Files:**

- Modify: `functions/lib/hono/routes/sales/orders.js`

- [ ] **Step 1: Remove the local wrapper**

Replace each `requireSalesOrder(orderRepo, orderId, salesperson.id)` with a direct `requireEntity(orderRepo.findByIdAndSalesperson(...), ...)` call and delete the helper definition.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/lib/hono/routes/sales/orders.js functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js functions/lib/hono/routes/sales/__tests__/order-create-folder-archive.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-sales-order-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-sales-order-wrapper-cleanup-plan.md functions/lib/hono/routes/sales/orders.js functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js
git commit -m "refactor: remove sales order wrapper"
```

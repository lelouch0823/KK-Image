# Route Entity Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove two manage-route thin wrappers so entity lookup sites call `requireEntity` directly without changing 404 behavior.

**Architecture:** Add one audit test that statically forbids the two wrapper definitions, then inline `requireEntity(repo.findById(...), onNotFound)` at each call site in the affected routes. Rely on existing purchase-order and order-detail route tests for behavioral regression coverage.

**Tech Stack:** Hono routes, Vitest, ESLint

---

### Task 1: Lock the Route Wrapper Cleanup Contract

**Files:**

- Create: `functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test that asserts:

- `purchase-orders.js` no longer defines `requirePurchaseOrder`
- `orders/detail.js` no longer defines `requireOrder`

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js
```

Expected: FAIL because both thin wrappers still exist.

### Task 2: Inline Entity Guards

**Files:**

- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Modify: `functions/lib/hono/routes/manage/orders/detail.js`

- [ ] **Step 1: Remove the two local wrappers**

Inline `requireEntity(repo.findById(...), ...)` at each current call site and delete the helper definitions.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/lib/hono/routes/manage/purchase-orders.js functions/lib/hono/routes/manage/orders/detail.js functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-route-entity-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-route-entity-wrapper-cleanup-plan.md functions/lib/hono/routes/manage/purchase-orders.js functions/lib/hono/routes/manage/orders/detail.js functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js
git commit -m "refactor: remove route entity wrappers"
```

# Order Line Command Quantity Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse one shared positive-quantity parser so order-line command routes and fulfillment service stop carrying duplicate quantity normalization helpers.

**Architecture:** Extend `functions/services/order-line-shared.js` with the positive quantity parser already implied by both call sites. Update the route and service modules to import it directly, and add an audit test to keep local `normalizeQuantity` helpers from reappearing.

**Tech Stack:** Vitest, Hono route modules, order-line service shared helpers

---

### Task 1: Lock Shared Quantity Parsing Contract

**Files:**

- Modify: `functions/services/__tests__/order-line-shared.test.js`
- Create: `functions/services/__tests__/order-line-command-quantity.audit.test.js`

- [ ] **Step 1: Write the failing tests**

Add tests that assert:

- shared order-line helper parses `quantity` / `qty` / `amount`
- shared helper floors positive decimals
- shared helper throws the existing positive-number error for invalid values
- route and service modules no longer define local `normalizeQuantity`

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-line-shared.test.js functions/services/__tests__/order-line-command-quantity.audit.test.js
```

Expected: FAIL because the shared parser and audit constraint do not exist yet.

### Task 2: Reuse Shared Order-Line Quantity Parser

**Files:**

- Modify: `functions/services/order-line-shared.js`
- Modify: `functions/services/OrderLineFulfillmentService.js`
- Modify: `functions/lib/hono/routes/manage/orders/lines.js`

- [ ] **Step 1: Implement the shared parser and remove local copies**

Move the shared positive quantity parsing logic into `order-line-shared.js` and reuse it from both call sites without changing behavior.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-line-shared.test.js functions/services/__tests__/order-line-command-quantity.audit.test.js functions/services/__tests__/OrderLineFulfillmentService.test.js functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/services/order-line-shared.js functions/services/OrderLineFulfillmentService.js functions/lib/hono/routes/manage/orders/lines.js functions/services/__tests__/order-line-shared.test.js functions/services/__tests__/order-line-command-quantity.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-line-shared.test.js functions/services/__tests__/order-line-command-quantity.audit.test.js functions/services/__tests__/OrderLineFulfillmentService.test.js functions/lib/hono/routes/manage/orders/__tests__/line-commands-routes.test.js functions/services/__tests__/service-thin-wrappers.audit.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-order-line-command-quantity-dedup-design.md docs/superpowers/plans/2026-04-02-order-line-command-quantity-dedup-plan.md functions/services/order-line-shared.js functions/services/OrderLineFulfillmentService.js functions/lib/hono/routes/manage/orders/lines.js functions/services/__tests__/order-line-shared.test.js functions/services/__tests__/order-line-command-quantity.audit.test.js
git commit -m "refactor: dedupe order line quantity parsing"
```

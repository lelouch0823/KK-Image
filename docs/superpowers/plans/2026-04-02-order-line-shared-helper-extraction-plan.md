# Order Line Shared Helper Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract generic order-line and inventory helper definitions so procurement and fulfillment services stop duplicating them while preserving current SQL and response behavior.

**Architecture:** Create a new `order-line-shared.js` module for inventory balance lookup and order-line projection update builders. Reuse it from `order-procurement-shared.js` and from `OrderLineFulfillmentService.js`, keeping procurement-specific helpers where they are.

**Tech Stack:** Vitest, ESLint, Cloudflare D1 service modules

---

### Task 1: Lock the New Shared Module Contract

**Files:**
- Create: `functions/services/__tests__/order-line-shared.test.js`
- Modify: `functions/services/__tests__/OrderLineFulfillmentService.test.js`

- [ ] **Step 1: Write the failing tests**

Add tests that assert:
- the new shared module normalizes inventory balance rows and returns `null` for empty `variantId`
- the new shared module preserves full-projection `order_lines` bind parameter order
- fulfillment service SQL expectations remain unchanged after rewiring

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-line-shared.test.js functions/services/__tests__/OrderLineFulfillmentService.test.js functions/services/__tests__/order-procurement-shared.test.js
```

Expected: FAIL because `functions/services/order-line-shared.js` does not exist yet.

### Task 2: Extract and Rewire

**Files:**
- Create: `functions/services/order-line-shared.js`
- Modify: `functions/services/order-procurement-shared.js`
- Modify: `functions/services/OrderLineFulfillmentService.js`

- [ ] **Step 1: Implement the new shared helper file**

Add:
- `queryInventoryBalance`
- `buildOrderLineProjectionStatement`

- [ ] **Step 2: Rewire procurement and fulfillment**

- Make `order-procurement-shared.js` reuse and re-export the generic helpers
- Make `OrderLineFulfillmentService.js` import the generic helpers directly

- [ ] **Step 3: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-line-shared.test.js functions/services/__tests__/OrderLineFulfillmentService.test.js functions/services/__tests__/order-procurement-shared.test.js
```

Expected: PASS

- [ ] **Step 4: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/services/order-line-shared.js functions/services/order-procurement-shared.js functions/services/OrderLineFulfillmentService.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-line-shared.test.js functions/services/__tests__/OrderLineFulfillmentService.test.js functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/repositories/__tests__/PurchaseReceiptRepository.reversal.test.js functions/repositories/__tests__/PurchaseReceiptRepository.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-order-line-shared-helper-extraction-design.md docs/superpowers/plans/2026-04-02-order-line-shared-helper-extraction-plan.md functions/services/order-line-shared.js functions/services/order-procurement-shared.js functions/services/OrderLineFulfillmentService.js functions/services/__tests__/order-line-shared.test.js
git commit -m "refactor: extract order line shared helpers"
```

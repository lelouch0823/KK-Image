# Purchase Order Projection Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate duplicate purchase-order quantity and display-status formulas into the existing backend and frontend projection helpers.

**Architecture:** Extend the backend purchase-order projection module to own purchase-order header math, then rewire repository and service consumers to reuse it. Keep the frontend on its own runtime-safe helper module, but remove remaining view-level quantity fallbacks so UI reads one projection entry point.

**Tech Stack:** Vitest, ESLint, Vue 3, Cloudflare D1 service/repository modules

---

### Task 1: Lock Projection Semantics With Tests

**Files:**

- Create: `functions/services/__tests__/purchase-order-projection.test.js`
- Modify: `functions/repositories/__tests__/PurchaseOrderRepository.read-model.test.js`
- Modify: `functions/services/__tests__/PurchaseOrderService.procurement-status.test.js`
- Modify: `src/utils/__tests__/purchase-order-progress.test.js`

- [ ] **Step 1: Write the failing tests**

Add tests that assert:

- backend helper can derive ordered/received/cancelled/outstanding from either header fields or `items`
- backend helper can derive `display_status` from the same data
- repository read-model fallback still reports the expected `display_status`
- service status gates still reject/allow transitions using the shared projection math
- frontend helper can read cancelled quantities from header fields or `items`

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/purchase-order-projection.test.js functions/repositories/__tests__/PurchaseOrderRepository.read-model.test.js functions/services/__tests__/PurchaseOrderService.procurement-status.test.js src/utils/__tests__/purchase-order-progress.test.js
```

Expected: failures because the new projection helpers do not exist yet.

### Task 2: Reuse Shared Projection Helpers

**Files:**

- Modify: `functions/services/purchase-order-projection.js`
- Modify: `functions/repositories/PurchaseOrderRepository.js`
- Modify: `functions/services/PurchaseOrderService.js`
- Modify: `src/utils/purchase-order-progress.js`
- Modify: `src/views/PurchaseOrders.vue`

- [ ] **Step 1: Implement the backend projection helpers**

Add purchase-order header helper exports to `functions/services/purchase-order-projection.js`, keeping item-level helpers intact.

- [ ] **Step 2: Rewire backend consumers**

Remove duplicate header quantity/status formulas from:

- `functions/repositories/PurchaseOrderRepository.js`
- `functions/services/PurchaseOrderService.js`

- [ ] **Step 3: Rewire frontend progress reads**

Add cancelled-quantity helper support to `src/utils/purchase-order-progress.js` and update `src/views/PurchaseOrders.vue` to use helper reads instead of local number fallbacks.

- [ ] **Step 4: Run the focused tests**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/purchase-order-projection.test.js functions/repositories/__tests__/PurchaseOrderRepository.read-model.test.js functions/services/__tests__/PurchaseOrderService.procurement-status.test.js src/utils/__tests__/purchase-order-progress.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

Expected: PASS

- [ ] **Step 5: Run the broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/services/purchase-order-projection.js functions/repositories/PurchaseOrderRepository.js functions/services/PurchaseOrderService.js src/utils/purchase-order-progress.js src/views/PurchaseOrders.vue
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js functions/services/__tests__/PurchaseOrderService.procurement-status.test.js functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js functions/services/__tests__/purchase-order-moving-average-cost.test.js functions/repositories/__tests__/PurchaseOrderRepository.read-model.test.js src/utils/__tests__/purchase-order-progress.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-purchase-order-projection-dedup-design.md docs/superpowers/plans/2026-04-02-purchase-order-projection-dedup-plan.md functions/services/__tests__/purchase-order-projection.test.js functions/repositories/__tests__/PurchaseOrderRepository.read-model.test.js functions/services/__tests__/PurchaseOrderService.procurement-status.test.js src/utils/__tests__/purchase-order-progress.test.js functions/services/purchase-order-projection.js functions/repositories/PurchaseOrderRepository.js functions/services/PurchaseOrderService.js src/utils/purchase-order-progress.js src/views/PurchaseOrders.vue
git commit -m "refactor: dedupe purchase order projection helpers"
```

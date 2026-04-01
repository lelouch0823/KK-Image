# Purchase Order Command Guard Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate duplicated purchase-order read/guard helpers and purchase-order-item statement shells across procurement command services without changing command behavior.

**Architecture:** Extend the existing `order-procurement-shared.js` module with narrow helpers for purchase-order reads, purchase-order-item ownership checks, inventory balance reads, and purchase-order-item update/revert statement builders. Then rewire the receipt, reversal, and shortage services to consume those helpers while preserving their existing orchestration, preflight checks, and optimistic concurrency guards.

**Tech Stack:** Vitest, ESLint, Cloudflare D1 service modules

---

### Task 1: Lock Helper Extraction Behavior

**Files:**
- Modify: `functions/services/__tests__/order-procurement-shared.test.js`
- Modify: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Modify: `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
- Modify: `functions/services/__tests__/PurchaseOrderShortageClosureService.test.js`

- [ ] **Step 1: Write the failing tests**

Add tests that assert:
- shared helper returns `null` inventory balance when `variantId` is empty and normalizes numeric fields when present
- shared helper rejects missing or foreign `purchase_order_items`
- shared helper preserves forward/revert guard parameters for `purchase_order_items`
- service tests still observe the same SQL shapes and error paths after rewiring

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js
```

Expected: FAIL because the new shared read/guard helpers and statement builders do not exist yet.

### Task 2: Reuse Shared Read/Guard Helpers

**Files:**
- Modify: `functions/services/order-procurement-shared.js`
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`
- Modify: `functions/services/PurchaseOrderShortageClosureService.js`

- [ ] **Step 1: Implement minimal shared helpers**

Add helper exports for:
- purchase-order lookup with configurable allowed statuses
- purchase-order-item lookup with purchase-order ownership enforcement
- inventory balance lookup
- purchase-order-item update and revert statement builders

- [ ] **Step 2: Rewire the three services**

Replace duplicated local helper methods with shared helper usage while preserving:
- existing error messages
- existing optimistic concurrency guards
- existing SQL statement order

- [ ] **Step 3: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js
```

Expected: PASS

- [ ] **Step 4: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/services/order-procurement-shared.js functions/services/OrderProcurementDomainService.js functions/services/OrderProcurementReceiptReversalService.js functions/services/PurchaseOrderShortageClosureService.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/repositories/__tests__/PurchaseReceiptRepository.reversal.test.js functions/repositories/__tests__/PurchaseReceiptRepository.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-purchase-order-command-guard-dedup-design.md docs/superpowers/plans/2026-04-02-purchase-order-command-guard-dedup-plan.md functions/services/order-procurement-shared.js functions/services/OrderProcurementDomainService.js functions/services/OrderProcurementReceiptReversalService.js functions/services/PurchaseOrderShortageClosureService.js functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js
git commit -m "refactor: dedupe purchase order command guards"
```

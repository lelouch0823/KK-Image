# Thin Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove redundant thin wrapper methods from procurement and fulfillment services so shared helpers are called directly without changing service behavior.

**Architecture:** Add an audit test that lists the wrapper methods that should no longer exist on service prototypes. Then inline shared helper calls inside the affected services and delete those wrappers, relying on existing service tests to prove SQL and behavior remain unchanged.

**Tech Stack:** Vitest, ESLint, Cloudflare D1 service modules

---

### Task 1: Lock the Cleanup Contract

**Files:**
- Create: `functions/services/__tests__/service-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a test that asserts the affected service prototypes no longer define the selected thin wrapper methods.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/service-thin-wrappers.audit.test.js
```

Expected: FAIL because those wrapper methods still exist.

### Task 2: Inline Shared Helper Usage

**Files:**
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`
- Modify: `functions/services/PurchaseOrderShortageClosureService.js`
- Modify: `functions/services/OrderLineFulfillmentService.js`

- [ ] **Step 1: Remove the selected thin wrappers**

Inline direct calls to shared helpers and delete the redundant wrapper methods.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/service-thin-wrappers.audit.test.js functions/services/__tests__/OrderLineFulfillmentService.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/services/OrderProcurementDomainService.js functions/services/OrderProcurementReceiptReversalService.js functions/services/PurchaseOrderShortageClosureService.js functions/services/OrderLineFulfillmentService.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/service-thin-wrappers.audit.test.js functions/services/__tests__/OrderLineFulfillmentService.test.js functions/services/__tests__/order-line-shared.test.js functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/repositories/__tests__/PurchaseReceiptRepository.reversal.test.js functions/repositories/__tests__/PurchaseReceiptRepository.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-thin-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-thin-wrapper-cleanup-plan.md functions/services/OrderProcurementDomainService.js functions/services/OrderProcurementReceiptReversalService.js functions/services/PurchaseOrderShortageClosureService.js functions/services/OrderLineFulfillmentService.js functions/services/__tests__/service-thin-wrappers.audit.test.js
git commit -m "refactor: remove thin service wrappers"
```

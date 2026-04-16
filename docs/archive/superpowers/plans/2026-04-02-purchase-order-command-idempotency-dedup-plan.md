# Purchase Order Command Idempotency Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate duplicated purchase-order command idempotency shell logic into narrow shared helpers without changing each command's business flow.

**Architecture:** Extend the shared order-procurement helper module with reservation replay, ownership resolution, cleanup, and finalize statement builders. Then rewire the receipt, reversal, and shortage services to consume those helpers while preserving their existing preflight, rollback, and outbox behavior.

**Tech Stack:** Vitest, ESLint, Cloudflare D1 service modules

---

### Task 1: Lock Shared Command-Shell Semantics

**Files:**
- Modify: `functions/services/__tests__/order-procurement-shared.test.js`
- Modify: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Modify: `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
- Modify: `functions/services/__tests__/PurchaseOrderShortageClosureService.test.js`

- [ ] **Step 1: Write the failing tests**

Add tests that assert:
- shared helper replays committed command responses
- shared helper rejects mismatched fingerprints and in-flight reservations
- shared helper only deletes command rows when the service owns the reservation
- existing service tests still expect the same replay and cleanup semantics

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js
```

Expected: failures because the new shared command-shell helpers do not exist yet.

### Task 2: Reuse Shared Command-Shell Helpers

**Files:**
- Modify: `functions/services/order-procurement-shared.js`
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`
- Modify: `functions/services/PurchaseOrderShortageClosureService.js`

- [ ] **Step 1: Implement shared reservation and finalize helpers**

Add narrow helper exports for:
- reservation ownership
- replay/in-flight handling
- cleanup delete execution
- finalize statement assembly

- [ ] **Step 2: Rewire receipt, reversal, and shortage services**

Replace duplicated outer-shell logic while preserving existing business branches and SQL order.

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
git add docs/superpowers/specs/2026-04-02-purchase-order-command-idempotency-dedup-design.md docs/superpowers/plans/2026-04-02-purchase-order-command-idempotency-dedup-plan.md functions/services/order-procurement-shared.js functions/services/OrderProcurementDomainService.js functions/services/OrderProcurementReceiptReversalService.js functions/services/PurchaseOrderShortageClosureService.js functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js
git commit -m "refactor: dedupe purchase order command idempotency shell"
```

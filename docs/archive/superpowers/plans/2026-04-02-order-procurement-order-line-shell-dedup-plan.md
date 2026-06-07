# Order Procurement Order-Line Shell Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate duplicated order-line update/revert SQL shells and compatibility-order procurement-status write shells across procurement receipt and reversal services without changing command behavior.

**Architecture:** Extend `order-procurement-shared.js` with narrow builders for `order_lines` projection writes and compatibility-order `procurement_status` writes. Rewire the receipt and reversal services, and keep any service-specific semantics expressed through explicit helper options rather than broader abstractions.

**Tech Stack:** Vitest, ESLint, Cloudflare D1 service modules

---

### Task 1: Lock Shared Statement Semantics

**Files:**

- Modify: `functions/services/__tests__/order-procurement-shared.test.js`
- Modify: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Modify: `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`

- [ ] **Step 1: Write the failing tests**

Add tests that assert:

- shared helper preserves the current `order_lines` bind parameter order
- shared helper optionally adds a `display_status` guard for revert paths
- shared helper can build compatibility-order `procurement_status` writes both with and without the active-order/distinct-status guards
- existing service SQL expectations remain unchanged

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js
```

Expected: FAIL because the new shared `order_lines` and `procurement_status` builders do not exist yet.

### Task 2: Reuse Shared Builders

**Files:**

- Modify: `functions/services/order-procurement-shared.js`
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`

- [ ] **Step 1: Implement minimal shared builders**

Add helper exports for:

- `order_lines` projection write statements
- compatibility-order `procurement_status` update statements

- [ ] **Step 2: Rewire the services**

Replace duplicated local statement builders while preserving:

- existing SQL guard semantics
- existing bind parameter order
- existing statement sequencing

- [ ] **Step 3: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js
```

Expected: PASS

- [ ] **Step 4: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/services/order-procurement-shared.js functions/services/OrderProcurementDomainService.js functions/services/OrderProcurementReceiptReversalService.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/repositories/__tests__/PurchaseReceiptRepository.reversal.test.js functions/repositories/__tests__/PurchaseReceiptRepository.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-order-procurement-order-line-shell-dedup-design.md docs/superpowers/plans/2026-04-02-order-procurement-order-line-shell-dedup-plan.md functions/services/order-procurement-shared.js functions/services/OrderProcurementDomainService.js functions/services/OrderProcurementReceiptReversalService.js functions/services/__tests__/order-procurement-shared.test.js
git commit -m "refactor: dedupe order procurement order line shells"
```

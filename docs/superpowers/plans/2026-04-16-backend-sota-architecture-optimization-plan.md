# Backend SOTA Architecture Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align procurement, fulfillment, inventory, and replenishment flows with a more robust SOTA backend design: source facts decide command success, resource-level concurrency is explicit, projections refresh through a unified path, and purchase-order status semantics are quantity-driven and documented.

**Architecture:** Keep the current D1 + service-layer architecture, but tighten domain boundaries instead of rewriting to event sourcing. Introduce one narrow concurrency abstraction for resource locks, one narrow projection refresh abstraction for variant demand, and move command-success decisions onto source-fact writes only. Preserve current tables and route surfaces where possible to keep migration risk low.

**Tech Stack:** Cloudflare Workers, D1, Vitest, existing domain outbox + command idempotency tables, existing real API suites.

---

### Task 1: Freeze the Design Boundary Between Source Facts and Derived Projections

**Files:**
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`
- Modify: `functions/services/order-procurement-shared.js`
- Test: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Test: `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
- Test: `test/purchase-receipts-real-api.test.js`
- Test: `test/notifications-real-api.test.js`

- [ ] **Step 1: Write failing service tests that encode the target boundary**

Add/adjust tests so they assert:
- receipt success is decided by purchase-order item source-fact writes, not later order-line/procurement projection writes
- reversal success is decided by reversal fact + source quantity rollback, not later projection writes
- derived projection mismatches do not force a false `400` after source facts have already committed

- [ ] **Step 2: Run the narrow service tests to verify current failures**

Run:
```bash
pnpm vitest run functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js
```
Expected:
- targeted tests fail on false-guard behavior or mixed success criteria

- [ ] **Step 3: Refactor the command-success checks in procurement receipt/reversal flows**

Implementation target:
- keep source-fact guarded writes as hard success criteria
- treat order-line status, procurement status, notification fan-out, and cache invalidation as derived work
- keep idempotency cleanup only for true command failure

- [ ] **Step 4: Re-run service tests until green**

Run:
```bash
pnpm vitest run functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js
```
Expected:
- PASS

- [ ] **Step 5: Re-run real API regression suites for receipt/reversal**

Run:
```bash
RUN_REAL_API_TESTS=1 pnpm vitest run test/purchase-receipts-real-api.test.js test/notifications-real-api.test.js
```
Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add functions/services/OrderProcurementDomainService.js functions/services/OrderProcurementReceiptReversalService.js functions/services/order-procurement-shared.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js test/purchase-receipts-real-api.test.js test/notifications-real-api.test.js
git commit -m "refactor: decouple procurement command success from derived projections"
```

### Task 2: Introduce Resource-Level Concurrency Control for Procurement Commands

**Files:**
- Create: `functions/services/order-procurement-resource-locks.js`
- Test: `functions/services/__tests__/order-procurement-resource-locks.test.js`
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`
- Modify: `functions/repositories/CommandIdempotencyRepository.js`
- Test: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Test: `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
- Test: `test/purchase-receipts-real-api.test.js`

- [ ] **Step 1: Write failing lock abstraction tests**

Add tests for a helper that:
- acquires resource locks for `purchase_order_item`
- acquires resource locks for `receipt`
- releases locks on both success and failure
- rejects a second concurrent writer before downstream side effects run

- [ ] **Step 2: Run the new lock tests and current domain concurrency tests**

Run:
```bash
pnpm vitest run functions/services/__tests__/order-procurement-resource-locks.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js
```
Expected:
- FAIL in new resource-lock cases

- [ ] **Step 3: Implement a reusable resource-lock helper on top of `command_idempotency`**

Implementation target:
- avoid a new table unless existing `command_idempotency` proves insufficient
- support per-resource lock acquisition with explicit lock type + scope
- keep helper small and procurement-specific

- [ ] **Step 4: Replace ad-hoc receipt/reversal locking logic with the shared helper**

Implementation target:
- receipts lock by `purchase_order_item_id`
- reversals lock by `original_receipt_id`
- lock release happens on both finalize and error cleanup

- [ ] **Step 5: Re-run service tests**

Run:
```bash
pnpm vitest run functions/services/__tests__/order-procurement-resource-locks.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js
```
Expected:
- PASS

- [ ] **Step 6: Re-run real API receipt concurrency suite**

Run:
```bash
RUN_REAL_API_TESTS=1 pnpm vitest run test/purchase-receipts-real-api.test.js
```
Expected:
- PASS, including concurrent different-idempotency receipt/reversal cases

- [ ] **Step 7: Commit**

```bash
git add functions/services/order-procurement-resource-locks.js functions/services/__tests__/order-procurement-resource-locks.test.js functions/services/OrderProcurementDomainService.js functions/services/OrderProcurementReceiptReversalService.js functions/repositories/CommandIdempotencyRepository.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js test/purchase-receipts-real-api.test.js
git commit -m "refactor: add resource-level concurrency guards for procurement commands"
```

### Task 3: Centralize Variant Demand Projection Refresh for Inventory-Affecting Commands

**Files:**
- Create: `functions/services/VariantDemandProjectionRefreshService.js`
- Test: `functions/services/__tests__/VariantDemandProjectionRefreshService.test.js`
- Modify: `functions/services/OrderLineFulfillmentService.js`
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`
- Modify: `functions/services/PurchaseOrderShortageClosureService.js`
- Test: `functions/services/__tests__/OrderLineFulfillmentService.test.js`
- Test: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Test: `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
- Test: `functions/services/__tests__/PurchaseOrderShortageClosureService.test.js`
- Test: `test/order-line-fulfillment-real-api.test.js`
- Test: `test/manage-inventory-linkage-workflow.test.js`

- [ ] **Step 1: Write failing tests for a shared projection refresh service**

Cover:
- ship/unship refreshes variant demand projection
- receipt/reversal refreshes variant demand projection
- shortage closure refreshes variant demand projection
- reserve/release do not over-refresh if no demand semantics change

- [ ] **Step 2: Run the focused projection tests**

Run:
```bash
pnpm vitest run functions/services/__tests__/VariantDemandProjectionRefreshService.test.js functions/services/__tests__/OrderLineFulfillmentService.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js
```
Expected:
- FAIL where refresh behavior is missing or duplicated

- [ ] **Step 3: Implement `VariantDemandProjectionRefreshService`**

Implementation target:
- one entry point to refresh by affected variant ids
- deduplicate repeated refreshes in one command
- keep service synchronous for now; do not invent a new async projection worker in this batch

- [ ] **Step 4: Wire all inventory-affecting domain commands through the shared refresh service**

Implementation target:
- remove ad-hoc refresh scattering from individual commands where possible
- keep route handlers thin

- [ ] **Step 5: Re-run service tests**

Run:
```bash
pnpm vitest run functions/services/__tests__/VariantDemandProjectionRefreshService.test.js functions/services/__tests__/OrderLineFulfillmentService.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js
```
Expected:
- PASS

- [ ] **Step 6: Re-run real API demand/projection suites**

Run:
```bash
RUN_REAL_API_TESTS=1 pnpm vitest run test/order-line-fulfillment-real-api.test.js test/manage-inventory-linkage-workflow.test.js
```
Expected:
- PASS, especially direct-ship demand convergence

- [ ] **Step 7: Commit**

```bash
git add functions/services/VariantDemandProjectionRefreshService.js functions/services/__tests__/VariantDemandProjectionRefreshService.test.js functions/services/OrderLineFulfillmentService.js functions/services/OrderProcurementDomainService.js functions/services/OrderProcurementReceiptReversalService.js functions/services/PurchaseOrderShortageClosureService.js functions/services/__tests__/OrderLineFulfillmentService.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js test/order-line-fulfillment-real-api.test.js test/manage-inventory-linkage-workflow.test.js
git commit -m "refactor: centralize variant demand projection refresh"
```

### Task 4: Normalize Purchase-Order Status Semantics Around Quantity Closure

**Files:**
- Modify: `functions/services/PurchaseOrderService.js`
- Modify: `functions/services/purchase-order-projection.js`
- Modify: `functions/lib/hono/routes/_shared/variant-replenishment.js`
- Test: `functions/services/__tests__/PurchaseOrderService.procurement-status.test.js`
- Test: `functions/lib/hono/routes/_shared/__tests__/variant-replenishment.test.js`
- Test: `test/manage-products-replenishment.test.js`
- Test: `test/purchase-receipts-real-api.test.js`

- [ ] **Step 1: Write failing tests that pin the desired semantics**

Cover:
- `shipping -> arrived` requires quantity closure by receipts/cancellations
- replenishment signal counts only still-open procurement quantity
- replenishment drops to zero only after outstanding quantity closes

- [ ] **Step 2: Run the status/replenishment tests**

Run:
```bash
pnpm vitest run functions/services/__tests__/PurchaseOrderService.procurement-status.test.js functions/lib/hono/routes/_shared/__tests__/variant-replenishment.test.js test/manage-products-replenishment.test.js
```
Expected:
- FAIL where status assumptions and replenishment semantics are inconsistent

- [ ] **Step 3: Refactor status and replenishment helpers so they share one quantity-closure model**

Implementation target:
- do not let raw PO status alone drive replenishment exposure
- derive openness from outstanding quantity
- keep `arrived` semantics consistent across service and API tests

- [ ] **Step 4: Re-run focused tests**

Run:
```bash
pnpm vitest run functions/services/__tests__/PurchaseOrderService.procurement-status.test.js functions/lib/hono/routes/_shared/__tests__/variant-replenishment.test.js test/manage-products-replenishment.test.js
```
Expected:
- PASS

- [ ] **Step 5: Re-run real API suites that observe replenishment and PO lifecycle**

Run:
```bash
RUN_REAL_API_TESTS=1 pnpm vitest run test/manage-products-replenishment.test.js test/purchase-receipts-real-api.test.js
```
Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add functions/services/PurchaseOrderService.js functions/services/purchase-order-projection.js functions/lib/hono/routes/_shared/variant-replenishment.js functions/services/__tests__/PurchaseOrderService.procurement-status.test.js functions/lib/hono/routes/_shared/__tests__/variant-replenishment.test.js test/manage-products-replenishment.test.js test/purchase-receipts-real-api.test.js
git commit -m "refactor: align purchase order status and replenishment semantics"
```

### Task 5: Add Architectural Guardrails So the Design Does Not Regress

**Files:**
- Create: `functions/services/__tests__/procurement-architecture-guards.audit.test.js`
- Modify: `functions/services/__tests__/service-thin-wrappers.audit.test.js`
- Modify: `test/full-business-regression-real-api.test.js`
- Modify: `test/notifications-real-api.test.js`
- Modify: `test/order-line-fulfillment-real-api.test.js`
- Modify: `test/purchase-receipts-real-api.test.js`

- [ ] **Step 1: Write failing guardrail tests**

Add architecture audits that assert:
- procurement command services do not decide success from downstream notification/cache work
- resource-level lock helper is used by receipt/reversal commands
- demand projection refresh is invoked through the shared service, not duplicated manually

- [ ] **Step 2: Run the guardrail tests and broad business regression**

Run:
```bash
pnpm vitest run functions/services/__tests__/procurement-architecture-guards.audit.test.js functions/services/__tests__/service-thin-wrappers.audit.test.js test/full-business-regression-real-api.test.js
```
Expected:
- FAIL until guardrails match the new design

- [ ] **Step 3: Implement minimal audit coverage**

Implementation target:
- keep audits static and cheap
- avoid brittle string matches unless no cleaner boundary exists

- [ ] **Step 4: Re-run the guardrail tests**

Run:
```bash
pnpm vitest run functions/services/__tests__/procurement-architecture-guards.audit.test.js functions/services/__tests__/service-thin-wrappers.audit.test.js test/full-business-regression-real-api.test.js
```
Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add functions/services/__tests__/procurement-architecture-guards.audit.test.js functions/services/__tests__/service-thin-wrappers.audit.test.js test/full-business-regression-real-api.test.js test/notifications-real-api.test.js test/order-line-fulfillment-real-api.test.js test/purchase-receipts-real-api.test.js
git commit -m "test: add architectural guardrails for procurement and fulfillment flows"
```

### Task 6: Final Verification and Documentation

**Files:**
- Modify: `docs/issue-reports/backend-architecture-issues.md`
- Create: `docs/architecture/procurement-command-boundaries.md`
- Create: `docs/architecture/projection-refresh-model.md`

- [ ] **Step 1: Update issue and architecture docs**

Document:
- source fact vs derived projection boundary
- resource-level concurrency model
- unified demand projection refresh path
- purchase-order lifecycle semantics

- [ ] **Step 2: Run full local verification**

Run:
```bash
pnpm vitest run functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/OrderLineFulfillmentService.test.js functions/services/__tests__/PurchaseOrderService.procurement-status.test.js functions/services/__tests__/procurement-architecture-guards.audit.test.js
pnpm test:real-api:full-chain
pnpm test:real-api
```
Expected:
- all targeted unit tests PASS
- `pnpm test:real-api:full-chain` PASS
- `pnpm test:real-api` PASS

- [ ] **Step 3: Review git diff for boundary drift**

Run:
```bash
git diff --stat
git diff -- functions/services functions/lib/hono/routes/_shared test docs
```
Expected:
- only planned files changed
- no unrelated UI/frontend files touched

- [ ] **Step 4: Final commit**

```bash
git add docs/issue-reports/backend-architecture-issues.md docs/architecture/procurement-command-boundaries.md docs/architecture/projection-refresh-model.md
git commit -m "docs: record backend architecture optimization model"
```

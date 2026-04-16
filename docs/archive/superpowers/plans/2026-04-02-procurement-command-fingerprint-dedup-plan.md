# Procurement Command Fingerprint Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse shared procurement request fingerprint builders so receipt, reversal, and shortage-closure services stop carrying duplicate local idempotency helpers.

**Architecture:** Extend `functions/services/order-procurement-shared.js` with the three fingerprint builders already implied by the current services. Keep fingerprint payload shape and sorting stable, then update the three services to import those helpers directly. Add an audit test so local fingerprint helpers do not reappear.

**Tech Stack:** Vitest, service-layer shared helpers, command idempotency flow

---

### Task 1: Lock Shared Fingerprint Contracts

**Files:**
- Modify: `functions/services/__tests__/order-procurement-shared.test.js`
- Create: `functions/services/__tests__/procurement-command-fingerprints.audit.test.js`

- [ ] **Step 1: Write the failing tests**

Add tests that assert:
- shared module exports stable receipt fingerprint normalization
- shared module exports stable reversal fingerprint normalization
- shared module exports stable shortage-closure fingerprint normalization
- receipt / reversal / shortage services no longer define local fingerprint helpers

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/procurement-command-fingerprints.audit.test.js
```

Expected: FAIL because the shared builders and audit constraints do not exist yet.

### Task 2: Reuse Shared Procurement Fingerprint Builders

**Files:**
- Modify: `functions/services/order-procurement-shared.js`
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`
- Modify: `functions/services/PurchaseOrderShortageClosureService.js`

- [ ] **Step 1: Implement the shared fingerprint helpers and remove local copies**

Move the three fingerprint builders into `order-procurement-shared.js`, keeping current sorting and normalization semantics unchanged.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/procurement-command-fingerprints.audit.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/services/order-procurement-shared.js functions/services/OrderProcurementDomainService.js functions/services/OrderProcurementReceiptReversalService.js functions/services/PurchaseOrderShortageClosureService.js functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/procurement-command-fingerprints.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/procurement-command-fingerprints.audit.test.js functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js functions/services/__tests__/service-thin-wrappers.audit.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-procurement-command-fingerprint-dedup-design.md docs/superpowers/plans/2026-04-02-procurement-command-fingerprint-dedup-plan.md functions/services/order-procurement-shared.js functions/services/OrderProcurementDomainService.js functions/services/OrderProcurementReceiptReversalService.js functions/services/PurchaseOrderShortageClosureService.js functions/services/__tests__/order-procurement-shared.test.js functions/services/__tests__/procurement-command-fingerprints.audit.test.js
git commit -m "refactor: dedupe procurement command fingerprints"
```

# DemandService Thin Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the unused thin `DemandService.projectOrderLineStatus` instance wrapper so demand logic relies on the shared projection function directly instead of carrying a pass-through method.

**Architecture:** Extend the existing service thin-wrapper audit to cover `DemandService`, then delete the wrapper method and the now-unused import from `DemandService.js`.

**Tech Stack:** Vitest, service-layer audits, demand service

---

### Task 1: Lock the Thin-Wrapper Constraint

**Files:**

- Modify: `functions/services/__tests__/service-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing test**

Add an assertion that `DemandService.prototype` does not expose `projectOrderLineStatus`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/service-thin-wrappers.audit.test.js
```

Expected: FAIL because `DemandService.prototype.projectOrderLineStatus` still exists.

### Task 2: Remove the Thin Wrapper

**Files:**

- Modify: `functions/services/DemandService.js`

- [ ] **Step 1: Remove the instance wrapper and unused import**

Delete `projectOrderLineStatus(payload)` from `DemandService` and clean the unused import from `OrderStatusProjectionService`.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/service-thin-wrappers.audit.test.js functions/services/__tests__/DemandService.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/services/DemandService.js functions/services/__tests__/service-thin-wrappers.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/services/__tests__/service-thin-wrappers.audit.test.js functions/services/__tests__/DemandService.test.js functions/services/__tests__/OrderStatusProjectionService.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-demand-service-thin-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-demand-service-thin-wrapper-cleanup-plan.md functions/services/DemandService.js functions/services/__tests__/service-thin-wrappers.audit.test.js
git commit -m "refactor: remove demand service thin wrapper"
```

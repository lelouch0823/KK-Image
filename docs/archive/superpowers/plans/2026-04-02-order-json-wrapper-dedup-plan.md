# Order JSON Wrapper Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the thin order JSON wrapper so order helper mappers and order stats repository reuse `parseJsonObject` directly.

**Architecture:** Keep `parseJsonObject` as the single JSON-object parsing utility. Delete the thin `parseJson` wrapper from `functions/repositories/order/helpers.js`, update the order helper mappers and `OrderStatsRepository`, and add an audit test to keep the wrapper from reappearing.

**Tech Stack:** Vitest, repository helpers, shared JSON utils

---

### Task 1: Lock Thin-Wrapper Removal Contract

**Files:**

- Modify: `functions/repositories/__tests__/order-helpers.procurement-status.test.js`
- Create: `functions/repositories/__tests__/OrderStatsRepository.test.js`
- Create: `functions/repositories/__tests__/order-json-wrapper.audit.test.js`

- [ ] **Step 1: Write the failing tests**

Add tests that assert:

- order helper mappers still fall back to empty object fields when JSON is invalid
- order stats recent pending mapping still falls back to empty name on invalid JSON
- `order/helpers.js` no longer defines `parseJson`
- `OrderStatsRepository.js` no longer imports `parseJson` from order helpers

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/repositories/__tests__/order-helpers.procurement-status.test.js functions/repositories/__tests__/OrderStatsRepository.test.js functions/repositories/__tests__/order-json-wrapper.audit.test.js
```

Expected: FAIL because the audit constraint is not satisfied yet.

### Task 2: Reuse parseJsonObject Directly

**Files:**

- Modify: `functions/repositories/order/helpers.js`
- Modify: `functions/repositories/OrderStatsRepository.js`

- [ ] **Step 1: Remove the thin wrapper and update call sites**

Delete `parseJson` and switch all order helper / order stats call sites to direct `parseJsonObject(..., {})` usage.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/repositories/__tests__/order-helpers.procurement-status.test.js functions/repositories/__tests__/OrderStatsRepository.test.js functions/repositories/__tests__/order-json-wrapper.audit.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/repositories/order/helpers.js functions/repositories/OrderStatsRepository.js functions/repositories/__tests__/order-helpers.procurement-status.test.js functions/repositories/__tests__/OrderStatsRepository.test.js functions/repositories/__tests__/order-json-wrapper.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/repositories/__tests__/order-helpers.procurement-status.test.js functions/repositories/__tests__/OrderStatsRepository.test.js functions/repositories/__tests__/order-json-wrapper.audit.test.js functions/repositories/__tests__/repository-update-helpers.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-order-json-wrapper-dedup-design.md docs/superpowers/plans/2026-04-02-order-json-wrapper-dedup-plan.md functions/repositories/order/helpers.js functions/repositories/OrderStatsRepository.js functions/repositories/__tests__/order-helpers.procurement-status.test.js functions/repositories/__tests__/OrderStatsRepository.test.js functions/repositories/__tests__/order-json-wrapper.audit.test.js
git commit -m "refactor: remove thin order json wrapper"
```

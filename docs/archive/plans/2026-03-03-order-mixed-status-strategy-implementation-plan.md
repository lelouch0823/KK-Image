# Order Mixed Status Strategy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce state-machine-first order transitions with controlled admin force override while preserving hard stock invariants.

**Architecture:** Add shared status-transition utilities, enforce at repository mutation layer for all status-write paths, and expose force override via route/UI contracts with permission and reason gates.

**Tech Stack:** Hono routes, D1 repository mutations, Vue3 composables/components, Vitest.

---

### Task 1: Backend State Machine Utility

**Files:**

- Create: `functions/api/utils/order-state-machine.js`
- Test: `functions/api/utils/__tests__/order-state-machine.test.js`

### Task 2: Repository Transition Enforcement

**Files:**

- Modify: `functions/repositories/order/mutations.js`
- Modify: `functions/repositories/OrderRepository.js`
- Modify: `functions/api/utils/order-utils.js`
- Test: `functions/repositories/__tests__/order-inventory-flow.test.js`

### Task 3: Admin Routes Force Override Contract

**Files:**

- Modify: `functions/lib/hono/routes/manage/orders/detail.js`
- Modify: `functions/lib/hono/routes/manage/orders/create.js`
- Test: `functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js`
- Test: `functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js`

### Task 4: Frontend Transition UX + Payload

**Files:**

- Create: `src/utils/order-state-machine.js`
- Modify: `src/components/OrderStatusChanger.vue`
- Modify: `src/composables/useOrders.js`
- Modify: `src/components/OrderManager.vue`
- Modify: `src/components/order/OrderFormFields.vue`
- Modify: `src/locales/zh-CN/order.js`
- Modify: `src/locales/en/order.js`
- Test: `src/composables/__tests__/useOrders.change-status.test.js`

### Task 5: End-to-End Verification

Run:

```bash
npx vitest run functions/api/utils/__tests__/order-state-machine.test.js functions/repositories/__tests__/order-inventory-flow.test.js functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js src/composables/__tests__/useOrders.change-status.test.js src/composables/__tests__/useOrders.update-order.test.js
```

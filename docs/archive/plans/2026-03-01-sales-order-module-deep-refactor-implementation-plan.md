# Sales Order Module Deep Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 全量替换销售端订单模块为统一状态架构，补齐错误边界与移动端 SOTA UX，同时保持业务连续可回滚。

**Architecture:** 采用“API 层 + 状态机层 + 视图层”三层拆分，先在功能开关下并行旧新实现，再逐步切换默认路径。所有高风险点通过契约测试先锁定，再做增量替换，最后移除旧逻辑。

**Tech Stack:** Vue 3 + Composition API + Vue Router + Vitest + Vue Test Utils + Hono + D1

---

## Scope

- Frontend（销售端）:
  - `src/views/Sales.vue`
  - `src/views/sales/SalesListView.vue`
  - `src/views/sales/SalesFormView.vue`
  - `src/views/sales/SalesDetailView.vue`
  - `src/components/order/*`（销售端使用子集）
  - `src/composables/useOrders.js`
- Backend（销售端接口）:
  - `functions/lib/hono/routes/sales/*.js`
- Docs:
  - `docs/user-manual/*`
  - `docs/architecture/modules/*`

## Non-Goals (YAGNI)

- 不重写管理端订单模块
- 不引入新状态管理库（如 Pinia）本轮只用 composable
- 不改动采购模块业务规则

## Rollout Strategy

1. 新实现先挂在 feature flag 下（默认旧实现）
2. 测试环境开启新实现，回归通过后线上灰度
3. 线上观察无异常后切默认
4. 再删除旧路径（最终全量替换）

---

### Task 1: Baseline Contract Tests（锁旧行为）

**Files:**

- Create: `src/views/sales/__tests__/sales-module-contract.test.js`
- Create: `src/components/order/__tests__/sales-order-flow-contract.test.js`
- Modify: `vitest.config.js`

**Step 1: Write the failing test**

```js
it('sales create flow keeps payload compatibility', async () => {
  // 断言提交 payload 在绑定/未绑定下的结构
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/views/sales/__tests__/sales-module-contract.test.js`
Expected: FAIL with missing test scaffolding or assertion mismatch

**Step 3: Write minimal implementation**

- 补测试 mock 和现有行为快照断言（不改生产逻辑）

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/views/sales/__tests__/sales-module-contract.test.js src/components/order/__tests__/sales-order-flow-contract.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/views/sales/__tests__/sales-module-contract.test.js src/components/order/__tests__/sales-order-flow-contract.test.js vitest.config.js
git commit -m "test: add sales order module baseline contract tests"
```

---

### Task 2: Introduce Feature Flag for Safe Replacement

**Files:**

- Create: `src/config/feature-flags.js`
- Modify: `src/views/Sales.vue`
- Modify: `src/views/sales/SalesListView.vue`
- Modify: `src/views/sales/SalesFormView.vue`
- Modify: `src/views/sales/SalesDetailView.vue`

**Step 1: Write the failing test**

```js
it('uses legacy path when SALES_ORDER_V2 flag is off', () => {});
it('uses refactor path when SALES_ORDER_V2 flag is on', () => {});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/views/sales/__tests__/sales-module-contract.test.js`
Expected: FAIL on missing feature flag behavior

**Step 3: Write minimal implementation**

- 增加 `SALES_ORDER_V2` flag
- 视图层按 flag 切换旧/新实现入口

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/views/sales/__tests__/sales-module-contract.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/config/feature-flags.js src/views/Sales.vue src/views/sales/SalesListView.vue src/views/sales/SalesFormView.vue src/views/sales/SalesDetailView.vue
git commit -m "feat: add feature flag for sales order module replacement"
```

---

### Task 3: Build Unified Sales API Layer

**Files:**

- Create: `src/composables/sales/useSalesOrderApi.js`
- Modify: `src/composables/useOrders.js`
- Modify: `src/utils/constants.js`
- Test: `src/composables/__tests__/useSalesOrderApi.test.js`

**Step 1: Write the failing test**

```js
it('normalizes success and error payload shape for sales order APIs', async () => {});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/composables/__tests__/useSalesOrderApi.test.js`
Expected: FAIL with missing composable

**Step 3: Write minimal implementation**

- 提供统一 `request()` 返回 `{ ok, data, error, status }`
- 封装 orders/list/detail/create/comment/stats/products

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/composables/__tests__/useSalesOrderApi.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/composables/sales/useSalesOrderApi.js src/composables/useOrders.js src/utils/constants.js src/composables/__tests__/useSalesOrderApi.test.js
git commit -m "refactor: introduce unified sales order API layer"
```

---

### Task 4: Build Sales State Machine Composable

**Files:**

- Create: `src/composables/sales/useSalesOrderStateMachine.js`
- Test: `src/composables/__tests__/useSalesOrderStateMachine.test.js`
- Modify: `src/views/Sales.vue`

**Step 1: Write the failing test**

```js
it('transitions idle -> loading -> ready', () => {});
it('transitions loading -> error and supports retry', () => {});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/composables/__tests__/useSalesOrderStateMachine.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

- 明确状态：`idle/loading/ready/empty/error/recovering`
- 统一 action：`loadOrders/createOrder/loadDetail/comment/retry`

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/composables/__tests__/useSalesOrderStateMachine.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/composables/sales/useSalesOrderStateMachine.js src/composables/__tests__/useSalesOrderStateMachine.test.js src/views/Sales.vue
git commit -m "refactor: add sales order state machine"
```

---

### Task 5: Add Runtime Error Boundary + Recovery UI

**Files:**

- Create: `src/components/common/AppErrorBoundary.vue`
- Create: `src/components/common/AsyncStatePanel.vue`
- Modify: `src/views/Sales.vue`
- Test: `src/components/common/__tests__/AppErrorBoundary.test.js`

**Step 1: Write the failing test**

```js
it('renders fallback when child throws and allows recover', async () => {});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/components/common/__tests__/AppErrorBoundary.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

- `onErrorCaptured` 捕获子树错误
- 提供 fallback（重试/返回列表）
- `AsyncStatePanel` 统一 loading/empty/error/retry 模版

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/components/common/__tests__/AppErrorBoundary.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/common/AppErrorBoundary.vue src/components/common/AsyncStatePanel.vue src/views/Sales.vue src/components/common/__tests__/AppErrorBoundary.test.js
git commit -m "feat: add runtime error boundary and async state panel"
```

---

### Task 6: Refactor List Experience for Mobile Reliability

**Files:**

- Modify: `src/views/sales/SalesListView.vue`
- Modify: `src/components/order/OrderList.vue`
- Test: `src/components/order/__tests__/OrderList.mobile-state.test.js`

**Step 1: Write the failing test**

```js
it('shows retry CTA on list load error', async () => {});
it('shows empty guidance instead of blank state', async () => {});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/components/order/__tests__/OrderList.mobile-state.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

- 用 `AsyncStatePanel` 替换散落状态 UI
- 保留下拉刷新 + 无限滚动，但统一失败恢复按钮
- 修复搜索态与分页态切换抖动

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/components/order/__tests__/OrderList.mobile-state.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/views/sales/SalesListView.vue src/components/order/OrderList.vue src/components/order/__tests__/OrderList.mobile-state.test.js
git commit -m "refactor: unify mobile list loading empty error states"
```

---

### Task 7: Refactor Create Flow with Strong Error Boundaries

**Files:**

- Modify: `src/views/sales/SalesFormView.vue`
- Modify: `src/components/order/ProductBindingSection.vue`
- Modify: `src/components/order/SalesProductSelect.vue`
- Modify: `src/components/order/OrderForm.vue`
- Modify: `src/composables/useSalesProducts.js`
- Test: `src/views/sales/__tests__/SalesFormView.resilience.test.js`

**Step 1: Write the failing test**

```js
it('shows inline product-fetch error with retry action', async () => {});
it('prevents silent submit failure and keeps form state', async () => {});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/views/sales/__tests__/SalesFormView.resilience.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

- 商品拉取失败展示 inline error + retry
- 变体不可选时展示明确提示（非静默）
- 提交失败不清表单且提供恢复动作

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/views/sales/__tests__/SalesFormView.resilience.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/views/sales/SalesFormView.vue src/components/order/ProductBindingSection.vue src/components/order/SalesProductSelect.vue src/components/order/OrderForm.vue src/composables/useSalesProducts.js src/views/sales/__tests__/SalesFormView.resilience.test.js
git commit -m "refactor: harden sales create flow with inline recovery states"
```

---

### Task 8: Refactor Detail Flow + Mark-Read Recovery

**Files:**

- Modify: `src/views/sales/SalesDetailView.vue`
- Modify: `src/components/order/OrderDetail.vue`
- Modify: `src/components/order/OrderCommentInput.vue`
- Test: `src/components/order/__tests__/OrderDetail.recovery.test.js`

**Step 1: Write the failing test**

```js
it('shows recoverable warning when markAsRead fails', async () => {});
it('comment submit failure preserves input and exposes retry', async () => {});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/components/order/__tests__/OrderDetail.recovery.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

- `markAsRead` 改成可重试提示，不仅 console
- 评论发送失败保留文本 + 重试按钮
- 详情页拉取失败统一错误态

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/components/order/__tests__/OrderDetail.recovery.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/views/sales/SalesDetailView.vue src/components/order/OrderDetail.vue src/components/order/OrderCommentInput.vue src/components/order/__tests__/OrderDetail.recovery.test.js
git commit -m "refactor: improve sales detail resilience and retry UX"
```

---

### Task 9: Refactor Stats & Notification States

**Files:**

- Modify: `src/components/order/SalesStats.vue`
- Modify: `src/components/order/SalesNotificationList.vue`
- Test: `src/components/order/__tests__/SalesStats.error-state.test.js`
- Test: `src/components/order/__tests__/SalesNotificationList.error-state.test.js`

**Step 1: Write the failing test**

```js
it('stats panel displays retry UI on request error', async () => {});
it('notification list handles fetch failures with guidance', async () => {});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/components/order/__tests__/SalesStats.error-state.test.js src/components/order/__tests__/SalesNotificationList.error-state.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

- 统计/通知新增 error 状态、重试按钮、无数据引导
- 移除纯 console 失败处理

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/components/order/__tests__/SalesStats.error-state.test.js src/components/order/__tests__/SalesNotificationList.error-state.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/order/SalesStats.vue src/components/order/SalesNotificationList.vue src/components/order/__tests__/SalesStats.error-state.test.js src/components/order/__tests__/SalesNotificationList.error-state.test.js
git commit -m "refactor: add robust error states for stats and notifications"
```

---

### Task 10: Accessibility & Mobile UX Pass

**Files:**

- Modify: `src/components/order/OrderLogin.vue`
- Modify: `src/components/order/OrderForm.vue`
- Modify: `src/components/order/ProductBindingSection.vue`
- Modify: `src/views/sales/SalesListView.vue`
- Test: `src/components/order/__tests__/sales-a11y.test.js`

**Step 1: Write the failing test**

```js
it('login error uses aria-live alert region', async () => {});
it('primary touch targets are >= 44px in sales flow', async () => {});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/components/order/__tests__/sales-a11y.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

- 错误提示加 `role="alert"` + `aria-live`
- 核心按钮/选项触控高度对齐 44px+
- 聚焦样式统一，避免键盘导航丢失

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/components/order/__tests__/sales-a11y.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/order/OrderLogin.vue src/components/order/OrderForm.vue src/components/order/ProductBindingSection.vue src/views/sales/SalesListView.vue src/components/order/__tests__/sales-a11y.test.js
git commit -m "feat: finalize sales module accessibility and mobile UX polish"
```

---

### Task 11: Backend Sales Route Hardening

**Files:**

- Modify: `functions/lib/hono/routes/sales/orders.js`
- Modify: `functions/lib/hono/routes/sales/products.js`
- Create: `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`

**Step 1: Write the failing test**

```js
it('returns consistent error payload for variant validation failure', async () => {});
it('sales products endpoints return stable schema under empty/error', async () => {});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

- 错误结构统一（`success=false,error,code`）
- 产品接口空态返回稳定 schema

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/sales/orders.js functions/lib/hono/routes/sales/products.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js
git commit -m "refactor: harden sales API error contracts and schema stability"
```

---

### Task 12: Full Switch & Legacy Removal

**Files:**

- Modify: `src/config/feature-flags.js`
- Modify: `src/views/Sales.vue`
- Modify: `src/composables/useOrders.js`
- Remove/trim legacy branches discovered in previous tasks

**Step 1: Write the failing test**

```js
it('uses refactor path by default after full switch', () => {});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/views/sales/__tests__/sales-module-contract.test.js`
Expected: FAIL on default flag expectation

**Step 3: Write minimal implementation**

- 默认启用 `SALES_ORDER_V2`
- 删除 legacy dead code paths

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/views/sales/__tests__/sales-module-contract.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/config/feature-flags.js src/views/Sales.vue src/composables/useOrders.js
git commit -m "refactor: switch sales module to v2 by default and remove legacy paths"
```

---

### Task 13: Verification Gate + Docs + Rollback Runbook

**Files:**

- Modify: `docs/architecture/modules/preorder-creation-flow.md`
- Modify: `docs/user-manual/sales-guide.md`
- Create: `docs/architecture/modules/sales-order-module-v2.md`
- Create: `docs/plans/2026-03-01-sales-order-module-rollout-checklist.md`

**Step 1: Write the failing test**

N/A (docs task), use verification checklist instead.

**Step 2: Run verification commands**

Run:

- `npx eslint src/views/sales src/components/order src/composables/sales functions/lib/hono/routes/sales`
- `npm run test:unit -- src/views/sales/__tests__ src/components/order/__tests__ src/composables/__tests__/useSalesOrderApi.test.js src/composables/__tests__/useSalesOrderStateMachine.test.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
- `npm run build`

Expected:

- lint: no new errors from changed files
- tests: PASS
- build: PASS

**Step 3: Write docs and rollback runbook**

- 记录切换开关、监控项、告警阈值、回滚步骤（5 分钟内可回退）

**Step 4: Commit**

```bash
git add docs/architecture/modules/preorder-creation-flow.md docs/user-manual/sales-guide.md docs/architecture/modules/sales-order-module-v2.md docs/plans/2026-03-01-sales-order-module-rollout-checklist.md
git commit -m "docs: add sales order module v2 architecture and rollout runbook"
```

---

## Feasibility Guarantees

1. 先锁行为再重构: baseline contract tests 避免“功能悄悄变”。
2. 功能开关并行: 支持灰度，避免 Big Bang。
3. 逐任务可回滚: 每个 task 独立提交。
4. 明确验收门: lint + unit + build + runbook。
5. 线上可恢复: flag 回退 + API schema 稳定。

## Risk Matrix

- 高风险: 状态切换时业务中断
  - 缓解: Task 2 + Task 12 双向可切换
- 中风险: 组件重构引入回归
  - 缓解: Task 1 契约测试 + 分段提交
- 中风险: 异步状态重复渲染导致性能抖动
  - 缓解: 统一状态机 + 列表虚拟滚动回归测试

## Final Acceptance Criteria

- 销售端订单模块所有页面具备 loading/empty/error/retry 明确状态
- 页面级运行时错误不会整页白屏，具备恢复入口
- 绑定商品/变体流程失败可恢复，不出现静默失败
- 移动端关键触控目标 >= 44px，错误提示具备无障碍播报
- 全量替换完成后默认新路径，旧路径可按 runbook 回滚

# Frontend Request Core & OPA Consistency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a single request core for protected/admin traffic, enforce strict OPA-aligned permission behavior, and prevent regression back to duplicated or bypassed fetch logic.

**Architecture:** Introduce a shared HTTP core (`request + normalized error model + adapter modes`) and make `useAuth` a thin stateful wrapper over that core. Keep public pages and token-based sales pages isolated by adapter mode, while forcing all admin/protected calls through one pipeline. Align frontend permission checks with `/api/v1/permissions` contract and OPA decisions, then enforce via tests + CI guardrails.

**Tech Stack:** Vue 3, Vitest, Vite, Hono/Workers API contract, OPA/Rego policy outputs, ESLint, GitHub Actions.

---

### Task 1: Create Shared HTTP Core (Single Transport Primitive)

**Files:**
- Create: `src/utils/http-core.js`
- Test: `src/utils/__tests__/http-core.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { request } from '../http-core';

describe('http-core request', () => {
  it('throws normalized error for non-2xx response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: '权限不足: products:manage' }),
      statusText: 'Forbidden',
    });
    await expect(request('/api/manage/products')).rejects.toMatchObject({
      status: 403,
      message: '权限不足: products:manage',
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/utils/__tests__/http-core.test.js`  
Expected: FAIL with `request is not a function` or import error.

**Step 3: Write minimal implementation**

```js
export async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || data.message || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return res;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/utils/__tests__/http-core.test.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/utils/http-core.js src/utils/__tests__/http-core.test.js
git commit -m "feat(frontend): add shared http core with normalized errors"
```

### Task 2: Refactor useAuth to Delegate to HTTP Core

**Files:**
- Modify: `src/composables/useAuth.js`
- Test: `src/composables/__tests__/useAuth.test.js`

**Step 1: Write the failing test**

```js
it('authFetch keeps credentials include and resets auth state on 401', async () => {
  // Arrange state as authenticated, mock core request 401, expect reset
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/composables/__tests__/useAuth.test.js`  
Expected: FAIL because `useAuth` still uses direct `fetch` path or misses delegation behavior.

**Step 3: Write minimal implementation**

```js
import { request } from '@/utils/http-core';
// authFetch: return request(url, { ...options, credentials: 'include', signal })
// on 401: reset isAuthenticated/currentUser
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/composables/__tests__/useAuth.test.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/composables/useAuth.js src/composables/__tests__/useAuth.test.js
git commit -m "refactor(auth): route authFetch through shared http core"
```

### Task 3: Add Request Adapters for Public/Auth/Sales Modes

**Files:**
- Create: `src/composables/useRequestAdapters.js`
- Test: `src/composables/__tests__/useRequestAdapters.test.js`

**Step 1: Write the failing test**

```js
it('auth adapter injects credentials include', async () => {});
it('sales adapter injects bearer/token header only', async () => {});
it('public adapter does not inject auth credentials', async () => {});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/composables/__tests__/useRequestAdapters.test.js`  
Expected: FAIL due missing module.

**Step 3: Write minimal implementation**

```js
export function useRequestAdapters() {
  return { requestAuth, requestPublic, requestSales };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/composables/__tests__/useRequestAdapters.test.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/composables/useRequestAdapters.js src/composables/__tests__/useRequestAdapters.test.js
git commit -m "feat(frontend): add request adapters for auth/public/sales modes"
```

### Task 4: Migrate Remaining Protected/Admin Call Sites to Unified Pipeline

**Files:**
- Modify: `src/components/common/AIChatWidget.vue`
- Modify: `src/components/common/ImageUploader.vue`
- Modify: `src/composables/useAIStream.js`
- Modify: `src/composables/useUploadQueue.js`
- Modify: `src/components/order/OrderDetail.vue`
- Modify: `src/views/sales/SalesSpacesView.vue` (keep sales adapter, not admin auth mode)
- Test: `src/components/common/__tests__/ImageUploader.spec.js`
- Test: `src/composables/__tests__/useAIStream.test.js`

**Step 1: Write the failing test**

```js
it('never calls global fetch directly for protected routes', async () => {
  global.fetch = vi.fn(() => Promise.reject(new Error('direct fetch forbidden')));
  // Expect component/composable still works through mocked adapter/authFetch
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/common/__tests__/ImageUploader.spec.js src/composables/__tests__/useAIStream.test.js`  
Expected: FAIL with direct fetch path hit.

**Step 3: Write minimal implementation**

```js
// Replace direct protected fetch with authFetch/request adapter.
// Keep public and sales-token traffic in their designated adapter.
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/common/__tests__/ImageUploader.spec.js src/composables/__tests__/useAIStream.test.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/common/AIChatWidget.vue src/components/common/ImageUploader.vue src/composables/useAIStream.js src/composables/useUploadQueue.js src/components/order/OrderDetail.vue src/views/sales/SalesSpacesView.vue src/components/common/__tests__/ImageUploader.spec.js src/composables/__tests__/useAIStream.test.js
git commit -m "refactor(frontend): unify protected requests via adapters"
```

### Task 5: Enforce OPA-Strict Permission Projection (Remove Frontend Wildcards)

**Files:**
- Modify: `src/utils/order-state-machine.js`
- Modify: `src/composables/useAccessControl.js`
- Modify: `src/router/index.js`
- Test: `src/composables/__tests__/useAccessControl.test.js`
- Create: `src/utils/__tests__/order-state-machine.authz.test.js`

**Step 1: Write the failing test**

```js
it('does not treat "*" as force permission', () => {
  expect(hasForceStatusPermission(['*'])).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/composables/__tests__/useAccessControl.test.js src/utils/__tests__/order-state-machine.authz.test.js`  
Expected: FAIL because `*` currently grants force permission.

**Step 3: Write minimal implementation**

```js
// hasForceStatusPermission => only admin:full (or explicit OPA contract permission)
// router deny path => unified forbidden flow instead of ad-hoc dashboard redirect
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/composables/__tests__/useAccessControl.test.js src/utils/__tests__/order-state-machine.authz.test.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/utils/order-state-machine.js src/composables/useAccessControl.js src/router/index.js src/composables/__tests__/useAccessControl.test.js src/utils/__tests__/order-state-machine.authz.test.js
git commit -m "fix(authz): enforce opa-strict permission projection on frontend"
```

### Task 6: Unify Forbidden UX Entry Point Across Route + Page Layers

**Files:**
- Create: `src/views/Forbidden.vue`
- Modify: `src/router/index.js`
- Modify: `src/components/ui/PermissionDeniedState.vue`
- Modify: `src/views/Dashboard.vue`
- Modify: `src/views/Customers.vue`
- Modify: `src/views/GoodsOverview.vue`
- Modify: `src/views/PurchaseOrders.vue`
- Test: `src/views/__tests__/forbidden-flow.test.js`

**Step 1: Write the failing test**

```js
it('navigates to unified forbidden page when route permission fails', async () => {});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/views/__tests__/forbidden-flow.test.js`  
Expected: FAIL because router still redirects inconsistently.

**Step 3: Write minimal implementation**

```js
// Introduce /admin/forbidden
// Route guards and in-page forbidden states share same copy/action model
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/views/__tests__/forbidden-flow.test.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/views/Forbidden.vue src/router/index.js src/components/ui/PermissionDeniedState.vue src/views/Dashboard.vue src/views/Customers.vue src/views/GoodsOverview.vue src/views/PurchaseOrders.vue src/views/__tests__/forbidden-flow.test.js
git commit -m "feat(ux): unify forbidden route and page-level deny experience"
```

### Task 7: Add CI Guardrail Against Request-Path Regression

**Files:**
- Create: `scripts/qa/check-direct-protected-fetch.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci-test.yml`
- Test: `scripts/qa/__tests__/check-direct-protected-fetch.test.mjs`

**Step 1: Write the failing test**

```js
it('fails when src contains direct fetch to /api/manage or /api/v1/permissions', async () => {});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit scripts/qa/__tests__/check-direct-protected-fetch.test.mjs`  
Expected: FAIL before script implementation.

**Step 3: Write minimal implementation**

```js
// Scan source files, allowlist: useAuth.js + explicit public/sales modules.
// Exit 1 when protected endpoints use direct fetch.
```

**Step 4: Run test + CI local command**

Run: `node scripts/qa/check-direct-protected-fetch.mjs`  
Expected: PASS on clean tree, FAIL on injected violation fixture.

**Step 5: Commit**

```bash
git add scripts/qa/check-direct-protected-fetch.mjs scripts/qa/__tests__/check-direct-protected-fetch.test.mjs package.json .github/workflows/ci-test.yml
git commit -m "ci(authz): block direct protected fetch regressions"
```

### Task 8: Full Verification + Headless Audit + Documentation Closure

**Files:**
- Modify: `scripts/qa/admin-headless-audit.mjs`
- Create: `docs/architecture/frontend-request-core.md`
- Modify: `docs/plans/2026-03-06-authz-request-core-optimization-plan.md` (status section)
- Modify: `docs/developer-guide/*` relevant authz/request docs

**Step 1: Write failing verification checklist entry**

```md
- [ ] auth adapter only path verified
- [ ] deny/allow headless audit both pass
- [ ] ci guard script active
```

**Step 2: Run deny scenario audit**

Run: `AUDIT_SCENARIO=deny node scripts/qa/admin-headless-audit.mjs`  
Expected: report shows consistent deny states on protected routes.

**Step 3: Run allow scenario audit**

Run: `AUDIT_SCENARIO=allow node scripts/qa/admin-headless-audit.mjs`  
Expected: report shows no false permission-denied pages.

**Step 4: Run full verification bundle**

Run: `pnpm exec eslint src && pnpm test:unit && pnpm build`  
Expected: all pass.

**Step 5: Commit**

```bash
git add scripts/qa/admin-headless-audit.mjs docs/architecture/frontend-request-core.md docs/developer-guide docs/plans/2026-03-06-authz-request-core-optimization-plan.md
git commit -m "docs(authz): document request core and close optimization plan"
```

## Global Acceptance Criteria

- `src` 内受保护接口不再出现直连 `fetch`（允许 `useAuth.js` 作为底层实现点）。
- 前端权限判断与 OPA 决策保持严格一致（无 `*` wildcard side-rule）。
- 路由拒绝与页面拒绝 UI 行为一致（同一 forbidden 语义）。
- 新增 CI 守卫可阻断回归。
- Headless deny/allow 巡检报告可复现并可归档。

## Execution Order

1. Task 1 → 2（先建立内核，再改 auth）
2. Task 3 → 4（分配 adapter 并迁移调用）
3. Task 5 → 6（权限规则与 UX 收敛）
4. Task 7（CI 守卫）
5. Task 8（全量验证 + 文档收口）


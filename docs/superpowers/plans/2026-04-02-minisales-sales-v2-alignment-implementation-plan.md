# Minisales Sales V2 Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `minisales/` so the WeChat sales mini program matches the current web sales module in API contract usage, workflow semantics, and mobile UI hierarchy.

**Architecture:** Introduce a small tested sales client foundation inside `minisales/miniprogram/` with a unified HTTP layer, auth/session service, sales domain services, and pure normalization/controller helpers. Rebuild page flows on top of those helpers using WeChat-native pages and components, while aligning shell structure, page sections, status semantics, and major interactions to the live web sales experience.

**Tech Stack:** WeChat Mini Program, TypeScript, TDesign Mini Program, Skyline + glass-easel, Vitest, npm package scripts

---

## Scope Check

Keep this as one implementation plan. The migration spans multiple pages, but they are not independent subsystems:

- every page depends on the same `request/auth/session` foundation
- order list, form, and detail all depend on the same order and product services
- shell, notifications, and tab structure are shared
- stats and spaces need the same visual and state-system alignment

Splitting this into multiple plans would create cross-plan blocking dependencies and duplicate setup work.

## File Map

### New Files

- `minisales/vitest.config.ts`
- `minisales/tests/setup/wx.ts`
- `minisales/tests/unit/services/http.request.test.ts`
- `minisales/tests/unit/services/auth.session.test.ts`
- `minisales/tests/unit/services/orders.test.ts`
- `minisales/tests/unit/services/products.test.ts`
- `minisales/tests/unit/services/profile.test.ts`
- `minisales/tests/unit/utils/order-normalize.test.ts`
- `minisales/tests/unit/utils/product-normalize.test.ts`
- `minisales/tests/unit/utils/notification-normalize.test.ts`
- `minisales/tests/unit/pages/orders-list-controller.test.ts`
- `minisales/tests/unit/pages/order-form-controller.test.ts`
- `minisales/tests/unit/pages/order-detail-controller.test.ts`
- `minisales/tests/unit/pages/sales-stats-controller.test.ts`
- `minisales/tests/unit/pages/spaces-controller.test.ts`
- `minisales/miniprogram/services/http/request.ts`
- `minisales/miniprogram/services/auth/session.ts`
- `minisales/miniprogram/services/sales/orders.ts`
- `minisales/miniprogram/services/sales/products.ts`
- `minisales/miniprogram/services/sales/notifications.ts`
- `minisales/miniprogram/services/sales/stats.ts`
- `minisales/miniprogram/services/sales/spaces.ts`
- `minisales/miniprogram/services/sales/profile.ts`
- `minisales/miniprogram/utils/normalize/order.ts`
- `minisales/miniprogram/utils/normalize/product.ts`
- `minisales/miniprogram/utils/normalize/notification.ts`
- `minisales/miniprogram/pages/index/controller.ts`
- `minisales/miniprogram/pages/form/controller.ts`
- `minisales/miniprogram/pages/detail/controller.ts`
- `minisales/miniprogram/pages/stats/controller.ts`
- `minisales/miniprogram/pages/spaces/controller.ts`
- `minisales/miniprogram/pages/spaces_detail/controller.ts`
- `minisales/miniprogram/components/sales/app-shell/index.json`
- `minisales/miniprogram/components/sales/app-shell/index.ts`
- `minisales/miniprogram/components/sales/app-shell/index.wxml`
- `minisales/miniprogram/components/sales/app-shell/index.scss`
- `minisales/miniprogram/components/sales/state-panel/index.json`
- `minisales/miniprogram/components/sales/state-panel/index.ts`
- `minisales/miniprogram/components/sales/state-panel/index.wxml`
- `minisales/miniprogram/components/sales/state-panel/index.scss`
- `minisales/miniprogram/components/sales/order-card/index.json`
- `minisales/miniprogram/components/sales/order-card/index.ts`
- `minisales/miniprogram/components/sales/order-card/index.wxml`
- `minisales/miniprogram/components/sales/order-card/index.scss`
- `minisales/miniprogram/components/sales/notification-drawer/index.json`
- `minisales/miniprogram/components/sales/notification-drawer/index.ts`
- `minisales/miniprogram/components/sales/notification-drawer/index.wxml`
- `minisales/miniprogram/components/sales/notification-drawer/index.scss`
- `minisales/miniprogram/components/sales/product-binding/index.json`
- `minisales/miniprogram/components/sales/product-binding/index.ts`
- `minisales/miniprogram/components/sales/product-binding/index.wxml`
- `minisales/miniprogram/components/sales/product-binding/index.scss`
- `minisales/miniprogram/components/sales/order-summary/index.json`
- `minisales/miniprogram/components/sales/order-summary/index.ts`
- `minisales/miniprogram/components/sales/order-summary/index.wxml`
- `minisales/miniprogram/components/sales/order-summary/index.scss`
- `minisales/miniprogram/components/sales/order-lines/index.json`
- `minisales/miniprogram/components/sales/order-lines/index.ts`
- `minisales/miniprogram/components/sales/order-lines/index.wxml`
- `minisales/miniprogram/components/sales/order-lines/index.scss`
- `minisales/miniprogram/components/sales/timeline-card/index.json`
- `minisales/miniprogram/components/sales/timeline-card/index.ts`
- `minisales/miniprogram/components/sales/timeline-card/index.wxml`
- `minisales/miniprogram/components/sales/timeline-card/index.scss`
- `minisales/miniprogram/components/sales/stats-metric/index.json`
- `minisales/miniprogram/components/sales/stats-metric/index.ts`
- `minisales/miniprogram/components/sales/stats-metric/index.wxml`
- `minisales/miniprogram/components/sales/stats-metric/index.scss`

### Modified Files

- `minisales/package.json`
- `minisales/package-lock.json`
- `minisales/README.md`
- `minisales/miniprogram/app.json`
- `minisales/miniprogram/app.ts`
- `minisales/miniprogram/custom-tab-bar/index.json`
- `minisales/miniprogram/custom-tab-bar/index.ts`
- `minisales/miniprogram/custom-tab-bar/index.wxml`
- `minisales/miniprogram/custom-tab-bar/index.scss`
- `minisales/miniprogram/pages/login/login.json`
- `minisales/miniprogram/pages/login/login.ts`
- `minisales/miniprogram/pages/login/login.wxml`
- `minisales/miniprogram/pages/login/login.scss`
- `minisales/miniprogram/pages/index/index.json`
- `minisales/miniprogram/pages/index/index.ts`
- `minisales/miniprogram/pages/index/index.wxml`
- `minisales/miniprogram/pages/index/index.scss`
- `minisales/miniprogram/pages/form/form.json`
- `minisales/miniprogram/pages/form/form.ts`
- `minisales/miniprogram/pages/form/form.wxml`
- `minisales/miniprogram/pages/form/form.scss`
- `minisales/miniprogram/pages/detail/detail.json`
- `minisales/miniprogram/pages/detail/detail.ts`
- `minisales/miniprogram/pages/detail/detail.wxml`
- `minisales/miniprogram/pages/detail/detail.scss`
- `minisales/miniprogram/pages/stats/stats.json`
- `minisales/miniprogram/pages/stats/stats.ts`
- `minisales/miniprogram/pages/stats/stats.wxml`
- `minisales/miniprogram/pages/stats/stats.scss`
- `minisales/miniprogram/pages/spaces/spaces.json`
- `minisales/miniprogram/pages/spaces/spaces.ts`
- `minisales/miniprogram/pages/spaces/spaces.wxml`
- `minisales/miniprogram/pages/spaces/spaces.scss`
- `minisales/miniprogram/pages/spaces_detail/detail.json`
- `minisales/miniprogram/pages/spaces_detail/detail.ts`
- `minisales/miniprogram/pages/spaces_detail/detail.wxml`
- `minisales/miniprogram/pages/spaces_detail/detail.scss`
- `minisales/miniprogram/utils/api.ts`
- `minisales/miniprogram/utils/auth.ts`
- `minisales/miniprogram/utils/constants.ts`
- `minisales/miniprogram/utils/helpers.ts`
- `minisales/miniprogram/utils/store.ts`
- `minisales/miniprogram/utils/ui-helpers.ts`
- `minisales/miniprogram/utils/upload-manager.ts`
- `docs/developer-guide/minisales.md`

## Task 1: Add Minisales Test Harness and HTTP Transport Foundation

**Files:**
- Create: `minisales/vitest.config.ts`
- Create: `minisales/tests/setup/wx.ts`
- Create: `minisales/tests/unit/services/http.request.test.ts`
- Create: `minisales/miniprogram/services/http/request.ts`
- Modify: `minisales/package.json`
- Modify: `minisales/package-lock.json`
- Modify: `minisales/miniprogram/utils/api.ts`
- Modify: `minisales/miniprogram/utils/constants.ts`

- [ ] **Step 1: Add local test scripts/config and write failing transport tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { installMockWx } from '../../setup/wx';
import { salesRequest } from '../../../miniprogram/services/http/request';

describe('salesRequest', () => {
  it('injects bearer token and unwraps success payload', async () => {
    installMockWx({
      getStorageSync: vi.fn((key: string) => (key === 'sales_token' ? 'jwt-1' : '')),
      request: vi.fn(({ success }) =>
        success?.({
          statusCode: 200,
          data: { success: true, data: { orders: [] } },
        })
      ),
    });

    const result = await salesRequest<{ orders: unknown[] }>({
      path: '/api/sales/token-1/orders',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ orders: [] });
  });

  it('normalizes backend error payloads into a stable shape', async () => {
    installMockWx({
      request: vi.fn(({ success }) =>
        success?.({
          statusCode: 403,
          data: { success: false, error: 'forbidden', code: 'FORBIDDEN' },
        })
      ),
    });

    const result = await salesRequest({
      path: '/api/sales/token-1/orders',
    });

    expect(result).toMatchObject({
      success: false,
      error: 'forbidden',
      code: 'FORBIDDEN',
      status: 403,
    });
  });
});
```

- [ ] **Step 2: Install local dev dependencies for minisales**

Run: `cd minisales && npm install`
Expected: PASS and `package-lock.json` updates for `vitest`, `typescript`, and related test tooling

- [ ] **Step 3: Run the new transport tests to confirm the foundation is missing**

Run: `cd minisales && npm run test:unit -- tests/unit/services/http.request.test.ts`
Expected: FAIL with missing `services/http/request` module or missing exported methods

- [ ] **Step 4: Implement the unified request layer and bridge the old utils to it**

```ts
export interface SalesRequestResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  code: string | null;
  status: number;
}

export async function salesRequest<T>({
  path,
  method = 'GET',
  data,
  header = {},
}: SalesRequestOptions): Promise<SalesRequestResult<T>> {
  const token = getToken();
  const requestHeader = {
    'Content-Type': 'application/json',
    ...header,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  return new Promise((resolve) => {
    wx.request({
      url: `${API_BASE_URL}${path}`,
      method,
      data,
      header: requestHeader,
      success: (res) => {
        const payload = (res.data || {}) as Record<string, unknown>;
        resolve({
          success: Boolean(payload.success),
          data: (payload.data as T) ?? null,
          error: (payload.error as string) || (payload.message as string) || null,
          code: (payload.code as string) || null,
          status: Number(res.statusCode || 0),
        });
      },
      fail: () =>
        resolve({
          success: false,
          data: null,
          error: '网络请求失败',
          code: 'NETWORK_ERROR',
          status: 0,
        }),
    });
  });
}
```

```ts
export const SALES_API = {
  login: '/api/sales/login',
  wechatLogin: '/api/sales/wechat-login',
  auth: (token: string) => `/api/sales/${token}/auth`,
  bindWechat: (token: string) => `/api/sales/${token}/bind-wechat`,
  orders: (token: string) => `/api/sales/${token}/orders`,
  orderById: (token: string, id: string) => `/api/sales/${token}/orders/${id}`,
  orderRead: (token: string, id: string) => `/api/sales/${token}/orders/${id}/read`,
  orderComment: (token: string, id: string) => `/api/sales/${token}/orders/${id}/comment`,
  upload: (token: string) => `/api/sales/${token}/upload`,
  products: (token: string) => `/api/sales/${token}/products`,
  productById: (token: string, id: string) => `/api/sales/${token}/products/${id}`,
  stats: (token: string) => `/api/sales/${token}/stats`,
  spaces: (token: string) => `/api/sales/${token}/spaces`,
  spaceById: (token: string, id: string) => `/api/sales/${token}/spaces/${id}`,
  notifications: (token: string) => `/api/sales/${token}/notifications`,
  notificationRead: (token: string, id: string) => `/api/sales/${token}/notifications/${id}/read`,
};
```

- [ ] **Step 5: Run transport tests and typecheck**

Run: `cd minisales && npm run test:unit -- tests/unit/services/http.request.test.ts`
Expected: PASS

Run: `cd minisales && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add minisales/package.json minisales/package-lock.json minisales/vitest.config.ts minisales/tests/setup/wx.ts minisales/tests/unit/services/http.request.test.ts minisales/miniprogram/services/http/request.ts minisales/miniprogram/utils/api.ts minisales/miniprogram/utils/constants.ts
git commit -m "test: add minisales transport harness"
```

## Task 2: Rebuild Auth Session and Shared Shell Primitives

**Files:**
- Create: `minisales/tests/unit/services/auth.session.test.ts`
- Create: `minisales/miniprogram/services/auth/session.ts`
- Create: `minisales/miniprogram/components/sales/app-shell/index.json`
- Create: `minisales/miniprogram/components/sales/app-shell/index.ts`
- Create: `minisales/miniprogram/components/sales/app-shell/index.wxml`
- Create: `minisales/miniprogram/components/sales/app-shell/index.scss`
- Create: `minisales/miniprogram/components/sales/state-panel/index.json`
- Create: `minisales/miniprogram/components/sales/state-panel/index.ts`
- Create: `minisales/miniprogram/components/sales/state-panel/index.wxml`
- Create: `minisales/miniprogram/components/sales/state-panel/index.scss`
- Modify: `minisales/miniprogram/app.ts`
- Modify: `minisales/miniprogram/app.json`
- Modify: `minisales/miniprogram/custom-tab-bar/index.json`
- Modify: `minisales/miniprogram/custom-tab-bar/index.ts`
- Modify: `minisales/miniprogram/custom-tab-bar/index.wxml`
- Modify: `minisales/miniprogram/custom-tab-bar/index.scss`
- Modify: `minisales/miniprogram/pages/login/login.json`
- Modify: `minisales/miniprogram/pages/login/login.ts`
- Modify: `minisales/miniprogram/pages/login/login.wxml`
- Modify: `minisales/miniprogram/pages/login/login.scss`
- Modify: `minisales/miniprogram/utils/auth.ts`
- Modify: `minisales/miniprogram/utils/store.ts`

- [ ] **Step 1: Write failing auth/session tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { restoreSalesSession, clearSalesSession } from '../../../miniprogram/services/auth/session';

describe('restoreSalesSession', () => {
  it('hydrates user state when access token and JWT are valid', async () => {
    const getCurrentUser = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'sp-1', name: 'Alice', store: 'Shanghai' },
    });

    const result = await restoreSalesSession({
      accessToken: 'sales-token',
      getCurrentUser,
    });

    expect(result).toMatchObject({
      ok: true,
      user: { id: 'sp-1', name: 'Alice', store: 'Shanghai' },
    });
  });

  it('clears stale session data when auth check fails', async () => {
    const result = await restoreSalesSession({
      accessToken: 'sales-token',
      getCurrentUser: vi.fn().mockResolvedValue({
        success: false,
        error: 'expired',
      }),
    });

    expect(result).toEqual({ ok: false, reason: 'expired' });
  });
});
```

- [ ] **Step 2: Run auth/session tests to confirm the new service does not exist yet**

Run: `cd minisales && npm run test:unit -- tests/unit/services/auth.session.test.ts`
Expected: FAIL with missing `services/auth/session` module

- [ ] **Step 3: Implement the session service and rebuild the shared shell/login entry**

```ts
export async function restoreSalesSession({
  accessToken,
  getCurrentUser,
}: RestoreSessionOptions) {
  if (!accessToken) {
    return { ok: false, reason: 'missing_access_token' } as const;
  }

  const result = await getCurrentUser(accessToken);
  if (!result.success || !result.data) {
    clearSalesSession();
    return { ok: false, reason: result.error || 'expired' } as const;
  }

  persistSalesUser(result.data);
  return { ok: true, user: result.data } as const;
}
```

```ts
Component({
  properties: {
    title: String,
    subtitle: String,
    showTabs: { type: Boolean, value: true },
    unreadCount: { type: Number, value: 0 },
  },
  methods: {
    onTapOrders() { this.triggerEvent('navigate', { target: 'orders' }); },
    onTapSpaces() { this.triggerEvent('navigate', { target: 'spaces' }); },
    onTapStats() { this.triggerEvent('navigate', { target: 'stats' }); },
    onTapNotifications() { this.triggerEvent('notifications'); },
  },
});
```

Implementation notes:

- remove stats from the bottom tab bar and make it a header action, matching the web sales shell
- keep only `订单` and `资源` in `tabBar.list`
- move login page from the current bare form into a centered auth card layout
- update `app.ts` to persist inbound `query.token` before session restore
- centralize logout/session clearing in one place instead of page-local redirects
- support both username/password login and WeChat login on the rebuilt login page
- persist `loginMethod` in storage/store so later pages can decide whether to surface a `绑定微信` CTA

- [ ] **Step 4: Run auth/session tests and full minisales typecheck**

Run: `cd minisales && npm run test:unit -- tests/unit/services/auth.session.test.ts`
Expected: PASS

Run: `cd minisales && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Manually verify shell/login behavior in WeChat DevTools**

Manual verification:

- open `minisales/` in 微信开发者工具
- confirm unauthenticated launch lands on `pages/login/login`
- confirm the top shell shows a header action for stats instead of a third bottom tab
- confirm successful login routes to the order list and persists session on reopen
- confirm the login page exposes password login and, when backend config allows, WeChat one-click login

- [ ] **Step 6: Commit**

```bash
git add minisales/miniprogram/services/auth/session.ts minisales/tests/unit/services/auth.session.test.ts minisales/miniprogram/components/sales/app-shell minisales/miniprogram/components/sales/state-panel minisales/miniprogram/app.ts minisales/miniprogram/app.json minisales/miniprogram/custom-tab-bar/index.json minisales/miniprogram/custom-tab-bar/index.ts minisales/miniprogram/custom-tab-bar/index.wxml minisales/miniprogram/custom-tab-bar/index.scss minisales/miniprogram/pages/login/login.json minisales/miniprogram/pages/login/login.ts minisales/miniprogram/pages/login/login.wxml minisales/miniprogram/pages/login/login.scss minisales/miniprogram/utils/auth.ts minisales/miniprogram/utils/store.ts
git commit -m "feat: rebuild minisales auth shell foundation"
```

## Task 3: Add Sales Domain Services and Normalization Helpers

**Files:**
- Create: `minisales/tests/unit/services/orders.test.ts`
- Create: `minisales/tests/unit/services/products.test.ts`
- Create: `minisales/tests/unit/services/profile.test.ts`
- Create: `minisales/tests/unit/utils/order-normalize.test.ts`
- Create: `minisales/tests/unit/utils/product-normalize.test.ts`
- Create: `minisales/tests/unit/utils/notification-normalize.test.ts`
- Create: `minisales/miniprogram/services/sales/orders.ts`
- Create: `minisales/miniprogram/services/sales/products.ts`
- Create: `minisales/miniprogram/services/sales/notifications.ts`
- Create: `minisales/miniprogram/services/sales/stats.ts`
- Create: `minisales/miniprogram/services/sales/spaces.ts`
- Create: `minisales/miniprogram/services/sales/profile.ts`
- Create: `minisales/miniprogram/utils/normalize/order.ts`
- Create: `minisales/miniprogram/utils/normalize/product.ts`
- Create: `minisales/miniprogram/utils/normalize/notification.ts`
- Modify: `minisales/miniprogram/utils/helpers.ts`
- Modify: `minisales/miniprogram/utils/ui-helpers.ts`

- [ ] **Step 1: Write failing service and normalizer tests**

```ts
it('sends current create-order payload shape with fileIds and product binding', async () => {
  const request = vi.fn().mockResolvedValue({ success: true, data: { id: 'o-1' } });
  await createSalesOrder(
    {
      accessToken: 'sales-token',
      name: 'Bound Product',
      quantity: 2,
      fileIds: ['f-1', 'f-2'],
      productId: 'p-1',
      variantId: 'v-1',
    },
    request
  );

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      path: '/api/sales/sales-token/orders',
      method: 'POST',
      data: {
        name: 'Bound Product',
        quantity: 2,
        fileIds: ['f-1', 'f-2'],
        productId: 'p-1',
        variantId: 'v-1',
      },
    })
  );
});

it('normalizes order detail into header lines files and timeline groups', () => {
  const detail = normalizeSalesOrderDetail({
    id: 'o-1',
    orderNo: 'SO-001',
    quantity: 3,
    currentData: { name: 'Poster' },
    lines: [{ id: 'l-1', snapshot_name: 'Poster', ordered_qty: 3, display_status: 'fully_procured' }],
    files: [{ id: 'f-1', url: '/file/a.png' }],
    timeline: [{ id: 't-1', actionType: 'created', createdAt: 1 }],
  });

  expect(detail.header.title).toBe('Poster');
  expect(detail.lines[0].status).toBe('fully_procured');
  expect(detail.timeline).toHaveLength(1);
});

it('binds WeChat by exchanging wx.login code against the current sales token', async () => {
  const request = vi.fn().mockResolvedValue({ success: true, data: null });
  const getWechatCode = vi.fn().mockResolvedValue('wx-code-1');

  await bindSalesWechat(
    { accessToken: 'sales-token' },
    { request, getWechatCode }
  );

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      path: '/api/sales/sales-token/bind-wechat',
      method: 'POST',
      data: { code: 'wx-code-1' },
    })
  );
});
```

- [ ] **Step 2: Run the new service tests to confirm the modules are missing**

Run: `cd minisales && npm run test:unit -- tests/unit/services/orders.test.ts tests/unit/services/products.test.ts tests/unit/services/profile.test.ts tests/unit/utils/order-normalize.test.ts tests/unit/utils/product-normalize.test.ts tests/unit/utils/notification-normalize.test.ts`
Expected: FAIL with missing service or normalizer modules

- [ ] **Step 3: Implement the sales service layer and pure normalizers**

```ts
export async function createSalesOrder(input: CreateSalesOrderInput, request = salesRequest) {
  return request<{ id: string; orderNo: string }>({
    path: SALES_API.orders(input.accessToken),
    method: 'POST',
    data: {
      name: input.name,
      brand: input.brand || '',
      series: input.series || '',
      sku: input.sku || '',
      size: input.size || '',
      color: input.color || '',
      material: input.material || '',
      remark: input.remark || '',
      deadline: input.deadline || '',
      quantity: Number(input.quantity || 1),
      fileIds: input.fileIds || [],
      ...(input.productId ? { productId: input.productId } : {}),
      ...(input.variantId ? { variantId: input.variantId } : {}),
    },
  });
}
```

```ts
export async function bindSalesWechat(
  { accessToken }: { accessToken: string },
  {
    request = salesRequest,
    getWechatCode = defaultGetWechatCode,
  }: BindWechatDeps = {}
) {
  const code = await getWechatCode();
  if (!code) {
    return {
      success: false,
      data: null,
      error: '获取微信登录凭证失败',
      code: 'WECHAT_CODE_MISSING',
      status: 0,
    };
  }

  return request({
    path: SALES_API.bindWechat(accessToken),
    method: 'POST',
    data: { code },
  });
}
```

```ts
export function normalizeSalesOrderSummary(raw: any) {
  const title = raw.currentData?.name || raw.name || raw.orderNo || '未命名订单';
  return {
    id: raw.id,
    orderNo: raw.orderNo,
    title,
    quantity: Number(raw.quantity || raw.currentData?.quantity || 1),
    status: raw.displayStatus || raw.status || 'pending',
    hasNewFeedback: Boolean(raw.hasNewFeedback),
    imageUrl: raw.mainImage || raw.mainImageUrl || '',
    updatedAt: Number(raw.updatedAt || raw.createdAt || 0),
  };
}
```

Implementation notes:

- keep all backend interaction in the new `services/sales/*` files
- keep all `currentData` vs top-level fallback logic out of page files
- give products service explicit helpers for `loadProductList`, `loadProductDetail`, and `pickSelectableVariants`
- give notifications service explicit `list`, `markRead`, and `markAllRead` methods
- give profile service explicit `getCurrentSalesProfile` and `bindSalesWechat` methods
- keep the WeChat bind entry driven by stored `loginMethod === 'password'`; do not block the rest of the app on the bind flow

- [ ] **Step 4: Run service and normalizer tests plus typecheck**

Run: `cd minisales && npm run test:unit -- tests/unit/services/orders.test.ts tests/unit/services/products.test.ts tests/unit/services/profile.test.ts tests/unit/utils/order-normalize.test.ts tests/unit/utils/product-normalize.test.ts tests/unit/utils/notification-normalize.test.ts`
Expected: PASS

Run: `cd minisales && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add minisales/tests/unit/services/orders.test.ts minisales/tests/unit/services/products.test.ts minisales/tests/unit/services/profile.test.ts minisales/tests/unit/utils/order-normalize.test.ts minisales/tests/unit/utils/product-normalize.test.ts minisales/tests/unit/utils/notification-normalize.test.ts minisales/miniprogram/services/sales/orders.ts minisales/miniprogram/services/sales/products.ts minisales/miniprogram/services/sales/notifications.ts minisales/miniprogram/services/sales/stats.ts minisales/miniprogram/services/sales/spaces.ts minisales/miniprogram/services/sales/profile.ts minisales/miniprogram/utils/normalize/order.ts minisales/miniprogram/utils/normalize/product.ts minisales/miniprogram/utils/normalize/notification.ts minisales/miniprogram/utils/helpers.ts minisales/miniprogram/utils/ui-helpers.ts
git commit -m "feat: add minisales sales domain services"
```

## Task 4: Rebuild Order List and Notification Experience

**Files:**
- Create: `minisales/tests/unit/pages/orders-list-controller.test.ts`
- Create: `minisales/miniprogram/pages/index/controller.ts`
- Create: `minisales/miniprogram/components/sales/order-card/index.json`
- Create: `minisales/miniprogram/components/sales/order-card/index.ts`
- Create: `minisales/miniprogram/components/sales/order-card/index.wxml`
- Create: `minisales/miniprogram/components/sales/order-card/index.scss`
- Create: `minisales/miniprogram/components/sales/notification-drawer/index.json`
- Create: `minisales/miniprogram/components/sales/notification-drawer/index.ts`
- Create: `minisales/miniprogram/components/sales/notification-drawer/index.wxml`
- Create: `minisales/miniprogram/components/sales/notification-drawer/index.scss`
- Modify: `minisales/miniprogram/pages/index/index.json`
- Modify: `minisales/miniprogram/pages/index/index.ts`
- Modify: `minisales/miniprogram/pages/index/index.wxml`
- Modify: `minisales/miniprogram/pages/index/index.scss`
- Modify: `minisales/miniprogram/components/sales/app-shell/index.ts`
- Modify: `minisales/miniprogram/components/sales/app-shell/index.wxml`
- Modify: `minisales/miniprogram/components/sales/app-shell/index.scss`

- [ ] **Step 1: Write failing order-list controller tests**

```ts
import { buildOrdersListState, filterOrdersBySearch } from '../../../miniprogram/pages/index/controller';

it('merges paginated order pages without losing current items', () => {
  const state = buildOrdersListState(
    [{ id: 'o-1', orderNo: 'SO-001' }],
    {
      orders: [{ id: 'o-2', orderNo: 'SO-002' }],
      pagination: { page: 2, totalPages: 3, total: 2 },
    },
    true
  );

  expect(state.orders.map((item) => item.id)).toEqual(['o-1', 'o-2']);
});

it('filters by order number or title', () => {
  const result = filterOrdersBySearch(
    [
      { id: 'o-1', orderNo: 'SO-001', title: 'Poster' },
      { id: 'o-2', orderNo: 'SO-002', title: 'Lamp' },
    ],
    'poster'
  );

  expect(result).toHaveLength(1);
  expect(result[0].id).toBe('o-1');
});
```

- [ ] **Step 2: Run list-controller tests to verify the new page helper is missing**

Run: `cd minisales && npm run test:unit -- tests/unit/pages/orders-list-controller.test.ts`
Expected: FAIL with missing `pages/index/controller` module

- [ ] **Step 3: Implement the controller, order cards, notification drawer, and list page**

```ts
export function buildOrdersListState(existing: OrderSummary[], payload: OrdersPagePayload, append = false) {
  const nextOrders = append ? [...existing, ...payload.orders] : payload.orders;
  return {
    orders: nextOrders,
    pagination: payload.pagination,
    canLoadMore: payload.pagination.page < payload.pagination.totalPages,
  };
}
```

```ts
Page({
  async onShow() {
    await this.loadInitialData();
  },

  async loadInitialData() {
    this.setData({ loading: true, state: 'loading' });
    const [ordersResult, notificationsResult] = await Promise.all([
      loadSalesOrders({ accessToken: getAccessToken(), page: 1 }),
      loadSalesNotifications({ accessToken: getAccessToken(), limit: 20 }),
    ]);

    if (!ordersResult.success) {
      this.setData({ state: 'error', errorMessage: ordersResult.error || '加载失败' });
      return;
    }

    this.setData({
      ...buildOrdersListState([], ordersResult.data, false),
      unreadCount: notificationsResult.success ? countUnreadNotifications(notificationsResult.data) : 0,
      state: ordersResult.data.orders.length ? 'ready' : 'empty',
    });
  },
});
```

Implementation notes:

- use the shared `app-shell` component at the top of the page
- anchor the search input below the shell, matching the web mobile order list hierarchy
- use the new `state-panel` component for loading, error, and empty states
- move notification display into the shell-owned drawer instead of scattering notification UI in each page

- [ ] **Step 4: Run order-list tests and full minisales test suite**

Run: `cd minisales && npm run test:unit -- tests/unit/pages/orders-list-controller.test.ts`
Expected: PASS

Run: `cd minisales && npm run test:unit`
Expected: PASS

Run: `cd minisales && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Manually verify list and notifications in WeChat DevTools**

Manual verification:

- list page shows web-aligned header, search, cards, and empty/error states
- pull-to-refresh and pagination both work
- unread notification count updates in the shell
- tapping a notification navigates to the correct order detail

- [ ] **Step 6: Commit**

```bash
git add minisales/tests/unit/pages/orders-list-controller.test.ts minisales/miniprogram/pages/index/controller.ts minisales/miniprogram/components/sales/order-card minisales/miniprogram/components/sales/notification-drawer minisales/miniprogram/pages/index/index.json minisales/miniprogram/pages/index/index.ts minisales/miniprogram/pages/index/index.wxml minisales/miniprogram/pages/index/index.scss minisales/miniprogram/components/sales/app-shell/index.ts minisales/miniprogram/components/sales/app-shell/index.wxml minisales/miniprogram/components/sales/app-shell/index.scss
git commit -m "feat: rebuild minisales order list experience"
```

## Task 5: Rebuild Product Binding and Order Form Flow

**Files:**
- Create: `minisales/tests/unit/pages/order-form-controller.test.ts`
- Create: `minisales/miniprogram/pages/form/controller.ts`
- Create: `minisales/miniprogram/components/sales/product-binding/index.json`
- Create: `minisales/miniprogram/components/sales/product-binding/index.ts`
- Create: `minisales/miniprogram/components/sales/product-binding/index.wxml`
- Create: `minisales/miniprogram/components/sales/product-binding/index.scss`
- Modify: `minisales/miniprogram/pages/form/form.json`
- Modify: `minisales/miniprogram/pages/form/form.ts`
- Modify: `minisales/miniprogram/pages/form/form.wxml`
- Modify: `minisales/miniprogram/pages/form/form.scss`
- Modify: `minisales/miniprogram/utils/upload-manager.ts`
- Modify: `minisales/miniprogram/services/sales/orders.ts`

- [ ] **Step 1: Write failing form-controller tests**

```ts
import { buildCreatePayload, canSubmitOrderForm } from '../../../miniprogram/pages/form/controller';

it('builds a create payload with fileIds and selected product binding', () => {
  const payload = buildCreatePayload({
    form: { name: 'Poster', brand: 'KK', quantity: 2, remark: '' },
    uploads: [{ id: 'f-1', status: 'done' }, { id: 'f-2', status: 'done' }],
    boundProduct: { productId: 'p-1', variantId: 'v-1' },
  });

  expect(payload).toEqual(
    expect.objectContaining({
      name: 'Poster',
      quantity: 2,
      fileIds: ['f-1', 'f-2'],
      productId: 'p-1',
      variantId: 'v-1',
    })
  );
});

it('blocks submit while files are still uploading', () => {
  expect(canSubmitOrderForm([{ id: 'f-1', status: 'loading' }])).toBe(false);
});
```

- [ ] **Step 2: Run form-controller tests to confirm the helper does not exist yet**

Run: `cd minisales && npm run test:unit -- tests/unit/pages/order-form-controller.test.ts`
Expected: FAIL with missing `pages/form/controller` module

- [ ] **Step 3: Implement the controller, product binding component, and rebuilt form page**

```ts
export function buildCreatePayload({ form, uploads, boundProduct }: BuildCreatePayloadInput) {
  return {
    name: form.name.trim(),
    brand: form.brand?.trim() || '',
    series: form.series?.trim() || '',
    sku: form.sku?.trim() || '',
    size: form.size?.trim() || '',
    color: form.color?.trim() || '',
    material: form.material?.trim() || '',
    remark: form.remark?.trim() || '',
    deadline: form.deadline || '',
    quantity: Number(form.quantity || 1),
    fileIds: uploads.filter((item) => item.status === 'done' && item.id).map((item) => item.id as string),
    ...(boundProduct?.productId ? { productId: boundProduct.productId } : {}),
    ...(boundProduct?.variantId ? { variantId: boundProduct.variantId } : {}),
  };
}
```

```ts
Component({
  properties: {
    salesToken: String,
    value: Object,
  },
  methods: {
    async openPicker() {
      const list = await loadSalesProducts({ accessToken: this.data.salesToken, page: 1, limit: 12 });
      this.setData({ products: list.success ? list.data.items : [] });
    },
    async selectProduct(productId: string) {
      const detail = await loadSalesProductDetail({ accessToken: this.data.salesToken, productId });
      this.setData({ productDetail: detail.data });
    },
  },
});
```

Implementation notes:

- keep product binding above the main form, matching the web create screen
- support duplicate-prefill from detail while still letting manual creation work with no product binding
- preserve upload exit-warning behavior, but move upload state truth to the controller/helpers
- use the new `fileIds` payload and stop sending `images`

- [ ] **Step 4: Run form-controller tests, full unit suite, and typecheck**

Run: `cd minisales && npm run test:unit -- tests/unit/pages/order-form-controller.test.ts`
Expected: PASS

Run: `cd minisales && npm run test:unit`
Expected: PASS

Run: `cd minisales && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Manually verify create-order flows in WeChat DevTools**

Manual verification:

- manual create works with uploaded files
- product binding loads current products and selectable variants
- duplicate from detail prefills the form correctly
- submit sends `fileIds` and optional `productId` / `variantId`
- submit failure preserves the page state instead of wiping the form

- [ ] **Step 6: Commit**

```bash
git add minisales/tests/unit/pages/order-form-controller.test.ts minisales/miniprogram/pages/form/controller.ts minisales/miniprogram/components/sales/product-binding minisales/miniprogram/pages/form/form.json minisales/miniprogram/pages/form/form.ts minisales/miniprogram/pages/form/form.wxml minisales/miniprogram/pages/form/form.scss minisales/miniprogram/utils/upload-manager.ts minisales/miniprogram/services/sales/orders.ts
git commit -m "feat: rebuild minisales sales order form"
```

## Task 6: Rebuild Order Detail Flow

**Files:**
- Create: `minisales/tests/unit/pages/order-detail-controller.test.ts`
- Create: `minisales/miniprogram/pages/detail/controller.ts`
- Create: `minisales/miniprogram/components/sales/order-summary/index.json`
- Create: `minisales/miniprogram/components/sales/order-summary/index.ts`
- Create: `minisales/miniprogram/components/sales/order-summary/index.wxml`
- Create: `minisales/miniprogram/components/sales/order-summary/index.scss`
- Create: `minisales/miniprogram/components/sales/order-lines/index.json`
- Create: `minisales/miniprogram/components/sales/order-lines/index.ts`
- Create: `minisales/miniprogram/components/sales/order-lines/index.wxml`
- Create: `minisales/miniprogram/components/sales/order-lines/index.scss`
- Create: `minisales/miniprogram/components/sales/timeline-card/index.json`
- Create: `minisales/miniprogram/components/sales/timeline-card/index.ts`
- Create: `minisales/miniprogram/components/sales/timeline-card/index.wxml`
- Create: `minisales/miniprogram/components/sales/timeline-card/index.scss`
- Modify: `minisales/miniprogram/pages/detail/detail.json`
- Modify: `minisales/miniprogram/pages/detail/detail.ts`
- Modify: `minisales/miniprogram/pages/detail/detail.wxml`
- Modify: `minisales/miniprogram/pages/detail/detail.scss`
- Modify: `minisales/miniprogram/services/sales/orders.ts`

- [ ] **Step 1: Write failing detail-controller tests**

```ts
import { buildOrderDetailViewModel, buildDuplicatePrefill } from '../../../miniprogram/pages/detail/controller';

it('projects detail data into header lines files and timeline sections', () => {
  const model = buildOrderDetailViewModel({
    id: 'o-1',
    orderNo: 'SO-001',
    status: 'pending',
    quantity: 2,
    currentData: { name: 'Poster' },
    lines: [{ id: 'l-1', snapshot_name: 'Poster', ordered_qty: 2, display_status: 'partially_received' }],
    files: [{ id: 'f-1', url: '/file/a.png' }],
    timeline: [{ id: 't-1', actionType: 'created', createdAt: 1 }],
  });

  expect(model.summary.title).toBe('Poster');
  expect(model.lines[0].status).toBe('partially_received');
  expect(model.timeline[0].id).toBe('t-1');
});

it('builds duplicate prefill from top-level quantity and current binding ids', () => {
  const prefill = buildDuplicatePrefill({
    quantity: 3,
    currentData: { name: 'Poster' },
    productId: 'p-1',
    variantId: 'v-1',
  });

  expect(prefill).toMatchObject({
    name: 'Poster',
    quantity: 3,
    productId: 'p-1',
    variantId: 'v-1',
  });
});
```

- [ ] **Step 2: Run detail-controller tests to confirm the helper is missing**

Run: `cd minisales && npm run test:unit -- tests/unit/pages/order-detail-controller.test.ts`
Expected: FAIL with missing `pages/detail/controller` module

- [ ] **Step 3: Implement detail controller, read/comment behavior, and rebuilt detail UI**

```ts
export function buildOrderDetailViewModel(detail: any) {
  return {
    summary: {
      orderNo: detail.orderNo,
      title: detail.currentData?.name || detail.lines?.[0]?.snapshot_name || detail.orderNo,
      status: detail.displayStatus || detail.status,
      quantity: Number(detail.quantity || detail.currentData?.quantity || 1),
    },
    lines: (detail.lines || []).map((line: any) => ({
      id: line.id,
      title: line.snapshot_name,
      orderedQty: Number(line.ordered_qty || 0),
      procuredQty: Number(line.procured_qty || 0),
      receivedQty: Number(line.received_qty || 0),
      shippedQty: Number(line.shipped_qty || 0),
      status: line.display_status || 'pending',
    })),
    files: detail.files || [],
    timeline: detail.timeline || [],
  };
}
```

```ts
Page({
  async loadOrderDetail(orderId: string) {
    this.setData({ state: 'loading' });
    const result = await getSalesOrderDetail({ accessToken: getAccessToken(), orderId });
    if (!result.success || !result.data) {
      this.setData({ state: 'error', errorMessage: result.error || '加载失败' });
      return;
    }

    this.setData({
      state: 'ready',
      detail: buildOrderDetailViewModel(result.data),
      duplicatePrefill: buildDuplicatePrefill(result.data),
    });

    await markSalesOrderRead({ accessToken: getAccessToken(), orderId });
  },
});
```

Implementation notes:

- match the web detail hierarchy: summary first, lines second, files third, timeline last
- keep comment input persistent and retry-friendly
- keep duplicate action in the top bar
- do not add edit/void UI in the mini program unless the current web sales route exposes it in practice

- [ ] **Step 4: Run detail tests, full unit suite, and typecheck**

Run: `cd minisales && npm run test:unit -- tests/unit/pages/order-detail-controller.test.ts`
Expected: PASS

Run: `cd minisales && npm run test:unit`
Expected: PASS

Run: `cd minisales && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Manually verify detail flows in WeChat DevTools**

Manual verification:

- opening detail shows current summary, line progress, files, and timeline sections
- detail open marks unread feedback as read
- comment submit works and refreshes the timeline
- duplicate routes into the rebuilt order form with correct prefill

- [ ] **Step 6: Commit**

```bash
git add minisales/tests/unit/pages/order-detail-controller.test.ts minisales/miniprogram/pages/detail/controller.ts minisales/miniprogram/components/sales/order-summary minisales/miniprogram/components/sales/order-lines minisales/miniprogram/components/sales/timeline-card minisales/miniprogram/pages/detail/detail.json minisales/miniprogram/pages/detail/detail.ts minisales/miniprogram/pages/detail/detail.wxml minisales/miniprogram/pages/detail/detail.scss minisales/miniprogram/services/sales/orders.ts
git commit -m "feat: rebuild minisales order detail experience"
```

## Task 7: Rebuild Stats and Spaces, Update Docs, and Run Final Regression

**Files:**
- Create: `minisales/tests/unit/pages/sales-stats-controller.test.ts`
- Create: `minisales/tests/unit/pages/spaces-controller.test.ts`
- Create: `minisales/miniprogram/pages/stats/controller.ts`
- Create: `minisales/miniprogram/pages/spaces/controller.ts`
- Create: `minisales/miniprogram/pages/spaces_detail/controller.ts`
- Create: `minisales/miniprogram/components/sales/stats-metric/index.json`
- Create: `minisales/miniprogram/components/sales/stats-metric/index.ts`
- Create: `minisales/miniprogram/components/sales/stats-metric/index.wxml`
- Create: `minisales/miniprogram/components/sales/stats-metric/index.scss`
- Modify: `minisales/miniprogram/pages/stats/stats.json`
- Modify: `minisales/miniprogram/pages/stats/stats.ts`
- Modify: `minisales/miniprogram/pages/stats/stats.wxml`
- Modify: `minisales/miniprogram/pages/stats/stats.scss`
- Modify: `minisales/miniprogram/pages/spaces/spaces.json`
- Modify: `minisales/miniprogram/pages/spaces/spaces.ts`
- Modify: `minisales/miniprogram/pages/spaces/spaces.wxml`
- Modify: `minisales/miniprogram/pages/spaces/spaces.scss`
- Modify: `minisales/miniprogram/pages/spaces_detail/detail.json`
- Modify: `minisales/miniprogram/pages/spaces_detail/detail.ts`
- Modify: `minisales/miniprogram/pages/spaces_detail/detail.wxml`
- Modify: `minisales/miniprogram/pages/spaces_detail/detail.scss`
- Modify: `minisales/README.md`
- Modify: `docs/developer-guide/minisales.md`

- [ ] **Step 1: Write failing stats/spaces controller tests**

```ts
import { buildStatsViewModel } from '../../../miniprogram/pages/stats/controller';
import { buildSpacesGridModel } from '../../../miniprogram/pages/spaces/controller';

it('builds stable KPI cards and chart labels from monthly trend data', () => {
  const model = buildStatsViewModel({
    totalOrders: 12,
    completedOrders: 4,
    monthOrders: 6,
    monthlyTrend: [
      { date: '2026-04-01', count: 1 },
      { date: '2026-04-02', count: 3 },
    ],
  }, { loginMethod: 'password' });

  expect(model.metrics[0].value).toBe(12);
  expect(model.chartPoints[1].count).toBe(3);
  expect(model.showBindWechatAction).toBe(true);
});

it('maps spaces into deterministic card rows instead of random waterfall ratios', () => {
  const model = buildSpacesGridModel([
    { id: 's-1', name: 'Showroom', template: 'gallery', fileCount: 4, coverUrl: '/file/a.jpg' },
  ]);

  expect(model[0]).toMatchObject({
    id: 's-1',
    title: 'Showroom',
    templateLabel: '画廊',
  });
});
```

- [ ] **Step 2: Run stats/spaces controller tests to confirm the helpers do not exist yet**

Run: `cd minisales && npm run test:unit -- tests/unit/pages/sales-stats-controller.test.ts tests/unit/pages/spaces-controller.test.ts`
Expected: FAIL with missing controller modules

- [ ] **Step 3: Implement stats and spaces controllers and rebuild those pages**

```ts
export function buildStatsViewModel(raw: StatsPayload, { loginMethod }: { loginMethod?: string } = {}) {
  const maxCount = Math.max(...raw.monthlyTrend.map((item) => item.count), 1);
  return {
    metrics: [
      { key: 'totalOrders', label: '累计订单', value: raw.totalOrders },
      { key: 'completedOrders', label: '已完成', value: raw.completedOrders },
      { key: 'monthOrders', label: '近30天', value: raw.monthOrders },
    ],
    showBindWechatAction: loginMethod === 'password',
    chartPoints: raw.monthlyTrend.map((item, index) => ({
      ...item,
      xLabel: index === 0 || index === raw.monthlyTrend.length - 1 ? item.date.slice(5) : '',
      percent: Math.max(10, (item.count / maxCount) * 100),
    })),
  };
}
```

```ts
export function buildSpacesGridModel(spaces: any[]) {
  return spaces.map((space) => ({
    id: space.id,
    title: space.name || '-',
    description: space.description || '',
    templateLabel: TEMPLATE_NAMES[space.template] || space.template,
    coverUrl: getFileUrl(space.coverUrl || space.cover_url || undefined),
    fileCount: Number(space.fileCount || space.file_count || 0),
  }));
}
```

Implementation notes:

- stats page should look like a secondary destination from the shell, not a third main tab
- spaces list should stop using random waterfall ratios and instead use deterministic card layout aligned to the web mobile hierarchy
- spaces detail should keep template-aware content blocks but adopt the new state panel and section spacing
- surface a `绑定微信` secondary action on the stats page when `loginMethod === 'password'`; hide it after a successful bind in the local session state
- update `README.md` and `docs/developer-guide/minisales.md` so they reflect the new page architecture and test commands

- [ ] **Step 4: Run targeted tests, full unit suite, and typecheck**

Run: `cd minisales && npm run test:unit -- tests/unit/pages/sales-stats-controller.test.ts tests/unit/pages/spaces-controller.test.ts`
Expected: PASS

Run: `cd minisales && npm run test:unit`
Expected: PASS

Run: `cd minisales && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Run final manual regression in WeChat DevTools against the current backend**

Manual regression checklist:

- login and session restore
- password login then WeChat bind entry and success path
- order list, search, refresh, pagination
- notification read and detail navigation
- manual create and product-bound create
- detail read, comment, duplicate
- stats load and chart render
- spaces list and space detail preview
- bottom tab navigation and header stats entry

- [ ] **Step 6: Commit**

```bash
git add minisales/tests/unit/pages/sales-stats-controller.test.ts minisales/tests/unit/pages/spaces-controller.test.ts minisales/miniprogram/pages/stats/controller.ts minisales/miniprogram/pages/spaces/controller.ts minisales/miniprogram/pages/spaces_detail/controller.ts minisales/miniprogram/components/sales/stats-metric minisales/miniprogram/pages/stats/stats.json minisales/miniprogram/pages/stats/stats.ts minisales/miniprogram/pages/stats/stats.wxml minisales/miniprogram/pages/stats/stats.scss minisales/miniprogram/pages/spaces/spaces.json minisales/miniprogram/pages/spaces/spaces.ts minisales/miniprogram/pages/spaces/spaces.wxml minisales/miniprogram/pages/spaces/spaces.scss minisales/miniprogram/pages/spaces_detail/detail.json minisales/miniprogram/pages/spaces_detail/detail.ts minisales/miniprogram/pages/spaces_detail/detail.wxml minisales/miniprogram/pages/spaces_detail/detail.scss minisales/README.md docs/developer-guide/minisales.md
git commit -m "feat: align minisales stats spaces and docs"
```

## Final Verification Gate

Before declaring the migration complete, run all of the following:

- `cd minisales && npm run test:unit`
- `cd minisales && npm run typecheck`
- manual regression in 微信开发者工具 with the full checklist from Task 7

If any one of those fails, do not claim the minisales migration is finished.

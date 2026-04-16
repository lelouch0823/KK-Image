# Cache Gap Audit Follow-up Plan (2026-03-02)

## 0. Current Status (Already Landed in Working Tree)

- P0 consistency fixes for:
  - `v1/files`, `v1/folders`, `manage/products`
- P1/P2 cache rollout for:
  - notifications, dashboard, goods-overview, purchase-orders, manage orders list/stats, shares/tags, spaces
- Route test baseline is green:
  - `pnpm vitest run functions/lib/hono/routes` -> passed

---

## 1. Remaining High-Priority Gaps (P0)

### Gap A: Notification cache invalidation is missing on order-driven notification creation

- Problem:
  - `manage/notifications` and `sales/notifications` are cached, but many notifications are created in order routes and `order-utils` paths without invalidating notification caches.
  - This can delay new notifications until TTL expiry.
- Affected routes/files:
  - `functions/lib/hono/routes/manage/orders/create.js`
  - `functions/lib/hono/routes/manage/orders/detail.js`
  - `functions/lib/hono/routes/sales/orders.js`
  - `functions/api/utils/order-utils.js` (notification creation entrypoint)
- Implementation:
  - Add a shared helper to build notification invalidation URL sets for:
    - admin notifications (`/api/manage/notifications...`)
    - specific sales tokens (`/api/sales/:token/notifications...`)
  - After every order mutation that creates notifications, invalidate relevant notification keys in the same execution context.
- Tests:
  - Add route tests verifying order write endpoints trigger notification cache invalidation (admin + targeted sales tokens).

### Gap B: Orders and salespersons caches are not fully cross-invalidated

- Problem:
  - `manage/orders` list response contains salesperson metadata.
  - `manage/salespersons` list contains `orderCount`.
  - Current invalidation does not fully synchronize these two caches.
- Affected routes/files:
  - `functions/lib/hono/routes/manage/salespersons.js`
  - `functions/lib/hono/routes/manage/orders/create.js`
  - `functions/lib/hono/routes/manage/orders/detail.js`
  - `functions/lib/hono/routes/sales/orders.js`
  - `functions/lib/hono/routes/_shared/cache-urls.js`
- Implementation:
  - Add `getManageSalespersonCacheUrls` helper.
  - On salesperson writes: also invalidate manage order list/stats cache.
  - On order writes: also invalidate manage salespersons cache.
- Tests:
  - Extend cache URL helper tests and add route-level invalidation assertions.

---

## 2. Medium-Priority Additions (P1)

### Add edge cache to high-read sales endpoints

- Candidate endpoints:
  - `GET /api/sales/:token/orders` (list only; detail has read side effects)
  - `GET /api/sales/:token/products`
  - `GET /api/sales/:token/products/:id`
  - `GET /api/sales/:token/spaces`
  - `GET /api/sales/:token/spaces/:id`
  - `GET /api/sales/:token/stats`
- Notes:
  - For token-scoped endpoints where cross-token invalidation is hard, keep short TTL (10-20s) and invalidate precise token keys when actor token is known.
  - Avoid caching endpoints that mutate state on read (`order detail` currently marks as read).

---

## 3. Keep Uncached (Intentional)

- Auth/session/self identity endpoints
- Export/download endpoints
- AI chat/stream endpoints
- Audit logs/search (query-heavy, low cache hit value, high variability)

---

## 4. Execution Order

1. P0-A notification invalidation chain completion.
2. P0-B orders/salespersons cross-invalidation completion.
3. P1 sales read-cache rollout with short TTL + token-precise invalidation where possible.

---

## 5. Verification Checklist per Batch

- Run targeted tests introduced by that batch.
- Run full route suite:
  - `pnpm vitest run functions/lib/hono/routes`
- Smoke-check:
  - admin notifications
  - sales notifications
  - manage orders list + salesperson list consistency
  - sales portal product/order/space pages

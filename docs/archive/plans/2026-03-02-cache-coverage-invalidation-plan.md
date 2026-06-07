# Cache Coverage and Invalidation Consistency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make edge cache behavior consistent across high-traffic APIs so UI data refreshes immediately after writes while preserving safe TTL-based performance gains.

**Architecture:** Standardize cache key generation/invalidation URL builders, fix known mismatch bugs first, then roll cache support out module-by-module with short TTL and deterministic invalidation from all write paths (including cross-module writes).

**Tech Stack:** Hono routes, Cloudflare Cache API (`withCache`/`invalidateCache`), Vitest route tests.

---

## Scope Decision

### In Scope

- Existing cached modules with inconsistency bugs:
  - `v1/files`, `v1/folders`, `manage/products`
- High-frequency read APIs currently uncached:
  - notifications, dashboard overview, goods-overview, purchase-orders, orders list/stats
- Shared helper alignment to avoid duplicated cache URL logic.

### Out of Scope (for now)

- Auth/session/user-self endpoints (`/auth`, `/users/me`) due identity sensitivity.
- Export/download endpoints (`/export`) due large payload and one-off usage patterns.
- AI endpoints (`/manage/ai/*`) due low cache ROI and external dependency latency variance.

---

## Task 1: Build Cache Key Policy Baseline

**Files:**

- Modify: `functions/lib/hono/middleware/cache.js`
- Modify: `functions/lib/hono/_shared/route-helpers.js`
- Create: `functions/lib/hono/routes/_shared/cache-keys.js`
- Test: `functions/lib/hono/routes/manage/products/__tests__/cache-keys.test.js`

**Step 1: Write failing tests for URL builder consistency**

- Cover base URL + canonical default query variants (e.g. `page=1&limit=20` / module-specific defaults).
- Cover “detail URL + related parent/list URL” invalidation bundles.

**Step 2: Run tests to confirm failure**

- Run: `pnpm vitest run functions/lib/hono/routes/manage/products/__tests__/cache-keys.test.js`
- Expected: FAIL (helper not implemented).

**Step 3: Implement shared cache key helper**

- Add one shared utility to produce deterministic invalidation URL arrays.
- Remove/avoid duplicated local `get*CacheUrls` drift where possible.

**Step 4: Re-run tests**

- Run same command.
- Expected: PASS.

**Step 5: Commit**

```bash
git add functions/lib/hono/middleware/cache.js functions/lib/hono/_shared/route-helpers.js functions/lib/hono/routes/_shared/cache-keys.js functions/lib/hono/routes/manage/products/__tests__/cache-keys.test.js
git commit -m "refactor: unify cache key builders for route invalidation"
```

---

## Task 2: Fix Existing Consistency Bugs (P0)

**Files:**

- Modify: `functions/lib/hono/routes/v1/files.js`
- Modify: `functions/lib/hono/routes/v1/folders.js`
- Modify: `functions/lib/hono/routes/manage/products/index.js`
- Modify: `functions/lib/hono/routes/manage/products/[id].js`
- Modify: `functions/lib/hono/routes/manage/products/batch.js`
- Test: `functions/lib/hono/routes/v1/__tests__/files-cache-invalidation.test.js`
- Test: `functions/lib/hono/routes/v1/__tests__/folders-cache-invalidation.test.js`
- Test: `functions/lib/hono/routes/manage/products/__tests__/products-cache-invalidation.test.js`

**Step 1: Write failing tests for current known gaps**

- File move/rename must invalidate both old and new folder detail cache.
- Folder move must invalidate both old and new parent folder detail cache.
- Product writes must invalidate `/api/manage/products/variants` cache variants.
- `products/batch` invalidation must include same default list keys as index/detail routes.

**Step 2: Run tests to verify failures**

- Run targeted vitest commands for the three new test files.

**Step 3: Implement minimal fixes**

- `v1/files`: include source folder cache invalidation for move/update/delete flows.
- `v1/folders`: include previous parent cache invalidation during parent change.
- `manage/products`: include `/variants` default key(s) and align `batch.js` with unified key builder.

**Step 4: Re-run tests**

- Ensure all new tests pass.

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/v1/files.js functions/lib/hono/routes/v1/folders.js functions/lib/hono/routes/manage/products/index.js functions/lib/hono/routes/manage/products/[id].js functions/lib/hono/routes/manage/products/batch.js functions/lib/hono/routes/v1/__tests__/files-cache-invalidation.test.js functions/lib/hono/routes/v1/__tests__/folders-cache-invalidation.test.js functions/lib/hono/routes/manage/products/__tests__/products-cache-invalidation.test.js
git commit -m "fix: close cache invalidation gaps for files folders and products"
```

---

## Task 3: Add Cache + Invalidation for Notifications (P1)

**Files:**

- Modify: `functions/lib/hono/routes/manage/notifications.js`
- Modify: `functions/lib/hono/routes/sales/notifications.js`
- Test: `functions/lib/hono/routes/manage/__tests__/notifications-cache.test.js`
- Test: `functions/lib/hono/routes/sales/__tests__/notifications-cache.test.js`

**Step 1: Write failing tests**

- GET list endpoint returns cached responses.
- POST create/read invalidates corresponding cache keys (`admin` and token-scoped `sales`).

**Step 2: Run tests (expect fail)**

**Step 3: Implement**

- Add short TTL cache (10–20s) to notifications list endpoints.
- Add invalidation for both single read and mark-all read.

**Step 4: Run tests (expect pass)**

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/notifications.js functions/lib/hono/routes/sales/notifications.js functions/lib/hono/routes/manage/__tests__/notifications-cache.test.js functions/lib/hono/routes/sales/__tests__/notifications-cache.test.js
git commit -m "feat: add notifications edge cache with deterministic invalidation"
```

---

## Task 4: Add Cache for Dashboard + Goods Overview + Purchase Orders Read APIs (P1)

**Files:**

- Modify: `functions/lib/hono/routes/manage/dashboard.js`
- Modify: `functions/lib/hono/routes/manage/goods-overview.js`
- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Modify: `functions/lib/hono/routes/manage/orders/create.js`
- Modify: `functions/lib/hono/routes/manage/orders/detail.js`
- Modify: `functions/lib/hono/routes/sales/orders.js`
- Test: `functions/lib/hono/routes/manage/__tests__/dashboard-goods-po-cache.test.js`

**Step 1: Write failing tests**

- Read endpoints cache correctly.
- Relevant order/PO writes invalidate related summary/list cache keys.

**Step 2: Run tests (expect fail)**

**Step 3: Implement**

- Add withCache:
  - dashboard overview (TTL ~20s)
  - goods-overview list+summary (TTL ~20s)
  - purchase-orders list/stats/suggestions/detail (TTL ~20–30s)
- Add invalidation on write paths in purchase-orders and order mutation routes.

**Step 4: Run tests (expect pass)**

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/dashboard.js functions/lib/hono/routes/manage/goods-overview.js functions/lib/hono/routes/manage/purchase-orders.js functions/lib/hono/routes/manage/orders/create.js functions/lib/hono/routes/manage/orders/detail.js functions/lib/hono/routes/sales/orders.js functions/lib/hono/routes/manage/__tests__/dashboard-goods-po-cache.test.js
git commit -m "feat: add cache and invalidation for dashboard goods-overview and purchase-orders"
```

---

## Task 5: Add Cache for Manage Orders List/Stats (P2)

**Files:**

- Modify: `functions/lib/hono/routes/manage/orders/list.js`
- Modify: `functions/lib/hono/routes/manage/orders/create.js`
- Modify: `functions/lib/hono/routes/manage/orders/detail.js`
- Modify: `functions/lib/hono/routes/sales/orders.js`
- Test: `functions/lib/hono/routes/manage/orders/__tests__/orders-cache-invalidation.test.js`

**Step 1: Write failing tests**

- Cached list/stats responses.
- Invalidation triggered by all order state mutations from both manage and sales routes.

**Step 2: Run tests (expect fail)**

**Step 3: Implement**

- Add withCache to order list/stats endpoints.
- Centralize invalidation helper for order list/stats query defaults.

**Step 4: Run tests (expect pass)**

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/orders/list.js functions/lib/hono/routes/manage/orders/create.js functions/lib/hono/routes/manage/orders/detail.js functions/lib/hono/routes/sales/orders.js functions/lib/hono/routes/manage/orders/__tests__/orders-cache-invalidation.test.js
git commit -m "feat: cache manage orders reads with cross-route invalidation"
```

---

## Task 6: Optional P2 Extensions (Spaces/Shares/Tags)

**Files:**

- Modify: `functions/lib/hono/routes/manage/spaces/crud.js`
- Modify: `functions/lib/hono/routes/manage/spaces/subspaces.js`
- Modify: `functions/lib/hono/routes/manage/spaces/files.js`
- Modify: `functions/lib/hono/routes/sales/spaces.js`
- Modify: `functions/lib/hono/routes/manage/shares.js`
- Modify: `functions/lib/hono/routes/manage/tags.js`
- Test: `functions/lib/hono/routes/manage/__tests__/spaces-shares-tags-cache.test.js`

**Step 1: Write failing tests**

- Verify read cache and write invalidation coverage.

**Step 2: Run tests (expect fail)**

**Step 3: Implement minimal cache policy**

- TTL 20–30s for list/detail reads.
- Invalidate on create/update/delete/association changes.

**Step 4: Run tests (expect pass)**

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/spaces/crud.js functions/lib/hono/routes/manage/spaces/subspaces.js functions/lib/hono/routes/manage/spaces/files.js functions/lib/hono/routes/sales/spaces.js functions/lib/hono/routes/manage/shares.js functions/lib/hono/routes/manage/tags.js functions/lib/hono/routes/manage/__tests__/spaces-shares-tags-cache.test.js
git commit -m "feat: extend cache coverage for spaces shares and tags"
```

---

## Verification Checklist (before each merge)

- Run targeted tests added in the corresponding task.
- Run full backend route tests:
  - `pnpm vitest run functions/lib/hono/routes`
- Smoke check key pages:
  - Dashboard
  - File Manager
  - Product list + variant picker
  - Orders list + detail
  - Purchase order list + suggestions
  - Notifications (admin + sales)

---

## Risk Controls

- Keep TTL short initially (10–30s) for new modules.
- Prefer explicit invalidation to broad wildcard deletion.
- Do not cache identity-sensitive endpoints (`/me`, auth checks).
- Roll out by feature flag or by module sequence (P0 -> P1 -> P2).

---

## Delivery Order Recommendation

1. Task 2 (P0 fixes) first: closes active consistency bugs.
2. Task 3 + Task 4 (P1): highest read-pressure modules.
3. Task 5 + Task 6 (P2): broader optimization after stability.

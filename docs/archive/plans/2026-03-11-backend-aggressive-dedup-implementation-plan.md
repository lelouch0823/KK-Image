# Backend Aggressive Dedup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aggressively unify backend pagination, JSON decoding, list cache invalidation, and repeated repository/query helpers without changing public API paths or response fields.

**Architecture:** Introduce a single backend shared contract for list-style endpoints that standardizes pagination parsing, query normalization, cache key generation, and cache invalidation. Then migrate repositories and routes onto that contract, remove duplicate JSON/pagination helpers, and extract repeated SQL fragments into composable repository internals.

**Tech Stack:** Cloudflare Pages Functions, Hono, D1, Vitest, Mocha, ES modules

---

### Task 1: Inventory the list endpoints and cache invalidation surface

**Files:**

- Modify: `docs/plans/2026-03-11-backend-aggressive-dedup-implementation-plan.md`
- Review: `functions/lib/hono/routes/manage/files.js`
- Review: `functions/lib/hono/routes/manage/customers.js`
- Review: `functions/lib/hono/routes/manage/salespersons.js`
- Review: `functions/lib/hono/routes/manage/orders/list.js`
- Review: `functions/lib/hono/routes/manage/products/index.js`
- Review: `functions/lib/hono/routes/sales/orders.js`
- Review: `functions/lib/hono/routes/sales/products.js`
- Review: `functions/lib/hono/_shared/route-helpers.js`

**Step 1: Document the target list routes**

Write down, in the plan file notes for this task, each list endpoint that currently depends on pagination and/or cache invalidation.

Expected inventory:

```text
/api/manage/files
/api/manage/customers
/api/manage/salespersons
/api/manage/orders
/api/manage/products
/api/sales/orders
/api/sales/products
```

**Step 2: Record the query parameters that materially affect each list**

Capture the exact query keys each route uses today, including `page`, `limit`, and business filters such as `search`, `status`, `category`, `brand`, `parentId`.

**Step 3: Record the current invalidation strategy per route**

For each route, note whether invalidation is:

- no invalidation
- base URL only
- base URL plus manually enumerated variants
- token-aware invalidation

**Step 4: Commit**

```bash
git add docs/plans/2026-03-11-backend-aggressive-dedup-implementation-plan.md
git commit -m "docs: inventory backend list routes for dedup plan"
```

### Task 2: Add shared list query normalization and cache URL builders

**Files:**

- Modify: `functions/api/utils/pagination.js`
- Modify: `functions/lib/hono/_shared/route-helpers.js`
- Create: `functions/lib/hono/_shared/__tests__/route-helpers.list-cache.test.js`
- Test: `functions/api/utils/__tests__/pagination.test.js`

**Step 1: Write the failing tests for normalized list query handling**

Add tests covering:

- default `page` and `limit` injection
- max-limit clamping
- empty query values removed from cache key input
- stable key ordering
- default-first-page URL generation

Example assertions:

```javascript
expect(
  normalizeListQuery(
    { page: '0', limit: '999', search: '' },
    {
      page: 1,
      limit: 20,
      maxLimit: 100,
      allowedKeys: ['page', 'limit', 'search'],
    }
  )
).toEqual({ page: '1', limit: '100' });

expect(
  buildListCacheUrls('https://x.test', '/api/manage/customers', {
    allowedKeys: ['page', 'limit', 'search'],
    defaults: { page: 1, limit: 20 },
    query: { search: 'abc' },
  })
).toContain('https://x.test/api/manage/customers?limit=20&page=1&search=abc');
```

**Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run functions/api/utils/__tests__/pagination.test.js functions/lib/hono/_shared/__tests__/route-helpers.list-cache.test.js
```

Expected: FAIL because the new normalization and cache URL helpers do not exist yet.

**Step 3: Implement the shared helpers**

Add minimal shared helpers with exact responsibilities:

- `parseRepoPagination(input, options)` remains the canonical numeric parser
- `normalizeListQuery(query, config)` returns a stable string-value object suitable for cache keys
- `buildListCacheUrls(origin, basePath, config)` returns normalized invalidation targets
- `createListCacheInvalidator(basePath, config)` returns a route helper for Hono routes

Implementation constraints:

- no route-specific logic inside the shared helper
- remove empty string, `undefined`, and `null`
- sort query keys
- always include normalized `page` and `limit`

**Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run functions/api/utils/__tests__/pagination.test.js functions/lib/hono/_shared/__tests__/route-helpers.list-cache.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add functions/api/utils/pagination.js functions/lib/hono/_shared/route-helpers.js functions/lib/hono/_shared/__tests__/route-helpers.list-cache.test.js functions/api/utils/__tests__/pagination.test.js
git commit -m "refactor: add shared list query normalization helpers"
```

### Task 3: Add shared JSON/result/SQL update helpers for backend convergence

**Files:**

- Modify: `functions/api/utils/json.js`
- Modify: `functions/api/utils/sql.js`
- Create: `functions/api/utils/result.js`
- Create: `functions/api/utils/__tests__/result.test.js`
- Modify: `functions/api/utils/__tests__/json.test.js`
- Create: `functions/api/utils/__tests__/sql.test.js`
- Modify: `functions/_shared/utils.js`

**Step 1: Write the failing tests**

Add tests for:

- `parseJsonArray` and `parseJsonObject` on strings, objects, invalid JSON
- `hasChanges(result)` for missing metadata and positive changes
- `buildSetClause({ a: 1, b: 2 })` producing deterministic SQL and values

Example expectations:

```javascript
expect(hasChanges({ meta: { changes: 1 } })).toBe(true);
expect(hasChanges({})).toBe(false);
expect(buildSetClause({ name: 'x', updated_at: 1 })).toEqual({
  clause: 'name = ?, updated_at = ?',
  values: ['x', 1],
});
```

**Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run functions/api/utils/__tests__/json.test.js functions/api/utils/__tests__/sql.test.js functions/api/utils/__tests__/result.test.js
```

Expected: FAIL because `hasChanges` and deterministic set-clause helpers do not exist yet.

**Step 3: Implement the helpers**

Add:

- `hasChanges(result)` and optionally `getChangesCount(result)`
- deterministic `buildSetClause(record)`
- export them through `functions/_shared/utils.js`

Keep the helpers small and side-effect free.

**Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run functions/api/utils/__tests__/json.test.js functions/api/utils/__tests__/sql.test.js functions/api/utils/__tests__/result.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add functions/api/utils/json.js functions/api/utils/sql.js functions/api/utils/result.js functions/api/utils/__tests__/json.test.js functions/api/utils/__tests__/sql.test.js functions/api/utils/__tests__/result.test.js functions/_shared/utils.js
git commit -m "refactor: add shared backend utility primitives"
```

### Task 4: Migrate repository pagination to the shared rule

**Files:**

- Modify: `functions/repositories/FileRepository.js`
- Modify: `functions/repositories/CustomerRepository.js`
- Modify: `functions/repositories/SalespersonRepository.js`
- Modify: `functions/repositories/FolderRepository.js`
- Modify: `functions/repositories/ProductRepository.js`
- Modify: `functions/repositories/PurchaseOrderRepository.js`
- Modify: `functions/repositories/order/queries.js`
- Modify: `functions/repositories/ProductVariantRepository.js`
- Test: `functions/api/utils/__tests__/pagination.test.js`

**Step 1: Write focused repository regression tests before migration**

Add or extend tests near existing repository coverage to lock in:

- page lower bound becomes `1`
- limit clamps to route-specific or repository-specific max
- offsets remain correct
- special cases such as product search with optional unlimited behavior are explicitly decided

If unlimited behavior must survive, encode it in the shared helper config rather than keeping ad-hoc code.

**Step 2: Run targeted tests to verify the baseline**

Run:

```bash
npx vitest run functions/repositories/__tests__ functions/api/utils/__tests__/pagination.test.js
```

Expected: PASS before migration, establishing baseline behavior.

**Step 3: Replace local pagination math with shared parsing**

In each repository:

- import `parseRepoPagination`
- preserve per-call defaults and max limits via options
- use returned `page`, `limit`, `offset`
- remove duplicated local `safePage/safeLimit` code

Special handling:

- `ProductRepository.search` currently supports `limit = 0` semantics for unlimited mode. Decide one of:
  - remove unlimited mode and update callers
  - add explicit `allowUnlimited` support to the shared helper

Do not leave one-off pagination code behind.

**Step 4: Run targeted tests to verify migration**

Run:

```bash
npx vitest run functions/repositories/__tests__ functions/api/utils/__tests__/pagination.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add functions/repositories/FileRepository.js functions/repositories/CustomerRepository.js functions/repositories/SalespersonRepository.js functions/repositories/FolderRepository.js functions/repositories/ProductRepository.js functions/repositories/PurchaseOrderRepository.js functions/repositories/order/queries.js functions/repositories/ProductVariantRepository.js
git commit -m "refactor: unify repository pagination rules"
```

### Task 5: Migrate route list endpoints to shared normalized cache invalidation

**Files:**

- Modify: `functions/lib/hono/routes/manage/files.js`
- Modify: `functions/lib/hono/routes/manage/customers.js`
- Modify: `functions/lib/hono/routes/manage/salespersons.js`
- Modify: `functions/lib/hono/routes/manage/orders/list.js`
- Modify: `functions/lib/hono/routes/manage/products/index.js`
- Modify: `functions/lib/hono/routes/sales/orders.js`
- Modify: `functions/lib/hono/routes/sales/products.js`
- Modify: `functions/lib/hono/_shared/route-helpers.js`
- Test: `functions/lib/hono/routes/manage/__tests__/cache-urls.test.js`
- Test: `functions/lib/hono/routes/sales/__tests__/orders-cache-helpers.test.js`
- Test: `functions/lib/hono/routes/manage/__tests__/order-list-routes.test.js`

**Step 1: Write or extend failing tests for cache invalidation coverage**

Add tests proving that list invalidation covers:

- base URL
- normalized default page
- normalized default limit
- active search/filter query variants
- token-scoped sales URLs where applicable

Example expectation:

```javascript
expect(urls).toContain('https://example.com/api/manage/products?limit=20&page=1');
expect(urls).toContain('https://example.com/api/manage/products?brand=ACME&limit=20&page=1');
```

**Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run functions/lib/hono/routes/manage/__tests__/cache-urls.test.js functions/lib/hono/routes/sales/__tests__/orders-cache-helpers.test.js functions/lib/hono/routes/manage/__tests__/order-list-routes.test.js
```

Expected: FAIL because current routes still use route-local invalidation patterns.

**Step 3: Migrate routes to the shared list invalidation helper**

For each list route:

- declare the exact `allowedKeys`
- declare default pagination values
- route all invalidation through `createListCacheInvalidator` or equivalent helper
- remove manual query-string concatenation

Do not overfit with exhaustive page enumeration. Normalize to default page invalidation plus current meaningful filter combinations.

**Step 4: Run tests to verify migration**

Run:

```bash
npx vitest run functions/lib/hono/routes/manage/__tests__/cache-urls.test.js functions/lib/hono/routes/sales/__tests__/orders-cache-helpers.test.js functions/lib/hono/routes/manage/__tests__/order-list-routes.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/files.js functions/lib/hono/routes/manage/customers.js functions/lib/hono/routes/manage/salespersons.js functions/lib/hono/routes/manage/orders/list.js functions/lib/hono/routes/manage/products/index.js functions/lib/hono/routes/sales/orders.js functions/lib/hono/routes/sales/products.js functions/lib/hono/_shared/route-helpers.js functions/lib/hono/routes/manage/__tests__/cache-urls.test.js functions/lib/hono/routes/sales/__tests__/orders-cache-helpers.test.js functions/lib/hono/routes/manage/__tests__/order-list-routes.test.js
git commit -m "refactor: unify list cache invalidation across routes"
```

### Task 6: Remove duplicate JSON parsing from repositories, services, and routes

**Files:**

- Modify: `functions/repositories/PurchaseOrderRepository.js`
- Modify: `functions/services/PurchaseOrderService.js`
- Modify: `functions/repositories/ProductRepository.js`
- Modify: `functions/repositories/ProductVariantRepository.js`
- Modify: `functions/lib/hono/routes/manage/products/index.js`
- Modify: `functions/lib/hono/routes/sales/products.js`
- Modify: `functions/ai/action-orchestrator.js`
- Modify: `functions/repositories/order/helpers.js`
- Test: `functions/api/utils/__tests__/json.test.js`
- Test: `functions/ai/__tests__/action-orchestrator.test.js`
- Test: `functions/services/__tests__/PurchaseOrderService.procurement-status.test.js`

**Step 1: Write or extend failing tests for shared JSON fallback semantics**

Cover:

- array fields remain arrays
- object fields remain objects
- invalid JSON falls back deterministically
- no route keeps a private parser with different semantics

**Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run functions/api/utils/__tests__/json.test.js functions/ai/__tests__/action-orchestrator.test.js functions/services/__tests__/PurchaseOrderService.procurement-status.test.js
```

Expected: FAIL if the code is switched to imports before implementation or if new expected semantics are not yet applied.

**Step 3: Replace local parsers with shared imports**

Rules:

- use `parseJsonArray` for array-like fields
- use `parseJsonObject` for object-like fields
- use `safeJsonParse` only when either array or object is acceptable
- delete `_parseJson` or `parseJsonSafe` once callers are migrated

Also simplify `functions/repositories/order/helpers.js` to align with the shared parser.

**Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run functions/api/utils/__tests__/json.test.js functions/ai/__tests__/action-orchestrator.test.js functions/services/__tests__/PurchaseOrderService.procurement-status.test.js functions/repositories/__tests__ functions/utils/__tests__
```

Expected: PASS

**Step 5: Commit**

```bash
git add functions/repositories/PurchaseOrderRepository.js functions/services/PurchaseOrderService.js functions/repositories/ProductRepository.js functions/repositories/ProductVariantRepository.js functions/lib/hono/routes/manage/products/index.js functions/lib/hono/routes/sales/products.js functions/ai/action-orchestrator.js functions/repositories/order/helpers.js
git commit -m "refactor: remove duplicate backend json parsers"
```

### Task 7: Extract repeated SQL and stale wrappers from repositories

**Files:**

- Modify: `functions/repositories/SpaceRepository.js`
- Modify: `functions/repositories/OrderRepository.js`
- Test: `functions/repositories/__tests__/SpaceRepository.test.js`
- Test: `functions/repositories/__tests__/order-helpers.procurement-status.test.js`

**Step 1: Write the failing tests around repeated SQL consumers**

Add or extend tests that prove all affected `SpaceRepository` methods return the same projected fields for:

- `variant_primary_image_id`
- `display_image_id`
- `p_*` product projection fields

**Step 2: Run tests to verify baseline**

Run:

```bash
npx vitest run functions/repositories/__tests__/SpaceRepository.test.js functions/repositories/__tests__/order-helpers.procurement-status.test.js
```

Expected: PASS before refactor.

**Step 3: Extract composable SQL fragments**

In `SpaceRepository`:

- introduce private helpers for repeated product projection
- introduce private helpers for repeated variant image projection
- compose methods from the helpers without changing selected aliases

In `OrderRepository`:

- remove `_parseJson`, `_mapOrderListItem`, `_mapOrderDetail` if unused
- retain only direct facade methods that are still called

**Step 4: Run tests to verify refactor**

Run:

```bash
npx vitest run functions/repositories/__tests__/SpaceRepository.test.js functions/repositories/__tests__/order-helpers.procurement-status.test.js functions/repositories/__tests__
```

Expected: PASS

**Step 5: Commit**

```bash
git add functions/repositories/SpaceRepository.js functions/repositories/OrderRepository.js functions/repositories/__tests__/SpaceRepository.test.js functions/repositories/__tests__/order-helpers.procurement-status.test.js
git commit -m "refactor: extract repeated repository sql fragments"
```

### Task 8: Verify end-to-end list behavior and cache safety

**Files:**

- Test: `functions/lib/hono/routes/manage/__tests__/core-authz-gates.test.js`
- Test: `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
- Test: `functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js`
- Test: `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
- Test: `functions/lib/hono/middleware/__tests__/auth-public-routes.test.js`

**Step 1: Run the focused route test matrix**

Run:

```bash
npx vitest run functions/lib/hono/routes/manage/__tests__/core-authz-gates.test.js functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js functions/lib/hono/middleware/__tests__/auth-public-routes.test.js
```

Expected: PASS

**Step 2: Run repository and service regression suites**

Run:

```bash
npx vitest run functions/repositories/__tests__ functions/services/__tests__ functions/ai/__tests__
```

Expected: PASS

**Step 3: Run lint for touched backend code**

Run:

```bash
npx eslint functions
```

Expected: PASS

**Step 4: Run broader unit suite if time permits**

Run:

```bash
npx vitest run
```

Expected: PASS or a documented list of unrelated failures.

**Step 5: Commit**

```bash
git add functions docs/plans/2026-03-11-backend-aggressive-dedup-implementation-plan.md
git commit -m "refactor: complete aggressive backend dedup convergence"
```

### Task 9: Final review and handoff

**Files:**

- Review: `docs/plans/2026-03-11-backend-aggressive-dedup-implementation-plan.md`
- Review: `docs/reviews/backend-code-duplication-review.md`

**Step 1: Summarize net reductions**

Record:

- deleted duplicate helper count
- migrated repository count
- migrated route count
- extracted SQL fragment count

**Step 2: Capture residual risk**

Document any intentional non-unifications left in place, especially if a list endpoint has unusual cache semantics.

**Step 3: Request code review**

Use the repository’s review workflow after verification succeeds.

**Step 4: Commit docs if updated**

```bash
git add docs
git commit -m "docs: record backend dedup outcomes"
```

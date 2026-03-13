# Order Faceted Metadata Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade Order Management so all list filters use server-driven faceted metadata, keeping option lists accurate under filtering, search, and pagination.

**Architecture:** Refactor the admin order list query path to build one shared filter clause for rows, counts, and facet queries. Return `filters` from `GET /api/manage/orders`, then update `useOrders()` to expose and refresh faceted metadata on every list load instead of caching static arrays only once.

**Tech Stack:** Vue 3, Vitest, Hono routes, D1 repository helpers, shared `useResource()`-style state patterns.

---

### Task 1: Define Failing Contracts For Order Faceted Metadata

**Files:**
- Create: `O:/Code/KK-Image/functions/repositories/order/__tests__/admin-facets.test.js`
- Modify: `O:/Code/KK-Image/src/components/__tests__/OrderManager.network-workflow.test.js`

**Step 1: Write the failing backend facet test for salespersons**

```js
it('returns salesperson facet options while ignoring the current salesperson filter', async () => {
  const result = await listOrderFacets(db, {
    salespersonId: 'sp-1',
    status: 'pending',
    procurementStatus: 'ordered',
    search: 'SO-2026',
  });

  expect(result.salespersons).toEqual([
    { id: 'sp-1', name: 'Alice', store: 'A' },
    { id: 'sp-2', name: 'Bob', store: 'B' },
  ]);
});
```

**Step 2: Write the failing backend facet test for statuses and procurement statuses**

```js
it('returns status and procurement facets while ignoring their own active dimension', async () => {
  const result = await listOrderFacets(db, {
    salespersonId: 'sp-1',
    status: 'pending',
    procurementStatus: 'ordered',
  });

  expect(result.statuses).toContain('pending');
  expect(result.procurementStatuses).toContain('ordered');
});
```

**Step 3: Write the failing frontend contract test**

```js
it('updates order filter metadata on every successful list load', async () => {
  mockAuthFetch.mockResolvedValueOnce({
    json: async () => ({
      success: true,
      data: {
        orders: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        filters: {
          salespersons: [{ id: 'sp-1', name: 'Alice', store: 'A' }],
          statuses: ['pending', 'confirmed'],
          procurementStatuses: ['ordered', 'arrived'],
          searchSuggestions: ['SO-2026-001'],
        },
      },
    }),
  });

  await loadOrders({ page: 1 });

  expect(salespersons.value).toEqual([{ id: 'sp-1', name: 'Alice', store: 'A' }]);
  expect(statuses.value).toEqual(['pending', 'confirmed']);
  expect(procurementStatuses.value).toEqual(['ordered', 'arrived']);
});
```

**Step 4: Run the tests to verify they fail**

Run: `pnpm test:unit functions/repositories/order/__tests__/admin-facets.test.js`
Expected: FAIL because the facet helper does not exist yet.

Run: `pnpm test:unit src/components/__tests__/OrderManager.network-workflow.test.js`
Expected: FAIL because `useOrders()` still assumes static side metadata.

**Step 5: Commit**

```bash
git add functions/repositories/order/__tests__/admin-facets.test.js src/components/__tests__/OrderManager.network-workflow.test.js
git commit -m "test: define order faceted metadata contracts"
```

### Task 2: Extract Shared Admin Order Filter-Clause Builders

**Files:**
- Modify: `O:/Code/KK-Image/functions/repositories/order/queries.js`
- Test: `O:/Code/KK-Image/functions/repositories/order/__tests__/admin-facets.test.js`

**Step 1: Add a failing helper-level test for self-dimension omission**

```js
it('omits the requested dimension from the generated WHERE clause', () => {
  const { clause, params } = buildAdminOrderFilterClause(
    {
      salespersonId: 'sp-1',
      status: 'pending',
      procurementStatus: 'ordered',
      search: 'SO-2026',
    },
    { omit: ['salespersonId'] }
  );

  expect(clause).not.toContain('o.salesperson_id = ?');
  expect(clause).toContain('o.status = ?');
  expect(clause).toContain("COALESCE(o.procurement_status, 'none') = ?");
  expect(params).not.toContain('sp-1');
});
```

**Step 2: Run the backend facet test to verify it fails**

Run: `pnpm test:unit functions/repositories/order/__tests__/admin-facets.test.js`
Expected: FAIL because the shared builder is missing.

**Step 3: Implement shared helpers in `queries.js`**

```js
export function buildAdminOrderFilterClause(
  { salespersonId, customerId, status, procurementStatus, search, startTime, endTime } = {},
  { omit = [] } = {}
) {
  let whereClause = '1=1';
  const bindParams = [];

  if (salespersonId && !omit.includes('salespersonId')) {
    whereClause += ' AND o.salesperson_id = ?';
    bindParams.push(salespersonId);
  }

  if (customerId && !omit.includes('customerId')) {
    whereClause += ' AND o.customer_id = ?';
    bindParams.push(customerId);
  }

  if (status && !omit.includes('status')) {
    whereClause += ' AND o.status = ?';
    bindParams.push(status);
  }

  if (procurementStatus && !omit.includes('procurementStatus')) {
    whereClause += " AND COALESCE(o.procurement_status, 'none') = ?";
    bindParams.push(procurementStatus);
  }

  if (startTime > 0 && !omit.includes('startTime')) {
    whereClause += ' AND o.created_at >= ?';
    bindParams.push(startTime);
  }

  if (endTime > 0 && !omit.includes('endTime')) {
    whereClause += ' AND o.created_at <= ?';
    bindParams.push(endTime);
  }

  if (search && !omit.includes('search')) {
    whereClause += ' AND (o.order_no LIKE ? OR o.current_data LIKE ?)';
    const searchPattern = `%${search}%`;
    bindParams.push(searchPattern, searchPattern);
  }

  return { clause: whereClause, params: bindParams };
}
```

Refactor `listForAdmin()` to use this helper rather than inline condition building.

**Step 4: Run the backend facet test to verify it passes**

Run: `pnpm test:unit functions/repositories/order/__tests__/admin-facets.test.js`
Expected: partial PASS, with remaining failures only for missing facet query functions.

**Step 5: Commit**

```bash
git add functions/repositories/order/queries.js functions/repositories/order/__tests__/admin-facets.test.js
git commit -m "refactor: share admin order filter clause builder"
```

### Task 3: Add Repository-Level Order Facet Queries

**Files:**
- Modify: `O:/Code/KK-Image/functions/repositories/order/queries.js`
- Test: `O:/Code/KK-Image/functions/repositories/order/__tests__/admin-facets.test.js`

**Step 1: Add a failing test for search suggestions**

```js
it('returns search suggestions while ignoring the current search term', async () => {
  const result = await listOrderFacets(db, {
    salespersonId: 'sp-1',
    status: 'pending',
    search: 'SO-2026',
  });

  expect(result.searchSuggestions).toEqual([
    'SO-2026-001',
    'Alice',
    '张三',
  ]);
});
```

**Step 2: Run the backend facet test to verify it fails**

Run: `pnpm test:unit functions/repositories/order/__tests__/admin-facets.test.js`
Expected: FAIL because `listOrderFacets()` and search suggestion SQL do not exist yet.

**Step 3: Implement minimal facet query functions**

```js
export async function listAvailableSalespersons(db, filters = {}) {
  const { clause, params } = buildAdminOrderFilterClause(filters, { omit: ['salespersonId'] });
  const sql = `
    SELECT DISTINCT s.id, s.name, s.store
    FROM orders o
    JOIN salespersons s ON o.salesperson_id = s.id
    WHERE ${clause}
      AND s.is_active = 1
    ORDER BY s.name
  `;
  const { results } = await db.prepare(sql).bind(...params).all();
  return results.map((row) => ({ id: row.id, name: row.name, store: row.store }));
}
```

```js
export async function listAvailableStatuses(db, filters = {}) {
  const { clause, params } = buildAdminOrderFilterClause(filters, { omit: ['status'] });
  const sql = `SELECT DISTINCT o.status FROM orders o WHERE ${clause} ORDER BY o.status`;
  const { results } = await db.prepare(sql).bind(...params).all();
  return results.map((row) => row.status).filter(Boolean);
}
```

```js
export async function listAvailableProcurementStatuses(db, filters = {}) {
  const { clause, params } = buildAdminOrderFilterClause(filters, { omit: ['procurementStatus'] });
  const sql = `
    SELECT DISTINCT COALESCE(o.procurement_status, 'none') AS procurement_status
    FROM orders o
    WHERE ${clause}
    ORDER BY procurement_status
  `;
  const { results } = await db.prepare(sql).bind(...params).all();
  return results.map((row) => row.procurement_status).filter(Boolean);
}
```

```js
export async function listSearchSuggestions(db, filters = {}) {
  const { clause, params } = buildAdminOrderFilterClause(filters, { omit: ['search'] });
  const sql = `
    SELECT DISTINCT o.order_no, s.name AS salesperson_name, json_extract(o.current_data, '$.name') AS customer_name, o.created_at
    FROM orders o
    LEFT JOIN salespersons s ON o.salesperson_id = s.id
    WHERE ${clause}
    ORDER BY o.created_at DESC
    LIMIT 20
  `;
  const { results } = await db.prepare(sql).bind(...params).all();
  return [...new Set(results.flatMap((row) => [row.order_no, row.salesperson_name, row.customer_name]).filter(Boolean))].slice(0, 20);
}
```

Add orchestration helper:

```js
export async function listOrderFacets(db, filters = {}) {
  const [salespersons, statuses, procurementStatuses, searchSuggestions] = await Promise.all([
    listAvailableSalespersons(db, filters),
    listAvailableStatuses(db, filters),
    listAvailableProcurementStatuses(db, filters),
    listSearchSuggestions(db, filters),
  ]);

  return { salespersons, statuses, procurementStatuses, searchSuggestions };
}
```

**Step 4: Run the backend facet test to verify it passes**

Run: `pnpm test:unit functions/repositories/order/__tests__/admin-facets.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/repositories/order/queries.js functions/repositories/order/__tests__/admin-facets.test.js
git commit -m "feat: add faceted order metadata queries"
```

### Task 4: Return Faceted Metadata From The Orders List Route

**Files:**
- Modify: `O:/Code/KK-Image/functions/lib/hono/routes/manage/orders/list.js`
- Test: `O:/Code/KK-Image/functions/repositories/order/__tests__/admin-facets.test.js`

**Step 1: Add a failing assertion for route response shape if a nearby route test exists**

```js
expect(json.data.filters).toEqual({
  salespersons: [{ id: 'sp-1', name: 'Alice', store: 'A' }],
  statuses: ['pending', 'confirmed'],
  procurementStatuses: ['ordered', 'arrived'],
  searchSuggestions: ['SO-2026-001'],
});
```

If there is no practical route test nearby, keep repository coverage and move straight to route implementation.

**Step 2: Run the relevant test to verify it fails**

Run: `pnpm test:unit functions/repositories/order/__tests__/admin-facets.test.js`
Expected: if route assertion exists, FAIL until route includes `data.filters`.

**Step 3: Implement route passthrough**

```js
const [result, filters] = await Promise.all([
  orderRepo.listForAdmin({ ...queryFilters }),
  listOrderFacets(env.DB, { ...queryFilters }),
]);

return c.json({
  success: true,
  data: {
    orders: result.items,
    filters,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  },
});
```

**Step 4: Run the relevant test to verify it passes**

Run: `pnpm test:unit functions/repositories/order/__tests__/admin-facets.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/orders/list.js
git commit -m "feat: return faceted order metadata from list route"
```

### Task 5: Expose Dynamic Available Filters In `useOrders()`

**Files:**
- Modify: `O:/Code/KK-Image/src/composables/useOrders.js`
- Test: `O:/Code/KK-Image/src/components/__tests__/OrderManager.network-workflow.test.js`

**Step 1: Extend the failing frontend test to check refresh behavior**

```js
expect(salespersons.value).toEqual([{ id: 'sp-1', name: 'Alice', store: 'A' }]);
expect(statuses.value).toEqual(['pending', 'confirmed']);
expect(procurementStatuses.value).toEqual(['ordered', 'arrived']);
expect(searchSuggestions.value).toEqual(['SO-2026-001']);
```

**Step 2: Run the frontend test to verify it fails**

Run: `pnpm test:unit src/components/__tests__/OrderManager.network-workflow.test.js`
Expected: FAIL because metadata is still initialized only once and there is no `searchSuggestions`.

**Step 3: Implement minimal metadata refresh logic**

```js
const availableFilters = ref({
  salespersons: [],
  statuses: [],
  procurementStatuses: [],
  searchSuggestions: [],
});
```

In `loadOrders()`:

```js
availableFilters.value = res.data.filters || {
  salespersons: [],
  statuses: [],
  procurementStatuses: [],
  searchSuggestions: [],
};

salespersons.value = availableFilters.value.salespersons;
statuses.value = availableFilters.value.statuses;
procurementStatuses.value = availableFilters.value.procurementStatuses;
searchSuggestions.value = availableFilters.value.searchSuggestions;
```

Return:

```js
availableFilters,
searchSuggestions,
```

**Step 4: Run the frontend test to verify it passes**

Run: `pnpm test:unit src/components/__tests__/OrderManager.network-workflow.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/composables/useOrders.js src/components/__tests__/OrderManager.network-workflow.test.js
git commit -m "feat: refresh order faceted metadata on each list load"
```

### Task 6: Consume Faceted Metadata In OrderManager And OrderFilters

**Files:**
- Modify: `O:/Code/KK-Image/src/components/OrderManager.vue`
- Modify: `O:/Code/KK-Image/src/components/order/OrderFilters.vue`
- Test: `O:/Code/KK-Image/src/components/__tests__/OrderManager.network-workflow.test.js`
- Test: `O:/Code/KK-Image/src/components/order/__tests__/OrderFilters.desktop-layout.test.js`

**Step 1: Add a failing assertion that the order page uses the new metadata source**

```js
expect(wrapper.vm.salespersons).toEqual([{ id: 'sp-1', name: 'Alice', store: 'A' }]);
expect(wrapper.vm.statuses).toEqual(['pending', 'confirmed']);
expect(wrapper.vm.procurementStatuses).toEqual(['ordered', 'arrived']);
```

If the current tests already indirectly rely on those refs, make the assertion explicit.

**Step 2: Run the relevant tests to verify they fail**

Run: `pnpm test:unit src/components/__tests__/OrderManager.network-workflow.test.js`
Expected: FAIL until the manager and filters consume the updated faceted metadata flow cleanly.

**Step 3: Implement the minimal component wiring**

In `OrderManager.vue`, keep passing:

```vue
<OrderFilters
  :salespersons="salespersons"
  :statuses="statuses"
  :procurement-statuses="procurementStatuses"
/>
```

No major template change is required. The important change is that these props are now refreshed faceted metadata rather than static one-time arrays.

Optional lightweight enhancement in `OrderFilters.vue`:

- add a `search-suggestions` prop for future autocomplete plumbing
- do not implement autocomplete UI in this increment

```js
searchSuggestions: {
  type: Array,
  default: () => [],
},
```

**Step 4: Run the tests to verify they pass**

Run: `pnpm test:unit src/components/__tests__/OrderManager.network-workflow.test.js`
Expected: PASS

Run: `pnpm test:unit src/components/order/__tests__/OrderFilters.desktop-layout.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/OrderManager.vue src/components/order/OrderFilters.vue src/components/__tests__/OrderManager.network-workflow.test.js src/components/order/__tests__/OrderFilters.desktop-layout.test.js
git commit -m "feat: wire order faceted metadata into filter bar"
```

### Task 7: Verification And Regression Coverage

**Files:**
- Verify only:
  - `O:/Code/KK-Image/functions/repositories/order/queries.js`
  - `O:/Code/KK-Image/functions/lib/hono/routes/manage/orders/list.js`
  - `O:/Code/KK-Image/src/composables/useOrders.js`
  - `O:/Code/KK-Image/src/components/OrderManager.vue`
  - `O:/Code/KK-Image/src/components/order/OrderFilters.vue`

**Step 1: Run backend verification**

Run: `pnpm test:unit functions/repositories/order/__tests__/admin-facets.test.js`
Expected: PASS

**Step 2: Run frontend verification**

Run: `pnpm test:unit src/components/__tests__/OrderManager.network-workflow.test.js`
Expected: PASS

Run: `pnpm test:unit src/components/order/__tests__/OrderFilters.desktop-layout.test.js`
Expected: PASS

**Step 3: Run adjacent order regressions**

Run: `pnpm test:unit src/components/__tests__/OrderManager.design-system-migration.test.js`
Expected: PASS

Run: `pnpm test:unit src/composables/__tests__/useOrders.authz.test.js`
Expected: PASS

Run: `pnpm test:unit src/composables/__tests__/useOrders.change-status.test.js`
Expected: PASS

**Step 4: Inspect workspace before any completion claim**

Run: `git status --short`
Expected: only the order faceted metadata files above plus unrelated pre-existing dirty files.

**Step 5: Commit**

```bash
git add functions/repositories/order/queries.js functions/lib/hono/routes/manage/orders/list.js src/composables/useOrders.js src/components/OrderManager.vue src/components/order/OrderFilters.vue functions/repositories/order/__tests__/admin-facets.test.js src/components/__tests__/OrderManager.network-workflow.test.js src/components/order/__tests__/OrderFilters.desktop-layout.test.js
git commit -m "feat: add faceted metadata to order management"
```

## Notes

- This plan intentionally keeps search suggestions backend-only data for now; it does not require autocomplete UI.
- This plan intentionally avoids a second `/filters` endpoint.
- The current workspace already contains unrelated user changes and prior product-management work; do not bundle them into the order faceted metadata commit.

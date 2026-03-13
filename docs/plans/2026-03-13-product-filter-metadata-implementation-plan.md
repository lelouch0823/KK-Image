# Product Filter Metadata Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add server-driven faceted brand/category filter metadata to Product Management so dropdown options stay correct across filtering, sorting, and pagination.

**Architecture:** Extend `ProductRepository.search()` to return `filters.brands` and `filters.categories` alongside list data, using shared SQL filter-clause builders with self-dimension omission. Propagate that metadata through the product list route and `useProducts()`, then remove the current-page-derived option logic from `ProductManager.vue`.

**Tech Stack:** Vue 3, Vitest, Hono, D1 repository SQL, existing `useResource()`/`useProducts()` composables.

---

### Task 1: Define Failing Contracts For Faceted Filter Metadata

**Files:**
- Modify: `O:/Code/KK-Image/functions/repositories/__tests__/product-spu.test.js`
- Modify: `O:/Code/KK-Image/src/components/__tests__/ProductManager.create-success-ux.test.js`

**Step 1: Write the failing backend metadata test for brand faceting**

```js
it('returns faceted brand metadata while ignoring the current brand filter', async () => {
  db.prepare.mockImplementation((sql) => {
    const stmt = createPreparedStatement(sql);

    if (sql.includes('SELECT DISTINCT p.brand')) {
      stmt.all.mockResolvedValue({
        results: [{ brand: 'KK' }, { brand: 'ACME' }],
      });
    }

    if (sql.includes('SELECT DISTINCT p.category')) {
      stmt.all.mockResolvedValue({
        results: [{ category: 'Top' }],
      });
    }

    if (sql.includes('COUNT(*)')) {
      stmt.first.mockResolvedValue({ total: 1 });
    }

    if (sql.includes('FROM products p')) {
      stmt.all.mockResolvedValue({
        results: [{
          id: 'test-id',
          name: 'Test',
          brand: 'KK',
          category: 'Top',
          images: '[]',
          specifications: '{}',
          options: '[]',
        }],
      });
    }

    return stmt;
  });

  const result = await repo.search({
    brand: 'KK',
    category: 'Top',
    search: 'tee',
    hasStock: 'in_stock',
  });

  expect(result.filters.brands).toEqual(['KK', 'ACME']);
});
```

**Step 2: Write the failing frontend metadata-consumption test**

```js
it('uses server-provided brand/category metadata instead of deriving from current page items', async () => {
  mocks.availableFilters.value = {
    brands: ['KK', 'ACME'],
    categories: ['Top', 'Shoes'],
  };
  mocks.products.value = [{ id: 'p-1', brand: 'OnlyCurrentPageBrand', category: 'OnlyCurrentPageCategory' }];

  const wrapper = createWrapper();

  expect(wrapper.vm.brandOptions).toEqual(['KK', 'ACME']);
  expect(wrapper.vm.categoryOptions).toEqual(['Top', 'Shoes']);
});
```

**Step 3: Run the tests to verify they fail**

Run: `pnpm test:unit functions/repositories/__tests__/product-spu.test.js`
Expected: FAIL because `search()` does not yet return `filters`.

Run: `pnpm test:unit src/components/__tests__/ProductManager.create-success-ux.test.js`
Expected: FAIL because `ProductManager.vue` still derives options from `products.value`.

**Step 4: Commit**

```bash
git add functions/repositories/__tests__/product-spu.test.js src/components/__tests__/ProductManager.create-success-ux.test.js
git commit -m "test: define product filter metadata contracts"
```

### Task 2: Add Repository-Level Faceted Metadata Helpers

**Files:**
- Modify: `O:/Code/KK-Image/functions/repositories/ProductRepository.js`
- Test: `O:/Code/KK-Image/functions/repositories/__tests__/product-spu.test.js`

**Step 1: Add one more failing test for category faceting**

```js
it('returns faceted category metadata while ignoring the current category filter', async () => {
  const result = await repo.search({
    brand: 'KK',
    category: 'Top',
    status: 'active',
  });

  expect(result.filters.categories).toEqual(['Top', 'Shoes']);
});
```

**Step 2: Run the repository test to verify it fails correctly**

Run: `pnpm test:unit functions/repositories/__tests__/product-spu.test.js`
Expected: FAIL because `filters.categories` is missing or incorrect.

**Step 3: Implement reusable filter-clause helpers in `ProductRepository.js`**

```js
buildProductFilterClause(filters = {}, { omit = [] } = {}) {
  const clauses = [];
  const params = [];

  if (filters.status && !omit.includes('status')) {
    clauses.push("(CASE WHEN COALESCE(va.active_variant_count, 0) > 0 THEN 'active' ELSE 'archived' END) = ?");
    params.push(filters.status);
  }

  if (filters.category && !omit.includes('category')) {
    clauses.push('p.category = ?');
    params.push(filters.category);
  }

  if (filters.brand && !omit.includes('brand')) {
    clauses.push('p.brand = ?');
    params.push(filters.brand);
  }

  if (filters.search && !omit.includes('search')) {
    clauses.push('(p.name LIKE ? OR p.spu LIKE ? OR p.series LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }

  if (filters.hasStock === 'in_stock' && !omit.includes('hasStock')) {
    clauses.push('COALESCE(va.total_available_quantity, COALESCE(va.total_stock_quantity, 0)) > 0');
  }

  if (filters.hasStock === 'out_of_stock' && !omit.includes('hasStock')) {
    clauses.push('COALESCE(va.total_available_quantity, COALESCE(va.total_stock_quantity, 0)) <= 0');
  }

  return {
    clause: clauses.length > 0 ? clauses.join(' AND ') : '1=1',
    params,
  };
}
```

Add facet helpers:

```js
async listAvailableBrands(filters = {}) {
  const { clause, params } = this.buildProductFilterClause(filters, { omit: ['brand'] });
  const sql = `
    ${this._variantAggregateCTE()}
    SELECT DISTINCT p.brand AS brand
    FROM products p
    LEFT JOIN variant_agg va ON va.product_id = p.id
    WHERE ${clause}
      AND p.brand IS NOT NULL
      AND p.brand != ''
    ORDER BY p.brand COLLATE NOCASE
  `;
  const result = await this.db.prepare(sql).bind(...params).all();
  return (result.results || []).map((row) => row.brand).filter(Boolean);
}
```

```js
async listAvailableCategories(filters = {}) {
  const { clause, params } = this.buildProductFilterClause(filters, { omit: ['category'] });
  const sql = `
    ${this._variantAggregateCTE()}
    SELECT DISTINCT p.category AS category
    FROM products p
    LEFT JOIN variant_agg va ON va.product_id = p.id
    WHERE ${clause}
      AND p.category IS NOT NULL
      AND p.category != ''
    ORDER BY p.category COLLATE NOCASE
  `;
  const result = await this.db.prepare(sql).bind(...params).all();
  return (result.results || []).map((row) => row.category).filter(Boolean);
}
```

Update `search()` to return:

```js
const [brands, categories] = await Promise.all([
  this.listAvailableBrands(filters),
  this.listAvailableCategories(filters),
]);

return {
  items,
  total,
  page,
  limit,
  totalPages,
  filters: {
    brands,
    categories,
  },
};
```

**Step 4: Run the repository test to verify it passes**

Run: `pnpm test:unit functions/repositories/__tests__/product-spu.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/repositories/ProductRepository.js functions/repositories/__tests__/product-spu.test.js
git commit -m "feat: add faceted product filter metadata"
```

### Task 3: Expose Filter Metadata In The Product List Route

**Files:**
- Modify: `O:/Code/KK-Image/functions/lib/hono/routes/manage/products/index.js`
- Test: `O:/Code/KK-Image/functions/repositories/__tests__/product-spu.test.js`

**Step 1: Add a failing route-level assertion if no route test exists yet, or extend an existing mocked route test**

```js
expect(json.filters).toEqual({
  brands: ['KK', 'ACME'],
  categories: ['Top', 'Shoes'],
});
```

If there is no practical route test nearby, document that repository coverage already proves the metadata generation and keep this step minimal.

**Step 2: Run the relevant test to verify it fails**

Run: `pnpm test:unit functions/repositories/__tests__/product-spu.test.js`
Expected: If route assertions were added, FAIL until route includes `filters`.

**Step 3: Implement minimal route passthrough**

```js
return c.json({
  success: true,
  data: items,
  meta: {
    total: result.total,
    page: result.page,
    limit: result.limit,
  },
  filters: result.filters || { brands: [], categories: [] },
});
```

**Step 4: Run the relevant test to verify it passes**

Run: `pnpm test:unit functions/repositories/__tests__/product-spu.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/products/index.js
git commit -m "feat: expose product filter metadata in list route"
```

### Task 4: Extend `useProducts()` To Carry Server Metadata

**Files:**
- Modify: `O:/Code/KK-Image/src/composables/useProducts.js`
- Test: `O:/Code/KK-Image/src/components/__tests__/ProductManager.create-success-ux.test.js`

**Step 1: Add a failing test shape for composable-backed metadata**

Update the existing mock to include:

```js
availableFilters: ref({ brands: ['KK'], categories: ['Top'] }),
```

Then assert `ProductManager` consumes it.

**Step 2: Run the ProductManager test to verify it fails**

Run: `pnpm test:unit src/components/__tests__/ProductManager.create-success-ux.test.js`
Expected: FAIL because `useProducts()` does not expose `availableFilters`.

**Step 3: Implement minimal metadata state in `useProducts.js`**

```js
import { ref } from 'vue';

const availableFilters = ref({
  brands: [],
  categories: [],
});

const loadProducts = async (params = {}, forceRefresh = false) => {
  const ok = await resource.loadItems(params, forceRefresh);
  if (!ok) return false;

  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null)
  );
  const res = await resource.rawRequest(`?${query.toString()}`);
  if (res?.success) {
    availableFilters.value = res.filters || { brands: [], categories: [] };
  }
  return ok;
};
```

Preferred cleanup if you want one request instead of two:
- refactor `useResource()` later to expose the last raw list payload
- not required for this increment

Return:

```js
availableFilters,
```

**Step 4: Run the ProductManager test to verify it passes**

Run: `pnpm test:unit src/components/__tests__/ProductManager.create-success-ux.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/composables/useProducts.js src/components/__tests__/ProductManager.create-success-ux.test.js
git commit -m "feat: expose product filter metadata in useProducts"
```

### Task 5: Remove Current-Page-Derived Filter Options From ProductManager

**Files:**
- Modify: `O:/Code/KK-Image/src/components/ProductManager.vue`
- Test: `O:/Code/KK-Image/src/components/__tests__/ProductManager.create-success-ux.test.js`

**Step 1: Expand the failing frontend test to guard against page-derived options**

```js
expect(wrapper.vm.brandOptions).not.toEqual(['OnlyCurrentPageBrand']);
expect(wrapper.vm.categoryOptions).not.toEqual(['OnlyCurrentPageCategory']);
```

**Step 2: Run the ProductManager test to verify it fails**

Run: `pnpm test:unit src/components/__tests__/ProductManager.create-success-ux.test.js`
Expected: FAIL because options are still derived from `products.value`.

**Step 3: Implement minimal `ProductManager.vue` cleanup**

Replace:

```js
const brandOptions = computed(() => [...new Set(products.value.map(...))]);
const categoryOptions = computed(() => [...new Set(products.value.map(...))]);
```

With:

```js
const { products, loading, error, errorCode, pagination, loadProducts, deleteProduct, loadProduct, availableFilters } = useProducts();

const brandOptions = computed(() => availableFilters.value?.brands || []);
const categoryOptions = computed(() => availableFilters.value?.categories || []);
```

Keep all existing query-state logic unchanged.

**Step 4: Run the ProductManager test to verify it passes**

Run: `pnpm test:unit src/components/__tests__/ProductManager.create-success-ux.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ProductManager.vue src/components/__tests__/ProductManager.create-success-ux.test.js
git commit -m "feat: consume server-side product filter metadata"
```

### Task 6: Verification And Regression Coverage

**Files:**
- Verify only:
  - `O:/Code/KK-Image/functions/repositories/ProductRepository.js`
  - `O:/Code/KK-Image/functions/lib/hono/routes/manage/products/index.js`
  - `O:/Code/KK-Image/src/composables/useProducts.js`
  - `O:/Code/KK-Image/src/components/ProductManager.vue`

**Step 1: Run backend verification**

Run: `pnpm test:unit functions/repositories/__tests__/product-spu.test.js`
Expected: PASS

**Step 2: Run frontend verification**

Run: `pnpm test:unit src/components/__tests__/ProductManager.create-success-ux.test.js`
Expected: PASS

Run: `pnpm test:unit src/components/__tests__/ProductManager.variant-hydration.test.js`
Expected: PASS

**Step 3: Run adjacent table/filter regression**

Run: `pnpm test:unit src/components/product/__tests__/ProductFilters.desktop-layout.test.js`
Expected: PASS

Run: `pnpm test:unit src/components/ui/__tests__/AppTable.sorting.test.js`
Expected: PASS

**Step 4: Inspect workspace before any commit**

Run: `git status --short`
Expected: only the metadata-related files above plus unrelated pre-existing user changes.

**Step 5: Commit**

```bash
git add functions/repositories/ProductRepository.js functions/lib/hono/routes/manage/products/index.js src/composables/useProducts.js src/components/ProductManager.vue functions/repositories/__tests__/product-spu.test.js src/components/__tests__/ProductManager.create-success-ux.test.js
git commit -m "feat: add faceted product filter metadata"
```

## Notes

- This plan intentionally keeps `status` and `hasStock` option metadata client-defined.
- This plan intentionally does not add counts per facet option.
- The current workspace already contains unrelated dirty files; do not fold them into this increment.
- If the extra raw request inside `useProducts.loadProducts()` feels too expensive during implementation, the better follow-up is to refactor `useResource()` to expose the last successful JSON payload rather than inventing a second endpoint.

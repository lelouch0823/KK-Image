# Product Management Server-Side Filters And Sorting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align Product Management with the new Order Management desktop toolbar pattern while adding server-driven product filters and sorting that work correctly with pagination.

**Architecture:** Keep pagination, filtering, and sorting in one query state owned by `ProductManager.vue`. Extend the product list API and `ProductRepository.search()` so `search`, `status`, `brand`, `category`, `hasStock`, `sortBy`, and `sortOrder` are all resolved on the server. Enhance `AppTable.vue` to expose reusable sortable-header interactions without performing local data sorting, and wire `ProductTable.vue` to opt in for `price` and `stock`.

**Tech Stack:** Vue 3 SFCs, Vitest, Hono routes, repository-layer SQL against D1, Tailwind utility classes.

---

### Task 1: Stabilize The Test Surface Before Touching Production Code

**Files:**
- Modify: `O:/Code/KK-Image/functions/repositories/__tests__/product-spu.test.js`
- Modify: `O:/Code/KK-Image/src/components/__tests__/ProductManager.create-success-ux.test.js`
- Create: `O:/Code/KK-Image/src/components/product/__tests__/ProductFilters.desktop-layout.test.js`
- Create: `O:/Code/KK-Image/src/components/ui/__tests__/AppTable.sorting.test.js`

**Step 1: Write the failing repository test for combined server-side filters and sorting**

```js
it('supports combined brand, category, stock, and sort queries', async () => {
  await repo.search({
    brand: 'KK',
    category: 'Top',
    hasStock: 'in_stock',
    sortBy: 'stock',
    sortOrder: 'desc',
  });

  const listSql = db.prepare.mock.calls.find((call) => call[0].includes('ORDER BY'))?.[0] || '';
  expect(listSql).toContain('brand = ?');
  expect(listSql).toContain('category = ?');
  expect(listSql).toContain('available_quantity');
  expect(listSql).toContain('ORDER BY');
});
```

**Step 2: Write the failing ProductManager query-state test**

```js
it('preserves extended filters and sorting when refreshing the list', async () => {
  wrapper.vm.filters.search = 'shoe';
  wrapper.vm.filters.status = 'active';
  wrapper.vm.filters.brand = 'KK';
  wrapper.vm.filters.category = 'Top';
  wrapper.vm.filters.hasStock = 'in_stock';
  wrapper.vm.filters.sortBy = 'stock';
  wrapper.vm.filters.sortOrder = 'desc';

  await wrapper.vm.handleModalSuccess();

  expect(mocks.loadProducts).toHaveBeenLastCalledWith(
    {
      page: 2,
      status: 'active',
      search: 'shoe',
      brand: 'KK',
      category: 'Top',
      hasStock: 'in_stock',
      sortBy: 'stock',
      sortOrder: 'desc',
    },
    true
  );
});
```

**Step 3: Write the failing ProductFilters desktop-layout contract test**

```js
it('supports an actions slot inline with the search input on desktop', () => {
  expect(source).toContain('<slot name="actions" />');
  expect(source).toContain('lg:flex-1');
  expect(source).toContain('hidden shrink-0 items-center gap-2 lg:flex');
});
```

**Step 4: Write the failing AppTable sorting event test**

```js
it('emits sort-change when a sortable header is clicked', async () => {
  const wrapper = mount(AppTable, {
    props: {
      columns: [{ key: 'price', label: 'Price', sortable: true }],
      data: [{ id: 1, price: 100 }],
    },
  });

  await wrapper.get('th').trigger('click');
  expect(wrapper.emitted('sort-change')?.[0]).toEqual([{ sortBy: 'price', sortOrder: 'asc' }]);
});
```

**Step 5: Run the tests to verify they fail**

Run: `pnpm test:unit functions/repositories/__tests__/product-spu.test.js`
Expected: FAIL because `ProductRepository.search()` does not yet honor `hasStock` and sortable SQL.

Run: `pnpm test:unit src/components/__tests__/ProductManager.create-success-ux.test.js`
Expected: FAIL because `filters` currently only carries `search` and `status`.

Run: `pnpm test:unit src/components/product/__tests__/ProductFilters.desktop-layout.test.js`
Expected: FAIL because `ProductFilters.vue` has no inline desktop `actions` slot and no extra filters.

Run: `pnpm test:unit src/components/ui/__tests__/AppTable.sorting.test.js`
Expected: FAIL because `AppTable.vue` does not emit `sort-change`.

**Step 6: Commit**

```bash
git add functions/repositories/__tests__/product-spu.test.js src/components/__tests__/ProductManager.create-success-ux.test.js src/components/product/__tests__/ProductFilters.desktop-layout.test.js src/components/ui/__tests__/AppTable.sorting.test.js
git commit -m "test: define product management filter and sort contracts"
```

### Task 2: Extend The Product API Query Contract

**Files:**
- Modify: `O:/Code/KK-Image/functions/lib/hono/routes/manage/products/index.js`
- Modify: `O:/Code/KK-Image/functions/repositories/ProductRepository.js`
- Test: `O:/Code/KK-Image/functions/repositories/__tests__/product-spu.test.js`

**Step 1: Write one more failing assertion for explicit sort-field allowlisting**

```js
it('falls back to default ordering when sortBy is unsupported', async () => {
  await repo.search({ sortBy: 'hack', sortOrder: 'desc' });
  const listSql = db.prepare.mock.calls.find((call) => call[0].includes('ORDER BY'))?.[0] || '';
  expect(listSql).toContain('p.created_at DESC');
});
```

**Step 2: Run the repository test to verify it fails correctly**

Run: `pnpm test:unit functions/repositories/__tests__/product-spu.test.js`
Expected: FAIL with SQL/order assertions, not with syntax errors.

**Step 3: Implement minimal route/query support**

```js
const hasStock = c.req.query('hasStock') || '';
const sortBy = c.req.query('sortBy') || '';
const sortOrder = c.req.query('sortOrder') || '';

const result = await repo.search({
  search,
  category,
  brand,
  status,
  hasStock,
  sortBy,
  sortOrder,
  page,
  limit,
});
```

```js
const SORT_FIELD_SQL = {
  price: 'price',
  stock: 'available_quantity',
  updatedAt: 'p.updated_at',
  name: 'p.name COLLATE NOCASE',
};

if (filters.hasStock === 'in_stock') {
  query += ' AND COALESCE(available_quantity, 0) > 0';
}

if (filters.hasStock === 'out_of_stock') {
  query += ' AND COALESCE(available_quantity, 0) <= 0';
}

const orderSql = SORT_FIELD_SQL[filters.sortBy]
  ? `${SORT_FIELD_SQL[filters.sortBy]} ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}`
  : 'p.created_at DESC';

query += ` ORDER BY ${orderSql}, p.created_at DESC`;
```

**Step 4: Run the repository test to verify it passes**

Run: `pnpm test:unit functions/repositories/__tests__/product-spu.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/products/index.js functions/repositories/ProductRepository.js functions/repositories/__tests__/product-spu.test.js
git commit -m "feat: add server-side product filters and sorting"
```

### Task 3: Add Reusable Sortable Header Behavior To AppTable

**Files:**
- Modify: `O:/Code/KK-Image/src/components/ui/AppTable.vue`
- Test: `O:/Code/KK-Image/src/components/ui/__tests__/AppTable.sorting.test.js`

**Step 1: Expand the failing sorting test to cover the full click cycle**

```js
await wrapper.get('th').trigger('click');
await wrapper.get('th').trigger('click');
await wrapper.get('th').trigger('click');

expect(wrapper.emitted('sort-change')).toEqual([
  [{ sortBy: 'price', sortOrder: 'asc' }],
  [{ sortBy: 'price', sortOrder: 'desc' }],
  [{ sortBy: '', sortOrder: '' }],
]);
```

**Step 2: Run the AppTable sorting test to verify it fails**

Run: `pnpm test:unit src/components/ui/__tests__/AppTable.sorting.test.js`
Expected: FAIL because headers are not interactive and no sort state is emitted.

**Step 3: Implement minimal sortable-header support in AppTable**

```js
const props = defineProps({
  // existing props...
  sortBy: { type: String, default: '' },
  sortOrder: { type: String, default: '' },
});

const emit = defineEmits(['row-click', 'sort-change']);

const toggleSort = (column) => {
  if (!column?.sortable) return;

  if (props.sortBy !== column.key) {
    emit('sort-change', { sortBy: column.key, sortOrder: 'asc' });
    return;
  }

  if (props.sortOrder === 'asc') {
    emit('sort-change', { sortBy: column.key, sortOrder: 'desc' });
    return;
  }

  emit('sort-change', { sortBy: '', sortOrder: '' });
};
```

Add click handling and sort affordance in the `<th>`:

```vue
<th
  @click="toggleSort(col)"
>
  <span class="inline-flex items-center gap-1">
    {{ col.label }}
    <AppIcon v-if="col.sortable" :name="resolveSortIcon(col)" class="size-4" />
  </span>
</th>
```

**Step 4: Run the AppTable sorting test to verify it passes**

Run: `pnpm test:unit src/components/ui/__tests__/AppTable.sorting.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ui/AppTable.vue src/components/ui/__tests__/AppTable.sorting.test.js
git commit -m "feat: add sortable app table headers"
```

### Task 4: Rebuild ProductFilters For Desktop Inline Actions And Expanded Query State

**Files:**
- Modify: `O:/Code/KK-Image/src/components/product/ProductFilters.vue`
- Modify: `O:/Code/KK-Image/src/components/ProductManager.vue`
- Test: `O:/Code/KK-Image/src/components/product/__tests__/ProductFilters.desktop-layout.test.js`
- Test: `O:/Code/KK-Image/src/components/__tests__/ProductManager.create-success-ux.test.js`

**Step 1: Expand the failing ProductFilters test to cover the new query props**

```js
expect(source).toContain('brand');
expect(source).toContain('category');
expect(source).toContain('hasStock');
expect(source).toContain("defineEmits(['update:search', 'update:status', 'update:brand', 'update:category', 'update:hasStock', 'refresh'])");
```

**Step 2: Run the ProductFilters and ProductManager tests to verify they fail**

Run: `pnpm test:unit src/components/product/__tests__/ProductFilters.desktop-layout.test.js`
Expected: FAIL because `ProductFilters.vue` is still a two-control layout.

Run: `pnpm test:unit src/components/__tests__/ProductManager.create-success-ux.test.js`
Expected: FAIL because the manager does not persist the expanded query state.

**Step 3: Implement the minimal desktop/mobile layout and query-state changes**

In `ProductFilters.vue`:

```js
defineProps({
  search: { type: String, default: '' },
  status: { type: String, default: '' },
  brand: { type: String, default: '' },
  category: { type: String, default: '' },
  hasStock: { type: String, default: '' },
  brandOptions: { type: Array, default: () => [] },
  categoryOptions: { type: Array, default: () => [] },
});

defineEmits([
  'update:search',
  'update:status',
  'update:brand',
  'update:category',
  'update:hasStock',
  'refresh',
]);
```

Use one desktop row:

```vue
<div class="flex flex-wrap items-center gap-2">
  <!-- status / brand / category / stock -->
  <div class="min-w-0 basis-full lg:min-w-[12rem] lg:flex-1">
    <SearchInput ... />
  </div>
  <div class="hidden shrink-0 items-center gap-2 lg:flex">
    <slot name="actions" />
  </div>
</div>
```

In `ProductManager.vue`:

```js
const filters = reactive({
  search: '',
  status: '',
  brand: '',
  category: '',
  hasStock: '',
  sortBy: '',
  sortOrder: '',
});
```

Create a single helper:

```js
const buildProductQuery = (overrides = {}) => ({
  page: pagination.page || 1,
  search: filters.search,
  status: filters.status,
  brand: filters.brand,
  category: filters.category,
  hasStock: filters.hasStock,
  sortBy: filters.sortBy,
  sortOrder: filters.sortOrder,
  ...overrides,
});
```

**Step 4: Run the ProductFilters and ProductManager tests to verify they pass**

Run: `pnpm test:unit src/components/product/__tests__/ProductFilters.desktop-layout.test.js`
Expected: PASS

Run: `pnpm test:unit src/components/__tests__/ProductManager.create-success-ux.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/product/ProductFilters.vue src/components/ProductManager.vue src/components/product/__tests__/ProductFilters.desktop-layout.test.js src/components/__tests__/ProductManager.create-success-ux.test.js
git commit -m "feat: align product filters with desktop inline actions"
```

### Task 5: Wire ProductTable Sorting Into The Shared Table Contract

**Files:**
- Modify: `O:/Code/KK-Image/src/components/product/ProductTable.vue`
- Modify: `O:/Code/KK-Image/src/components/ProductManager.vue`
- Test: `O:/Code/KK-Image/src/components/ui/__tests__/AppTable.sorting.test.js`
- Test: `O:/Code/KK-Image/src/components/__tests__/ProductManager.create-success-ux.test.js`

**Step 1: Add a failing ProductManager test for sort-change handling**

```js
it('resets to page 1 and reloads when product table sort changes', async () => {
  await wrapper.vm.handleSortChange({ sortBy: 'price', sortOrder: 'asc' });

  expect(mocks.loadProducts).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 1, sortBy: 'price', sortOrder: 'asc' })
  );
});
```

**Step 2: Run the ProductManager test to verify it fails**

Run: `pnpm test:unit src/components/__tests__/ProductManager.create-success-ux.test.js`
Expected: FAIL because no sort handler exists yet.

**Step 3: Implement minimal ProductTable sort wiring**

In `ProductTable.vue`:

```js
defineProps({
  products: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  rowClass: { type: Function, default: () => '' },
  sortBy: { type: String, default: '' },
  sortOrder: { type: String, default: '' },
});

defineEmits(['edit', 'delete', 'view', 'share', 'sort-change']);
```

Mark sortable columns:

```js
{ key: 'price', label: t('product.table.header.price'), align: 'center', sortable: true },
{ key: 'stock', label: t('product.table.header.stock'), align: 'center', sortable: true },
```

Pass through to `AppTable`:

```vue
<AppTable
  :sort-by="sortBy"
  :sort-order="sortOrder"
  @sort-change="$emit('sort-change', $event)"
/>
```

In `ProductManager.vue`:

```js
const handleSortChange = async ({ sortBy, sortOrder }) => {
  filters.sortBy = sortBy;
  filters.sortOrder = sortOrder;
  await loadProducts(buildProductQuery({ page: 1 }));
};
```

**Step 4: Run the ProductManager test to verify it passes**

Run: `pnpm test:unit src/components/__tests__/ProductManager.create-success-ux.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/product/ProductTable.vue src/components/ProductManager.vue src/components/__tests__/ProductManager.create-success-ux.test.js
git commit -m "feat: wire product table server-side sorting"
```

### Task 6: Final Verification And Cleanup

**Files:**
- Verify only:
  - `O:/Code/KK-Image/functions/repositories/ProductRepository.js`
  - `O:/Code/KK-Image/functions/lib/hono/routes/manage/products/index.js`
  - `O:/Code/KK-Image/src/components/ui/AppTable.vue`
  - `O:/Code/KK-Image/src/components/product/ProductFilters.vue`
  - `O:/Code/KK-Image/src/components/product/ProductTable.vue`
  - `O:/Code/KK-Image/src/components/ProductManager.vue`

**Step 1: Run targeted unit tests**

Run: `pnpm test:unit functions/repositories/__tests__/product-spu.test.js`
Expected: PASS

Run: `pnpm test:unit src/components/ui/__tests__/AppTable.sorting.test.js`
Expected: PASS

Run: `pnpm test:unit src/components/product/__tests__/ProductFilters.desktop-layout.test.js`
Expected: PASS

Run: `pnpm test:unit src/components/__tests__/ProductManager.create-success-ux.test.js`
Expected: PASS

**Step 2: Run adjacent regression coverage**

Run: `pnpm test:unit src/components/__tests__/ProductManager.variant-hydration.test.js`
Expected: PASS

Run: `pnpm test:unit src/components/ui/__tests__/AppTable.design-contract.test.js`
Expected: PASS

**Step 3: Inspect diff for unrelated files before commit**

Run: `git status --short`
Expected: only the product-management files above plus any pre-existing unrelated user changes.

**Step 4: Commit**

```bash
git add functions/repositories/ProductRepository.js functions/lib/hono/routes/manage/products/index.js src/components/ui/AppTable.vue src/components/product/ProductFilters.vue src/components/product/ProductTable.vue src/components/ProductManager.vue functions/repositories/__tests__/product-spu.test.js src/components/ui/__tests__/AppTable.sorting.test.js src/components/product/__tests__/ProductFilters.desktop-layout.test.js src/components/__tests__/ProductManager.create-success-ux.test.js
git commit -m "feat: add server-side product filters and sorting"
```

**Step 5: Record residual manual verification**

Run: `pnpm dev`
Expected: manually verify `/admin/products` on desktop:
- toolbar buttons sit to the right of the search input
- brand/category/status/stock filters combine correctly
- sorting `price` or `stock` keeps filter state and resets to page 1
- pagination remains correct after sorting

## Notes

- The workspace already contains unrelated dirty files outside this plan:
  - `O:/Code/KK-Image/src/views/FileManager/TrashModal.vue`
  - `O:/Code/KK-Image/src/views/PurchaseOrders.vue`
  - `O:/Code/KK-Image/src/views/__tests__/PurchaseOrders.design-system-migration.test.js`
  - `O:/Code/KK-Image/src/views/__tests__/TrashModal.design-system-migration.test.js`
- The workspace also contains earlier order-management changes and interrupted test scaffolding. Review them before executing this plan so you do not accidentally bundle unrelated work into the product-management branch.

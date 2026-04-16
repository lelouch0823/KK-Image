# Product Filter Metadata Design

**Date:** 2026-03-13

**Goal:** Upgrade Product Management so brand/category filter options come from server-side faceted metadata instead of being inferred from the current page, while keeping filtering, sorting, and pagination fully consistent.

## Context

The product list already moved to server-driven filtering and sorting for:

- `search`
- `status`
- `brand`
- `category`
- `hasStock`
- `sortBy`
- `sortOrder`
- pagination

That fixed the correctness problem for cross-page sorting. One gap remains: the brand/category filter dropdowns are still derived from the currently loaded page of products. That is not correct once pagination or restrictive filters are involved.

## Problem

If filter options are derived from the current page:

- page 1 and page 2 may expose different option sets for the same underlying query
- a valid brand/category may disappear just because it is not present in the current page slice
- sorting changes may indirectly change which options appear
- the UI no longer reflects the actual server-side result space

This is below SOTA for faceted search.

## Design Decision

Use the existing product list endpoint as the single source of truth and extend its response with server-computed filter metadata.

Recommended response shape:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20
  },
  "filters": {
    "brands": [],
    "categories": []
  }
}
```

Only `brands` and `categories` need dynamic server metadata right now.

Keep these client-defined for now:

- `status`: `全部 / active / archived`
- `hasStock`: `全部 / 有库存 / 无库存`

This keeps the API minimal while fixing the correctness gap.

## Faceted Metadata Semantics

Use faceted filtering semantics with self-dimension exclusion.

### Brands

`filters.brands` should be computed using the current query, but ignoring the current `brand` selection itself.

Apply these filters:

- `search`
- `status`
- `category`
- `hasStock`

Do not apply:

- `brand`

Result: when a category is selected, the brand list narrows to brands still valid for that category and search context, but the brand dropdown does not collapse to only the already-selected brand.

### Categories

`filters.categories` should be computed using the current query, but ignoring the current `category` selection itself.

Apply these filters:

- `search`
- `status`
- `brand`
- `hasStock`

Do not apply:

- `category`

Result: category options stay switchable even after a category is already selected.

## Why This Is SOTA

This is closer to standard faceted search behavior used in strong commerce and analytics systems:

- options stay consistent with the true server-side result set
- options remain useful instead of degenerating into a single selected value
- pagination no longer affects which filters appear
- filter metadata and list rows are resolved from the same query context

Two weaker alternatives were rejected:

1. Always returning global full lists

- simple, but noisy
- does not adapt to current context
- degrades UX for large catalogs

2. Fully applying the current filter to its own option set

- mathematically valid
- poor UX, because the selected dimension collapses and becomes hard to change

## Backend Changes

Extend `ProductRepository` with faceted metadata helpers.

Recommended repository shape:

```js
async search(filters = {}) {
  // existing list query
  // existing count query
  // new metadata queries

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
}
```

Implementation detail:

- extract reusable filter clause builders so list/count/facet queries do not diverge
- support toggling whether a dimension should include its own filter
- continue to whitelist sortable fields

Recommended internal helpers:

- `buildProductFilterClause(filters, { omit = [] })`
- `listAvailableBrands(filters)`
- `listAvailableCategories(filters)`

## Route Changes

`GET /api/manage/products` should forward the repository metadata and include it in the JSON response:

```js
return c.json({
  success: true,
  data: items,
  meta: { ... },
  filters: result.filters,
});
```

No new endpoint is needed at this stage.

## Frontend Changes

`ProductManager.vue` should stop deriving `brandOptions` and `categoryOptions` from `products.value`.

Instead:

- maintain `availableFilters` state from server response
- pass `availableFilters.brands` and `availableFilters.categories` into `ProductFilters`
- keep all filter/sort/page updates going through the existing unified query state

Possible implementation options:

1. Extend `useProducts()` to expose `availableFilters`

- cleaner encapsulation
- preferred if this metadata is part of the product-list contract

2. Read `filters` response in `ProductManager` using a raw request path

- faster patch
- more page-specific leakage

Preferred option: extend `useProducts()`.

## Testing

### Backend

Add repository tests covering:

- brand metadata narrows under `category/search/status/hasStock`
- brand metadata ignores current `brand`
- category metadata narrows under `brand/search/status/hasStock`
- category metadata ignores current `category`

### Frontend

Add tests covering:

- product manager uses server filter metadata instead of current-page inference
- changing page does not locally recompute options from page rows
- sorting changes preserve server-provided metadata

## Non-Goals

Not included in this increment:

- separate `/filters` endpoint
- metadata counts beside each option
- dynamic server metadata for `status`
- dynamic server metadata for `hasStock`
- multi-select facets

## Recommended Next Step

Write an implementation plan that:

- adds repository-level faceted metadata
- extends the list API response
- exposes metadata through `useProducts()`
- removes page-derived filter options from `ProductManager.vue`
- adds regression tests for both backend and frontend behavior

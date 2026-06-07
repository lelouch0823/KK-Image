# Order Faceted Metadata Design

**Date:** 2026-03-13

**Goal:** Upgrade Order Management so all list filters are resolved as server-driven faceted metadata instead of being treated as static side data, while keeping pagination, search, and filtering consistent.

## Context

The order list currently returns:

- `orders`
- `pagination`
- `salespersons`
- `statuses`
- `procurementStatuses`

This is already better than page-derived options, because the frontend is not inferring filter choices from the current page of orders. But it is still not faceted metadata:

- the filter option sets do not narrow based on current filter context
- the metadata is treated as near-static and cached only on first load
- there is no server-driven search suggestion surface

That means the order module is not yet at the same SOTA faceted-search level we just applied to Product Management.

## Design Decision

Continue to use the existing list endpoint:

- `GET /api/manage/orders`

Do not add a separate `/filters` endpoint.

Reason:

- one request remains the single source of truth
- list rows, pagination, and filter metadata stay in the same query context
- avoids synchronization bugs between parallel requests

## Response Shape

Recommended response shape:

```json
{
  "success": true,
  "data": {
    "orders": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "totalPages": 1
    },
    "filters": {
      "salespersons": [],
      "statuses": [],
      "procurementStatuses": [],
      "searchSuggestions": []
    }
  }
}
```

This replaces the current top-level side fields:

- `salespersons`
- `statuses`
- `procurementStatuses`

with one explicit `filters` object.

## Query Inputs

The faceted metadata should be resolved from the same active order query:

- `salesperson`
- `status`
- `procurementStatus`
- `search`
- `startTime`
- `endTime`
- `page`
- `limit`

Pagination only affects row slicing. Metadata should ignore `page` and `limit`.

## Faceted Semantics

Use self-dimension exclusion.

### Salespersons

`filters.salespersons` is computed using the current query, but ignoring the current `salesperson`.

Apply:

- `status`
- `procurementStatus`
- `search`
- `startTime`
- `endTime`

Do not apply:

- `salesperson`

### Statuses

`filters.statuses` is computed using the current query, but ignoring the current `status`.

Apply:

- `salesperson`
- `procurementStatus`
- `search`
- `startTime`
- `endTime`

Do not apply:

- `status`

### Procurement Statuses

`filters.procurementStatuses` is computed using the current query, but ignoring the current `procurementStatus`.

Apply:

- `salesperson`
- `status`
- `search`
- `startTime`
- `endTime`

Do not apply:

- `procurementStatus`

### Search Suggestions

`filters.searchSuggestions` is computed using the current query, but ignoring the current `search`.

Apply:

- `salesperson`
- `status`
- `procurementStatus`
- `startTime`
- `endTime`

Do not apply:

- `search`

## Search Suggestion Scope

Keep the first version intentionally lightweight.

Suggested sources:

- `order_no`
- salesperson name
- customer name from `current_data`

Do not build a full-text suggestion engine in this increment.

Suggested behavior:

- distinct values only
- small capped list, e.g. 10-20 items
- sorted by recency or relevance-lite

## Why This Is SOTA

This gives Order Management the same strong properties as Product Management:

- filter options stay tied to the real server-side result space
- options narrow with context instead of staying globally noisy
- currently selected dimensions remain switchable
- metadata stays correct across pagination
- one endpoint defines the whole list state

## Backend Changes

Order list querying should move toward a shared filter-clause builder, similar to the product pattern.

Recommended helper shape:

```js
buildAdminOrderFilterClause((filters = {}), ({ omit = [] } = {}));
```

It should support:

- `salesperson`
- `status`
- `procurementStatus`
- `search`
- `startTime`
- `endTime`

Then layer faceted helpers on top:

```js
listAvailableSalespersons(filters);
listAvailableStatuses(filters);
listAvailableProcurementStatuses(filters);
listSearchSuggestions(filters);
```

The existing row list query and count query should reuse the same clause builder so semantics do not drift.

## Frontend Changes

`useOrders()` should stop treating order filter metadata as “set once if empty”.

Instead:

- every successful list response updates a shared `availableFilters`
- `OrderManager.vue` keeps passing filter state through as it already does
- `OrderFilters.vue` reads options from the new faceted metadata state

Recommended `useOrders()` state shape:

```js
const availableFilters = ref({
  salespersons: [],
  statuses: [],
  procurementStatuses: [],
  searchSuggestions: [],
});
```

## UI Scope

No major layout redesign is required for this increment.

The existing order filter bar can stay visually the same:

- salesperson select
- status select
- procurement status select
- search input
- create / stats / export actions

Only the option data source changes.

Optional future enhancement:

- bind `searchSuggestions` into the search input as autocomplete

That is not required in the first increment.

## Testing

### Backend

Add coverage for:

- salesperson facet ignores current salesperson
- status facet ignores current status
- procurement facet ignores current procurement status
- search suggestions ignore current search

### Frontend

Add coverage for:

- `useOrders()` updates faceted metadata on every list fetch
- `OrderManager` consumes faceted metadata from `useOrders()`
- option lists do not remain stale after filter changes

## Non-Goals

Not included in this design:

- full autocomplete UI for search
- counts beside each facet option
- separate filter endpoint
- client-side sorting changes
- dashboard stat card redesign

## Recommended Next Step

Write an implementation plan that:

- adds shared admin-order filter clause helpers
- returns faceted metadata from `GET /api/manage/orders`
- updates `useOrders()` to expose `availableFilters`
- updates `OrderManager` and `OrderFilters` to consume it
- adds backend and frontend regression tests

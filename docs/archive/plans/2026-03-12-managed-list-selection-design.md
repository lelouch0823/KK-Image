# Managed List Selection Design

**Date:** 2026-03-12

**Goal:** Extract a reusable list-page interaction layer so create flows across management modules can consistently jump to page 1, highlight the newly created item, optionally open detail, and gracefully handle active filters that hide the new item.

**Scope:** Customer, salesperson, and product management modules in the first rollout. Order, purchase-order, and space modules remain out of scope until the abstraction is proven stable.

---

## Problem

Several management modules reload their list after create, but they do not provide a consistent post-create UX. Today the user can create an item successfully and still fail to see it immediately because:

- the page stays on a later pagination page
- selection state is tied only to the detail panel, not to a transient “newly created” highlight
- active search/filter state can hide the created item with no explicit explanation

This produces the perception that creation failed even when the backend mutation succeeded.

---

## Requirements

### Functional

- After a successful create, the page should be able to reset to page 1 before reloading.
- After reload, if the newly created item is present in the visible list, the page should highlight it temporarily.
- Modules may optionally open the detail view for the created item.
- If current search/filter state hides the created item, the module should keep the filters and show an informational toast instead of silently clearing filters.
- The abstraction must support both table-style and card-style list rendering.

### Non-Functional

- Do not move API fetching logic into the abstraction.
- Keep module-specific state ownership in the page/component using the abstraction.
- Keep the abstraction testable in isolation.
- Avoid designing a generic CRUD framework.

---

## Chosen Approach

Create a composable: `src/composables/useManagedListSelection.js`

This composable will own only list interaction state:

- `selectedId`
- `highlightedId`
- highlight timeout lifecycle
- helper methods for selection and row/card class generation
- a `handleCreated()` orchestration method for post-create UX

Each consuming module keeps responsibility for:

- list fetching and pagination state
- detail panel/modal state
- toasts and localization
- entity-specific data structures

This keeps the abstraction narrow and reusable without creating a hard-coupled page controller.

---

## Alternatives Considered

### Option 1: Minimal create-only helper

Example: `useCreateSuccessUX()`

Pros:

- very low implementation cost
- low migration risk

Cons:

- selection and highlight logic remains duplicated
- does not solve the existing scattering of “selected row vs detail panel” state

### Option 2: Medium abstraction over list interaction

Example: `useManagedListSelection()`

Pros:

- captures the real repeatable pattern
- keeps module data fetching separate
- easy to roll out incrementally

Cons:

- requires minor module adaptation
- needs careful API design so it does not grow into a page framework

### Option 3: Full list page controller

Pros:

- maximum standardization

Cons:

- over-engineered for current module diversity
- would entangle pagination, filtering, loading, detail, and mutation flows
- higher regression risk

**Decision:** Option 2.

---

## API Design

## Composable Output

- `selectedId`
- `highlightedId`
- `selectItem(itemOrId)`
- `clearSelection()`
- `markHighlighted(id, duration?)`
- `getRowClass(row, options?)`
- `handleCreated(options)`

## `handleCreated(options)` contract

Expected options:

- `createdId`: newly created entity id
- `resetToFirstPage`: callback that mutates page state to `1`
- `reload`: callback that reloads page-1 data
- `getItems`: callback returning the visible list after reload
- `openDetail`: optional callback for opening the detail view with the created item
- `onHiddenByFilters`: optional callback invoked when the created item is not visible after reload
- `autoOpen`: optional boolean, default `false`

Behavior:

1. Reset page to 1
2. Reload list
3. Search visible items for `createdId`
4. If found:
   - set `highlightedId`
   - optionally set selection/open detail
5. If not found:
   - keep filters intact
   - invoke `onHiddenByFilters`

---

## State Model

`selectedId` and `highlightedId` must remain separate.

Rationale:

- `selectedId` is persistent UI context for the detail pane or current focus
- `highlightedId` is transient feedback that an item was newly created

If one state is reused for both concerns, opening a detail panel can overwrite highlight feedback or highlight expiry can incorrectly clear the active selection.

---

## Module Integration Plan

### Customers

- Replace inline create-success reload logic in `src/views/Customers.vue`
- On create success:
  - reset page to 1
  - reload customers
  - highlight created customer
  - optionally open detail panel for the created customer
- Keep search query unchanged
- If filtered out, show informational toast

### Salespersons

- Integrate the same composable into `src/components/SalespersonManager.vue`
- Use the module’s existing list reload and detail/edit flow

### Products

- Integrate into `src/components/ProductManager.vue`
- Preserve existing product detail hydration flow
- Only auto-open detail after create if the created item is present in the refreshed page-1 list

---

## Error Handling

- If reload fails, preserve current module error handling and do not swallow the error in the composable.
- If `createdId` is missing, skip the post-create UX and let the module fall back to a normal reload.
- If the created item is not returned in the current visible list, treat this as a filter/visibility condition rather than a mutation failure.

---

## Testing Strategy

### Composable Unit Tests

Create isolated tests for:

- selecting and clearing selection
- highlighting and timer expiry
- `handleCreated()` resetting to page 1
- `handleCreated()` finding the created item and opening detail
- `handleCreated()` invoking hidden-by-filter callback when not found

### Integration Tests

Add targeted module tests for:

- customer create success resets to page 1
- customer create success highlights created row
- salesperson create success refreshes and highlights
- product create success refreshes and highlights without breaking detail hydration

---

## Rollout Strategy

Phase 1:

- implement composable
- wire into customers
- validate UX and test shape

Phase 2:

- wire into salespersons
- wire into products

Phase 3:

- evaluate whether order, purchase-order, or space flows fit the abstraction without contorting it

---

## Risks

- Product detail flow may need extra care because the current module already performs post-selection hydration.
- Some modules may return different create payload shapes and not always include the created entity id.
- If a module’s sorting strategy changes later, “reset to page 1” may no longer be the correct default and the composable API should stay configurable.

---

## Recommendation

Proceed with `useManagedListSelection()` as a narrow interaction abstraction and roll it out only to customers, salespersons, and products first. This gives a shared UX improvement without introducing a generic CRUD controller or forcing unrelated modules into the same state model.

---

## Implementation Notes

Implemented in the first rollout:

- `src/views/Customers.vue`
- `src/components/SalespersonManager.vue`
- `src/components/ProductManager.vue`

Supporting visual highlight plumbing was added to the relevant list-presentational components so the manager-level selection/highlight state can render in both table and card layouts.

Out of scope and intentionally not migrated in this rollout:

- order management
- purchase-order management
- space management

The product create flow required one extra contract adjustment: `useProductForm` now emits the normalized mutation payload on `success` so the manager can receive the created id and run the shared post-create UX.

# Order Line-Level Frontend Adaptation Design

**Problem**

The backend order read model now exposes line-level progress through `displayStatus` and `lines`, while the frontend still renders legacy header-oriented fields such as `procurementStatus` and `currentData.quantity`. This leaves the order list, detail page, edit modal, and duplicate flow partially out of sync with the real business state.

**Goal**

Bring the frontend onto the current order read contract without breaking compatibility for legacy orders that still rely on header-level fallback fields.

## Scope

This design covers:

- Order management list and card status badges
- Order detail screen and print view
- Order edit modal quantity initialization
- Sales-side duplicate flow quantity initialization
- Order filter contract alignment for progress status selection

This design does not introduce new order-line editing workflows. It only adapts existing reads and prefill flows to the line-level read model already returned by the backend.

## Current Gaps

1. Order list badges still use `order.procurementStatus`, ignoring `order.displayStatus`.
2. Order detail renders `currentData` only and does not show `order.lines`.
3. Edit and duplicate flows still read `currentData.quantity`, even though quantity is now authoritative at top level.
4. Order filters still expose legacy procurement status options, which no longer match what list badges display for line-level orders.

## Approach Options

### Option A: Minimal frontend fallback only

- Switch visible badges to `displayStatus || procurementStatus`
- Keep all labels and filters on the old procurement vocabulary

Pros:

- Lowest change surface

Cons:

- Filter semantics stay misleading
- Detail page still lacks line-level visibility unless we separately patch it

### Option B: Frontend compatibility layer plus focused UI additions

- Add a small frontend resolver for order progress status and quantity
- Update badges and detail header to prefer `displayStatus`
- Add a dedicated line-level detail card
- Align filter options and backend list filtering to the same progress vocabulary

Pros:

- Solves the real contract mismatch
- Keeps implementation bounded
- Reuses existing screens instead of inventing new flows

Cons:

- Touches both frontend and a small backend list contract

### Option C: Full order-detail redesign

- Rebuild detail and list UI entirely around line-first cards and aggregated summaries

Pros:

- Most explicit long-term UX

Cons:

- Too large for this adaptation pass
- High regression risk

## Recommended Design

Use Option B.

### 1. Shared compatibility helpers

Add a focused utility for:

- resolving order progress status: `displayStatus -> procurementStatus -> none`
- resolving order quantity: `quantity -> currentData.quantity -> 1`
- resolving detail product title: `currentData.name -> first line snapshot`

This avoids repeating fallback logic across list, detail, edit, and sales duplication flows.

### 2. Status presentation

Expand the existing order status badge vocabulary so `OrderProcurementBadge` can render both:

- legacy header procurement states
- line-level display states such as `partially_procured`, `fully_procured`, `partially_received`, `ready`, `partially_shipped`, `completed`, `cancelled`

Order list and detail header should prefer the resolved display status.

### 3. Detail page line-level rendering

Add a compact `OrderLinesCard` component under the current info card. It should show:

- line snapshot name and image
- ordered / procured / received / shipped / cancelled quantities
- per-line display status badge

If no `lines` exist, the card should stay hidden and the page should continue to work with legacy orders.

### 4. Quantity source correction

Update the edit modal and sales duplicate flow to initialize quantity from top-level `order.quantity`. `currentData.quantity` remains only a fallback for legacy payloads.

### 5. Filter contract alignment

Make the manage-order filter options and backend filtering operate on the same visible progress status vocabulary used by the list badge, so the UI no longer shows one status family while filtering on another.

## Testing Strategy

Add regression tests for:

1. Badge rendering of new line-level display statuses
2. Detail page rendering of `order.lines`
3. Edit modal quantity initialization from top-level `order.quantity`
4. Sales duplicate prefill quantity from top-level `order.quantity`
5. Manage-order progress filter contract if backend/frontend filter alignment is updated in this pass

## Success Criteria

This adaptation is complete when:

- Order list badges reflect `displayStatus`
- Order detail visibly shows line-level progress when `lines` are present
- Edit and duplicate flows no longer depend on `currentData.quantity`
- Order filter semantics match the statuses shown in the list
- Legacy orders without `lines` still render correctly

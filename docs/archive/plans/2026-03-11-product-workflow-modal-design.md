# Product Workflow Modal Design

**Date:** 2026-03-11

**Problem**

In the current product management flow, clicking `Edit` from product detail closes the detail modal immediately, then waits for hydrated product data before opening the edit modal. Under slow or unstable networks this creates a visible jump back to the product list, which breaks context and makes the action feel unreliable.

**Goal**

Keep the user inside a single product-focused workflow from detail to edit, even when network hydration is slow or fails.

---

## Current Behavior

- Product list opens detail through `ProductDetailModal`
- Detail header action triggers edit from `ProductManager`
- Edit flow closes detail first, then hydrates full product data, then opens `ProductCreateModal`
- If hydration is slow, the user briefly returns to the product list with no durable explanation

## UX Principles

- Preserve context: the user should remain inside the selected product workflow
- Make async state explicit: operations longer than roughly 300ms must show visible status
- Recover in place: failures should provide retry without ejecting the user
- Keep navigation single-path: canceling edit returns to detail, not the list

## Recommended Interaction Model

Use a single workflow modal with internal states instead of switching between two separate modals.

### States

- `detail`
- `edit_loading`
- `edit`

Hydration failure is rendered as an inline error within `detail` instead of introducing a separate full-screen state.

### User Flow

1. User opens a product from the list
2. Workflow modal opens in `detail`
3. User clicks `Edit Product`
4. Modal remains open and enters `edit_loading`
5. Existing detail content stays visible under a light loading layer
6. Hydration succeeds and modal content switches to `edit`
7. If the user cancels editing, modal returns to `detail`
8. If save succeeds, modal closes and the product list refreshes
9. If hydration fails, modal returns to `detail` and shows an inline retryable error

## Visual and Motion Guidance

### Detail to Loading

- Keep the modal shell, size, backdrop, and close control stable
- Disable the edit button and change its label to `正在准备编辑...`
- Apply a light overlay over the detail body instead of blanking the screen
- Show a compact loading card, not a full-screen spinner

Suggested loading copy:

- Title: `正在加载完整商品数据`
- Body: `正在同步规格、变体和库存信息`

### Loading to Edit

- Swap only the content region
- Use a short content transition around 150-220ms
- Respect `prefers-reduced-motion` and remove the transition when necessary

### Failure

- Remove the loading overlay
- Keep the user in detail
- Show a top inline alert near the edit action
- Include `重试` and `取消`
- Use `role="alert"` or `aria-live="polite"`

Suggested failure copy:

- `编辑器加载失败，请重试`

## Component Strategy

Introduce a container component, `ProductWorkflowModal.vue`, to own workflow state and modal chrome.

### Responsibilities

- Own `show`, `mode`, hydrated product, and retryable error state
- Render product detail content in `detail`
- Render edit form content in `edit`
- Render overlay and action feedback in `edit_loading`

### Reuse Plan

- Reuse `ProductDetail.vue` for detail presentation
- Extract the form body from `ProductCreateModal.vue` into a reusable embedded panel such as `ProductFormPanel.vue`
- Keep `ProductCreateModal.vue` as a thin wrapper around the extracted form panel for standalone create/edit flows if needed elsewhere

This avoids nested modals and keeps the workflow modal structurally consistent.

## Behavior Rules

- Clicking modal close exits the entire workflow from any state
- Clicking `Cancel` in edit returns to `detail`
- While `edit_loading`, suppress repeated edit clicks
- Save failures remain inside edit and use form-level error presentation
- Save success closes the workflow and refreshes the list

## Accessibility

- Maintain focus within one modal instead of jumping between dialogs
- Ensure loading and error text are announced to assistive tech
- Keep visible focus styles on header actions and retry controls
- Do not rely on color alone for error communication

## Mobile Notes

- Keep the loading card near the top portion of the content rather than dead center if center placement obscures too much context
- Preserve a clear back path from edit to detail
- Avoid stacked dialogs because mobile modal layering is harder to parse and dismiss

## Why This Design

The core issue is not raw latency. The issue is state transition timing. Closing detail before edit data is ready creates a false navigation event. A single workflow modal removes that break in the mental model and gives users a stable explanation of what the system is doing.

# Purchase Orders Overview Design

**Date:** 2026-03-12

**Goal:** Refine the purchase-order overview into a more polished modern SaaS management surface without changing existing interaction logic, backend behavior, or available actions.

**Scope:** `src/views/PurchaseOrders.vue` and any shared presentation primitives needed to support the page's visual hierarchy. Data flow, CRUD logic, modal flows, and status transitions remain unchanged.

---

## Problem

The current purchase-order overview already uses the shared management shell and table primitives, but the page still reads as a collection of adjacent blocks instead of a deliberate operations workspace.

Current pain points:

- the KPI row, list content, and detail modal compete for similar visual weight
- the list is functional but does not establish a strong scan order for procurement status, counts, and cost data
- the detail modal contains enough information, but the layout makes users work to locate status, progress, cost summary, and item data
- the page feels closer to an assembled internal tool than a finished SaaS admin surface

The target is not a workflow redesign. The target is a visual and structural refinement that improves readability, confidence, and perceived quality while preserving the current behavior contract.

---

## Constraints

- No changes to interaction logic
- No changes to data fetching or mutation flow
- No new actions, filters, or status transitions
- No page-local visual primitives that bypass the existing design system
- Must stay within the existing semantic token and shared component system

---

## Desired UX Outcome

When the user lands on the purchase-order overview, the page should support a stable reading path:

1. understand overall procurement state from the KPI row
2. scan the list quickly for the relevant purchase order
3. open detail and understand status, progress, cost, and items within a few seconds

The visual result should feel like a modern SaaS operations dashboard: clean, layered, restrained, and data-oriented rather than decorative or overly dense.

---

## Chosen Direction

Adopt a **modern SaaS operations** treatment on top of the existing shared shell.

This means:

- lighter panel framing instead of heavy boxed sections
- stronger hierarchy between summary, list, and detail layers
- restrained use of accent color only for active state, primary actions, and progress cues
- consistent spacing, typography, and card language across KPI cards, table content, and detail sections

This direction fits the user preference for a more polished SaaS feel while honoring the requirement to avoid behavior changes.

---

## Alternatives Considered

### Option 1: Conservative cleanup

Tighten spacing, unify borders, and improve card polish while leaving the page composition mostly unchanged.

Pros:

- lowest regression risk
- minimal implementation cost

Cons:

- the quality gain would be incremental rather than obvious
- the detail modal would still feel visually crowded

### Option 2: Modern SaaS refinement

Keep all existing information and interactions, but reorganize visual hierarchy across the overview and detail surfaces.

Pros:

- large perceived quality gain without changing logic
- preserves current behavior contract
- aligns with the requested style direction

Cons:

- requires coordinated adjustments across list, cards, and modal sections

### Option 3: Dense control-room styling

Increase information density and use stronger control-surface cues similar to trading or logistics consoles.

Pros:

- efficient for expert operators

Cons:

- visually harder and less aligned with the requested modern SaaS tone
- higher risk of feeling cramped

**Decision:** Option 2.

---

## Page Structure

### Header and Action Layer

Keep the existing title, description, and actions, but make them read as one cohesive command surface.

Visual rules:

- the title area and action group should feel aligned as a unified header
- `Create` remains the strongest visual action
- `Suggestions` remains secondary and should not compete with the create path
- spacing should feel tighter and more intentional than the current separated-block presentation

### KPI Overview Layer

Retain the six status cards and use them as the first scan target on the page.

Visual rules:

- unify card height, padding, icon treatment, and number emphasis
- make the active card state clear using combined background, border, and text contrast rather than color alone
- reduce noise in inactive cards so the selected state stands out without appearing loud
- preserve click behavior exactly as it works today

### Main List Layer

Treat the table and pagination as a single primary data panel.

Visual rules:

- lighter outer framing
- clearer column hierarchy for purchase-order number, status, cost, remark, and time
- stronger scan quality for numeric values and identifiers
- subtler separators and hover styling
- pagination should visually close the table panel rather than feeling detached

---

## Detail Modal Structure

The modal should be reorganized into four clear visual sections while preserving the same fields and actions.

### 1. Summary Header

Contains:

- purchase-order number
- status badge
- close action
- inline loading or retry messaging when needed

Intent:

- let the user immediately identify which order is open and its current state

### 2. Progress and Cost Layer

Pair the status stepper and cost summary into one high-priority summary region near the top of the body.

Intent:

- communicate process position and commercial impact before the user reaches item details

### 3. Item Detail Layer

Keep the item list but normalize each item into a clearer left/right rhythm.

Left side:

- image
- product name
- brand
- SKU
- source tags
- specification chips

Right side:

- quantity
- unit cost
- read-only or editable presentation based on existing draft status rules

Intent:

- reduce fragmentation and make repeated rows easier to scan

### 4. Action Footer

Keep the current status progression and action set, but present them as a consistent bottom action zone.

Intent:

- provide a predictable visual endpoint for the workflow
- clarify primary vs secondary vs destructive actions

---

## Visual Language

### Color

- Keep the page grounded in neutral light surfaces
- Use the brand/accent color for active filters, primary CTA, and progress emphasis
- Preserve semantic state colors for status, but avoid large saturated fills
- Reinforce trust by giving identifiers, costs, and primary text strong neutral contrast

### Panels and Cards

- Prefer a small number of main surfaces with gentle internal subdivision
- Use consistent rounded corners and restrained shadows
- Avoid stacked heavy borders or multiple competing card styles inside one modal

### Typography

- Establish three clear levels: page title, section title, supporting text
- Continue data-oriented font treatment for money and identifiers where already used
- Increase contrast between primary and secondary text so remarks and timestamps recede naturally

### Motion

- Use only short color/opacity transitions around 150-200ms
- Avoid scale or lift effects that make the admin UI feel ornamental
- Respect `prefers-reduced-motion`

---

## Accessibility and Quality Guardrails

- active states must not rely on color alone
- loading and failure messaging in the modal must remain programmatically announced
- clickable regions must preserve clear hover and focus states
- table behavior on smaller screens must avoid horizontal overflow regressions
- all image content in item rows must retain meaningful `alt` handling through the existing image component

---

## Testing Strategy

The change is visual, but it should still be locked with focused design-contract coverage where practical.

Recommended verification areas:

- purchase-order page still uses the shared management shell and frameless table contract
- KPI card selection state remains visible and behaviorally unchanged
- detail loading and retry states remain present after layout refinement
- no regressions in reduced-motion handling for page-local shimmer and transitions

---

## Implementation Notes

- Start from shared primitives only if the page cannot reach the desired hierarchy using the existing shell, metric tile, and table contracts
- Avoid adding bespoke CSS unless shared utilities cannot express the change cleanly
- Prefer token-backed utility classes over page-local hard-coded styling
- Keep the refactor scoped to presentation; if layout limitations expose component gaps, fill them at the shared component layer

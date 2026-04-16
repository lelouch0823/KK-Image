# Purchase Order Visual Cohesion Design

**Date:** 2026-04-01

**Goal:** Make the purchase-order management experience feel visually coherent and intentionally designed without changing data flow, interactions, or business behavior.

**Scope:** [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue) and any shared presentation primitives that are strictly necessary to support the page-level visual cleanup. The scope includes the overview page and the purchase-order detail modal.

## User-Approved Direction

The user approved:

- a **lightweight operations console** tone, not a hard logistics cockpit
- a **full-page** visual cleanup rather than fixing only one section
- inclusion of the **detail modal** so list and detail surfaces do not drift apart

## Problem

The purchase-order page is functional, but the visual language is fragmented:

- the top banner, KPI cards, table toolbar, and detail modal all compete for primary attention
- the page mixes shared management-shell patterns with page-local visual treatments that feel heavier and louder than the surrounding product
- numeric emphasis, gradients, badges, and color accents are used in too many places at once
- the detail modal reads like a separate design system instead of a continuation of the same workspace

The result is a page that feels busy rather than coordinated.

## Constraints

- no data-flow changes
- no CRUD or workflow logic changes
- no new filters, actions, or states
- keep the existing scan model where status cards act as filters and status plus receipt progress remain visible together
- stay inside the shared design-system hierarchy documented in [docs/design-system/MASTER.md](/home/bjw/Code/KK-Image/docs/design-system/MASTER.md)
- comply with the typography rules in [docs/design-system/typography.md](/home/bjw/Code/KK-Image/docs/design-system/typography.md)

## Desired UX Outcome

When a user lands on the page, the reading path should be stable:

1. quickly understand overall procurement state from the top overview
2. immediately transition into the table as the main work surface
3. open detail and remain inside the same visual system rather than entering a new one

The page should feel like a polished operations workspace: calm, data-oriented, and deliberate.

## Alternatives Considered

### Option 1: Conservative cleanup

Reduce visual noise with minor spacing and border adjustments only.

Pros:

- lowest regression risk
- minimal edit scope

Cons:

- likely to improve neatness more than actual cohesion
- would not fix the mismatch between list and detail modal

### Option 2: Lightweight operations console

Retain the current operational identity, but unify hierarchy, density, and emphasis across the page and detail modal.

Pros:

- strongest improvement in perceived quality without changing behavior
- matches the user's selected tone
- preserves the page's domain-specific identity

Cons:

- requires coordinated tuning across multiple sections rather than isolated tweaks

### Option 3: Dense procurement cockpit

Lean harder into a high-density logistics console aesthetic.

Pros:

- can feel very specialized and efficient for expert users

Cons:

- too hard-edged for the selected direction
- higher risk of increasing visual strain rather than reducing it

**Decision:** Option 2.

## Design Principles

### One Primary Surface

The table is the page's main work surface. The overview supports it, and the detail modal extends it. No other section should compete with the table for first-read dominance.

### Quiet by Default, Clear When Active

Most surfaces should remain visually calm. Selection, progress, and primary actions should stand out through combined contrast, border, and accent cues rather than broad saturation.

### Shared Surface Language

Overview cards, table-adjacent framing, and detail panels should use the same core panel rules:

- similar corner radii
- similar border strength
- restrained shadows
- neutral base surfaces with small semantic accents

### Data-First Emphasis

Identifiers, quantities, and monetary values should be easier to scan than supporting copy, but emphasis should come from consistent numeric treatment rather than page-local branding flourishes.

## Page-Level Design

### Header and Action Layer

Keep the existing management shell and actions. The `create` action remains the strongest CTA, while suggestions stay clearly secondary.

The header should feel aligned with the overview layer below it rather than detached from it.

### Overview Layer

The current hero-style overview should be reduced to a **light control header**:

- keep a soft atmospheric background treatment, but make it much lighter than the current banner
- reduce decorative gradients and competing badge treatments
- keep one compact context line showing the active filter and total count
- treat the six status cards as the main interaction affordance in this layer

The three lower summary cards should remain, but as quieter support signals rather than a second KPI headline row.

### Table Layer

The table should be the clearest visual focal point after the overview.

Rules:

- simplify the toolbar so it introduces the ledger without competing with the overview
- keep the `po number`, `status + progress`, and `cost` columns as the strongest scan anchors
- reduce row-level decorative blocks, especially around monetary values
- visually integrate pagination with the table panel so it feels like the table footer, not a detached strip

## Detail Modal Design

The modal should feel like the same workspace opened deeper, not a separate showcase.

### Modal Header

- keep the purchase-order number, current status, progress badge, and close action
- reduce banner-like gradient intensity
- preserve quick recognition without turning the header into a second hero section

### Summary Cards

Retain the current summary information, but lower its visual dominance:

- use quieter cards
- reduce oversized numeric styling
- keep the summary row subordinate to progress, cost, and line items

### Progress and Cost Panels

Progress and cost stay as the top-priority body panels, but they should share one panel grammar:

- matching panel framing
- restrained, related surface treatments
- semantic accents only where needed for workflow or cost cues

They should feel like coordinated companions rather than unrelated blue and amber feature cards.

### Item List

Item rows should read with a stable left-right rhythm:

- left side: identity, source, SKU, variant/spec chips, progress metadata
- right side: quantity, unit cost, total cost, and allocated-cost hints

Item cards should lose unnecessary decorative color while preserving scan clarity and status readability.

### Receipt Ledger

The receipt section should read as an operational ledger:

- neutral framing
- event sequence and reversal affordance clearly visible
- action buttons visible, but not louder than the section content

## Visual Rules

### Color

- neutral surfaces first
- blue reserved for primary action, active selection, and workflow emphasis
- amber reserved for reminders or cost-related secondary emphasis
- semantic status colors remain in badges and small indicators, not broad panel fills

### Typography

- remove page-local `font-[Outfit]` usage from this page
- use the shared UI sans for titles, labels, and body text
- use shared mono or tabular numeric treatment for IDs, quantities, and money where emphasis is needed
- reduce oversized numeric dominance in summary areas

### Density and Spacing

- overview slightly compact
- table comfortable and scan-friendly
- modal sections spaced consistently with fewer abrupt shifts in density

### Motion

- short color and opacity transitions only
- no ornamental lift or heavy glow treatments
- preserve accessible focus and reduced-motion behavior

## Acceptance Criteria

- the overview, table, and detail modal feel like one coordinated purchase-order workspace
- the table clearly reads as the page's primary work surface
- active filters and statuses remain obvious without relying on color alone
- the detail modal no longer feels like a separate visual theme
- page-local `font-[Outfit]` usage is removed from the purchase-order view
- no interaction, data, or workflow behavior changes are introduced

## Implementation Notes

- Prefer editing the purchase-order view first before broadening shared-component scope.
- Reuse existing design-system primitives wherever possible.
- Only modify shared primitives if the page cannot achieve the approved direction cleanly without them.
- Keep current test anchors that protect the shell, overview strip, modal shell, and status cells.

## Verification Notes

Planning and implementation should verify:

- overview card filtering still behaves exactly the same
- table scan anchors remain present
- modal loading, retry, receipt, and shortage flows remain reachable
- no design-system typography rule regressions are reintroduced on this page

# Product Binding Mobile UX Design

**Date:** 2026-03-09

**Goal**

Improve the mobile presentation of `ProductBindingSection` so it feels more refined and less oversized, while preserving the current information architecture and variant-selection behavior.

**Problem Summary**

On small screens, the section feels visually heavy for three reasons:

1. Multiple stacked containers use generous padding and gaps, which makes the section taller than necessary.
2. The bound-product header block gives too much emphasis to the image and wrapper chrome.
3. The inventory footer and option selectors add extra card-like weight instead of reading as compact supporting information.

**Chosen Direction**

Use a hybrid approach:

1. Reduce mobile density by roughly 15% to 25% in spacing and visual block size.
2. Keep desktop spacing largely unchanged.
3. Pair the density reduction with lighter visual hierarchy so the section looks more premium instead of merely compressed.

**Scope**

In scope:

1. Mobile-first spacing, sizing, and hierarchy updates inside `src/components/order/ProductBindingSection.vue`
2. Minor responsive polish for action buttons, badges, selectors, and inventory summary
3. Component tests that lock the intended class-level responsive structure

Out of scope:

1. New product-binding behavior
2. Data shape or event contract changes
3. Rebuilding the product selector itself

**Design Changes**

### 1. Outer Card and Header

Keep the current card shell, but reduce the visual weight of the header on mobile:

1. Slightly tighter header padding
2. Less prominent muted background treatment
3. Preserve title and icon, but keep the first visual band thinner

Result: the section starts faster and feels less top-heavy.

### 2. Bound Product Summary

Reshape the bound-product area into a tighter mobile summary:

1. Shrink the image footprint on mobile
2. Tighten title, SKU, and badge spacing
3. Keep action buttons touch-safe, but reduce their visual bulk
4. Improve horizontal wrapping so the title row feels cleaner

Result: the selected product still reads as the focal object, but no longer dominates the screen height.

### 3. Variant Configuration Area

Reduce unnecessary vertical spread while preserving scanability:

1. Lower mobile `space-y` between sections
2. Tighten the label and selected-value row
3. Keep option buttons readable, but make them less blocky
4. Keep color swatches tap-friendly while reducing label footprint

Result: the configuration area feels denser and more intentional, without becoming cramped.

### 4. Inventory Footer

Convert the footer from a heavy mini-card into a lighter stats strip:

1. Reduce padding
2. Lower contrast of the container background
3. Keep stock and replenishment values readable, but visually subordinate them to the selectors

Result: the footer supports the decision instead of competing with it.

### 5. Interaction and Accessibility

Preserve or improve usability while compacting layout:

1. Mobile tap targets for icon actions remain at least 44x44
2. Focus states remain visible
3. Selector spacing keeps at least an 8px gap where controls are adjacent
4. No horizontal overflow on narrow screens

**Testing Strategy**

Add or extend component tests to verify the responsive structure using rendered classes:

1. Header uses the tighter mobile padding classes
2. Bound product summary uses reduced mobile image sizing and spacing classes
3. Inventory footer uses lighter mobile spacing classes
4. Existing variant-selection behavior remains unchanged

**Acceptance Criteria**

1. On mobile widths, `ProductBindingSection` is visibly shorter and less bulky than before.
2. The section still reads clearly in this order: title, bound product, variant selectors, inventory summary.
3. Action buttons remain easy to tap.
4. Existing selection and availability behavior is unchanged.

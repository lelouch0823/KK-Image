# Product Binding Mobile Detail Polish Design

**Date:** 2026-03-09

**Goal**

Polish the compact mobile version of `ProductBindingSection` so it feels more premium without further shrinking the layout or changing behavior.

**Context**

The previous pass fixed the oversized mobile presentation by tightening spacing and reducing block weight. The remaining issue is not density, but finish: some meta surfaces still read like default form UI instead of a refined product configuration card.

**Chosen Direction**

Apply detail polish only. Keep the current layout structure, spacing rhythm, and interaction model.

**Design Changes**

### 1. Product Meta Hierarchy

The product name remains the primary visual anchor. SKU should read as supporting metadata, not as a pill competing with the title.

Planned adjustments:

1. Reduce SKU contrast slightly through lighter background and border treatment
2. Make the SKU chip feel more editorial and less button-like
3. Keep the availability badge stable and visually cleaner through more consistent padding and border treatment

### 2. Inventory Strip Finish

The inventory area should feel like a compact summary bar rather than a sub-card.

Planned adjustments:

1. Keep the lightweight container from the previous pass
2. Add subtle internal separation between stock and replenishment stats
3. Push labels further into the background while keeping values crisp

### 3. Selector Surface Polish

The selector controls should retain their current size and tap safety, but look less coarse.

Planned adjustments:

1. Soften the default unselected border treatment
2. Make selected options feel more deliberate through cleaner contrast and light background support
3. Preserve current compact density and selection logic

**Out of Scope**

1. Further mobile density reduction
2. Selector behavior changes
3. Data or event changes

**Testing Strategy**

Add one small component test that verifies:

1. SKU chip uses the refined lighter treatment
2. Availability badge includes the new subtle border token
3. Inventory stats wrapper includes the new internal separator token
4. Option buttons use the refined unselected/selected surface tokens

**Acceptance Criteria**

1. The section remains as compact as the current version.
2. Metadata surfaces feel less heavy and more product-like on mobile.
3. No behavior regressions are introduced.

# UI Design System Closure Design

**Date:** 2026-03-11

**Scope**

This design defines a long-running, gradual UI system closure for the KK-Image frontend.

Included in scope:

- design token reconstruction
- foundation and composed component redesign
- page pattern and shell standardization
- migration sequencing for core admin, sales, and public pages
- governance rules to prevent regression into ad hoc UI code

Excluded from scope:

- business capability redesign
- router or information architecture rewrite
- backend data model changes unrelated to UI needs
- one-shot full visual rewrite of every page in a single release

---

## Problem

The current frontend has design debt at four connected layers:

- token layer is incomplete, inconsistent, and contains undefined aliases
- component layer is partial, so pages often bypass shared components
- page layer has multiple independent visual languages across modules
- governance layer is absent, so new ad hoc UI patterns continue to enter the codebase

This means the project has the appearance of a design system without the enforcement or reliability of one.

## Goal

Establish a gradual closed-loop frontend design system where:

- tokens are the only source of visual primitives
- shared components are the only source of common interactions
- page templates are the default composition unit for high-frequency workflows
- governance rules stop new divergence from entering the codebase

The target outcome is not a rewrite. It is a staged transition from fragmented UI to a single dependable system.

## Core Principle

**No page should invent visual rules that belong to tokens, components, or page patterns.**

Every visual or interaction rule must have an explicit home:

- token
- foundation component
- composed component
- page pattern

If a rule does not belong to one of those layers, it does not belong in the page.

## Design Direction

This design uses `ui-ux-pro-max` as a method input, but adapts it to the project's existing realities.

### Selected Direction

- overall UI language: data-dense dashboard
- layout discipline: Swiss-style grid clarity and mathematical spacing
- accessibility baseline: WCAG AA minimum
- interaction timing: 150-300ms micro-interactions
- motion discipline: transform and opacity only, respect reduced motion

### Rejected Direction

- full visual rebrand around a new purple-first brand language
- decorative glassmorphism as a default page material
- module-specific bespoke typography or icon systems

### Brand Strategy

Keep the current orange brand identity as the primary action and product accent.

Standardize the rest of the semantic palette around:

- brand/action: orange
- informational/data: blue
- success: green
- warning: amber
- danger: red
- analytical/supporting accent: purple, but never as the new primary brand color

### Typography Strategy

Use one primary UI sans family and one data/mono family.

Recommended structure:

- UI sans: Noto Sans SC or equivalent production-safe modern sans for Chinese-heavy usage
- data/mono: JetBrains Mono or Fira Code

Rules:

- no page-specific headline font experiments
- no arbitrary `font-[...]` classes in page code
- mono only for IDs, SKUs, codes, tabular numeric emphasis, and technical readouts

### Icon Strategy

Use a single SVG icon system through `AppIcon`.

Rules:

- remove new usage of Material Symbols in page code
- remove new hand-built icon object usage from page-level components
- normalize icon box sizing and visual weight across the system

## Success Criteria

The design system closure is considered successful when all of the following are true:

- token files contain no undefined aliases or pseudo variables
- foundation components cover the majority of common interaction needs
- core pages no longer define their own button, input, modal, or stat-card systems
- page templates exist for the highest-frequency workflows
- lint and review rules block newly introduced ad hoc UI patterns

## Four-Layer Architecture

### 1. Token Layer

Tokens must be split into four categories:

- primitive
- semantic
- component alias
- chart and special-purpose tokens

Rules:

- pages do not use primitive tokens directly
- semantic tokens are the default dependency for components and pages
- component aliases exist only where a shared component needs a stable contract
- chart and special tokens remain semantic, not page-local hardcoded colors

Examples of semantic intent:

- canvas background
- primary surface
- muted surface
- primary text
- secondary text
- default border
- focus ring
- action primary background
- status success foreground

### 2. Foundation Component Layer

Foundation components own the default interaction contracts for the product.

This layer includes:

- buttons
- text inputs
- textareas
- selects
- checkboxes
- switches
- cards
- tables
- badges
- modals
- drawers
- tooltips
- skeletons

Rules:

- pages do not re-implement these primitives
- each foundation component must map cleanly to semantic tokens
- foundation components must support both light and dark themes without page-local patching

### 3. Composed Component Layer

Composed components provide reusable workflow building blocks above raw controls.

This layer includes:

- page header
- filter bar
- search bar
- stat card
- stat group
- section card
- detail section
- action bar
- empty state
- error state
- permission state
- pagination bar
- toolbar

Rules:

- business modules should prefer composed components before inventing local layout patterns
- repeated page structures should be extracted here before spreading across modules

### 4. Page Pattern Layer

Page patterns define the canonical shells for common workflow types.

First-wave patterns:

- dashboard shell
- management list shell
- workflow detail shell
- public viewer shell
- mobile sales shell

Rules:

- page patterns own layout composition rules
- domain pages assemble business content inside a shell, not from scratch
- module-level visual differentiation is allowed only inside the shared system, not outside it

## Recommended Filesystem Structure

```text
src/
  styles/
    tokens/
      primitive.css
      semantic.css
      motion.css
      charts.css
      themes.css
    foundations.css
    patterns.css
    main.css

  design-system/
    foundation/
    composed/
    patterns/

  components/
    domain/
```

This structure separates visual system ownership from business-domain ownership.

## Migration Strategy

This effort should proceed on three concurrent tracks, with one track acting as the control plane.

### Track A: Design Core

Primary track.

Responsible for:

- token rebuild
- foundation components
- composed components
- page shells
- lint and documentation

### Track B: Demonstration Pages

Validation track.

First migration targets:

- `Dashboard.vue`
- `Stats.vue`
- `GoodsOverview.vue`
- `PurchaseOrders.vue`

These pages are intentionally selected because they currently expose the most visible UI inconsistency and the most repeated patterns.

### Track C: Governance

Protection track.

Responsible for:

- lint rules for forbidden hardcoded styles
- deprecation rules for legacy shared components
- migration inventory
- review checklist
- documentation updates

## Phase Plan

### Phase 1: Rebuild the Core

Deliverables:

- repaired token graph
- foundation component redesign v1
- composed component redesign v1
- page shell APIs for list, dashboard, and workflow detail

Success condition:

- a new page can be built without inventing local visual rules

### Phase 2: Migrate Demonstration Pages

Deliverables:

- dashboard migrated
- stats migrated
- goods overview migrated
- purchase orders migrated

Success condition:

- these pages look and behave like one product and validate the new system

### Phase 3: Module Rollout

Deliverables:

- file manager migration pack
- products and orders migration pack
- customers and settings migration pack
- sales and public pages migration pack

Success condition:

- most high-traffic modules are inside the new shells and component contracts

### Phase 4: Governance Closure

Deliverables:

- lint protections
- deprecated component inventory
- migration checklist
- CI or review enforcement

Success condition:

- new UI code cannot silently reintroduce divergence

## Governance Rules

The system is not closed until these rules are enforced:

- pages may not define brand colors directly
- pages may not create local modal backdrops or default input/button systems
- new icons must go through the shared icon system
- new typography choices must come from the shared type scale and font families
- missing shared capability must be added to the system, not patched in one page

## Risks

### Risk 1: Component Buildout Stalls Before Page Value Appears

Mitigation:

- pair core system work with demonstration-page migration

### Risk 2: Pages Continue to Patch Around Missing Features

Mitigation:

- require component backfill before page-local workaround acceptance

### Risk 3: Dark Mode Regressions During Token Rewrite

Mitigation:

- validate each foundation component in light and dark before migration

### Risk 4: Scope Explosion

Mitigation:

- keep business logic, routing, and data semantics out of this program unless required by UI boundaries

## Why This Design

The project does not need a cosmetic refresh. It needs a system that can absorb future UI work without spawning new design debt.

The gradual-closure strategy is the correct balance because it preserves delivery momentum while replacing the current broken hierarchy:

- token without enforcement
- components without coverage
- pages without templates
- standards without governance

The result is a single path from design decision to shipped page, with no orphan layer in the middle.

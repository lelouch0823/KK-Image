# UI Design System Migration Checklist

**Date:** 2026-03-11

This checklist tracks the current UI debt inventory and the rollout status of the gradual design-system closure program.

---

## 1. Token Debt

### Critical

- [ ] Remove undefined token aliases from production UI code
- [ ] Remove pseudo variables such as `varinfo`, `varsuccess`, `vardanger`, `varwarning`
- [ ] Define semantic replacements for ad hoc aliases such as `--bg-input`, `--bg-subtle`, `--text-quaternary`, `--bg-card-hover`
- [ ] Remove component references to nonexistent hover tokens such as `--color-danger-hover`

### Structural

- [ ] Split token files into `primitive`, `semantic`, `motion`, `charts`, and `themes`
- [ ] Ensure pages use semantic tokens only
- [ ] Ensure foundation components map to semantic tokens only
- [ ] Centralize dark-mode overrides in the theme layer

### Visual Consistency

- [ ] Keep orange as the product brand/action color
- [ ] Normalize status colors across admin, sales, and public pages
- [ ] Standardize chart color semantics
- [ ] Standardize shadows, borders, radii, and surface hierarchy

---

## 2. Foundation Component Debt

### Current Gaps

- [ ] `AppButton` variants rely on mixed token and hardcoded styling
- [ ] `AppInput` uses invalid background token references
- [ ] `AppCard` is not yet the sole card contract for high-frequency UI
- [ ] `AppTable` is used selectively, with page-local table systems still present
- [ ] `Modal` is not the sole source of modal container and backdrop behavior
- [ ] `ConfirmDialog`, `EmptyState`, `PermissionDeniedState`, and `AsyncStatePanel` do not share one severity and state hierarchy

### Required Coverage

- [ ] Button
- [ ] Input
- [ ] Textarea
- [ ] Select
- [ ] Checkbox
- [ ] Switch
- [ ] Card
- [ ] Table
- [ ] Badge
- [ ] Modal
- [ ] Drawer
- [ ] Tooltip
- [ ] Skeleton
- [ ] Empty/Error/Permission states

---

## 3. Composed Component Gaps

- [ ] Shared page header contract
- [ ] Shared filter bar contract
- [ ] Shared search bar contract
- [ ] Shared stat card/stat group contract
- [ ] Shared section card contract
- [ ] Shared detail section contract
- [ ] Shared action bar contract
- [ ] Shared pagination bar contract
- [ ] Shared toolbar contract
- [ ] Shared state panel contract

---

## 4. Page Pattern Candidates

### First-Wave Patterns

- [ ] Dashboard shell
- [ ] Management list shell
- [ ] Workflow detail shell
- [ ] Public viewer shell
- [ ] Mobile sales shell

### Pattern Validation Questions

- [ ] Can the pattern express loading, empty, error, and permission states?
- [ ] Can the pattern express action and filter zones without page-local inventions?
- [ ] Can the pattern support both desktop and mobile usage without style forks?
- [ ] Can the pattern be reused by at least two modules?

---

## 5. Cross-Cutting UI Debt

### Icons

- [ ] Remove page-level Material Symbols usage
- [ ] Remove page-level custom icon-object systems where `AppIcon` should apply
- [ ] Standardize icon sizing and visual weight

### Typography

- [ ] Remove arbitrary page-level `font-[...]` usage
- [ ] Remove `font-display` drift
- [ ] Remove `Outfit` as a page-local numeric brand style
- [ ] Standardize one UI sans and one mono family

### Motion

- [ ] Remove decorative infinite animations outside loading contexts
- [ ] Respect `prefers-reduced-motion`
- [ ] Normalize interaction transitions to 150-300ms
- [ ] Prefer transform/opacity over layout-shifting animation

### Accessibility

- [ ] Ensure visible focus states on all interactive controls
- [ ] Ensure error states are announced with `role="alert"` or equivalent
- [ ] Ensure color contrast meets WCAG AA
- [ ] Ensure hover-only cues are not required for core actions

---

## 6. Demonstration Page Migration Status

### Core Validation Set

- [ ] `src/views/Dashboard.vue`
- [ ] `src/views/Stats.vue`
- [ ] `src/views/GoodsOverview.vue`
- [ ] `src/views/PurchaseOrders.vue`

### Success Standard For Each

- [ ] Uses shared page shell
- [ ] Uses shared stat/list/filter/detail patterns
- [ ] Uses shared state components for loading/empty/error/permission
- [ ] Does not define its own visual primitive system

---

## 7. Module Rollout Status

### Admin

- [ ] File Manager
- [ ] Product Management
- [ ] Order Management
- [ ] Customer Management
- [ ] Settings
- [ ] Space Management

### Sales

- [ ] Sales shell
- [ ] Sales list
- [ ] Sales detail
- [ ] Sales stats
- [ ] Sales spaces

### Public

- [ ] Gallery
- [ ] Space
- [ ] Password gate flows

---

## 8. Governance Closure

- [ ] Add QA or lint rule for forbidden token names
- [ ] Add QA or lint rule for forbidden direct brand hex usage in page code
- [ ] Add QA or lint rule for Material Symbols reintroduction
- [ ] Add design-system reference docs
- [ ] Add deprecated component policy
- [ ] Add migration-status ownership and review checklist

---

## 9. Implementation Order

### Phase 1

- [ ] Token repair and split
- [ ] Foundation component rebuild v1
- [ ] Composed component buildout v1
- [ ] Page shell buildout v1

### Phase 2

- [ ] Dashboard migration
- [ ] Stats migration
- [ ] Goods overview migration
- [ ] Purchase orders migration

### Phase 3

- [ ] File manager migration pack
- [ ] Product and order management migration pack
- [ ] Customers and settings migration pack
- [ ] Sales and public pages migration pack

### Phase 4

- [ ] Governance rollout
- [ ] CI/review guardrails
- [ ] Final legacy cleanup pass

---

## 10. Definition of Closed Loop

The program is complete only when all of the following are true:

- [ ] New UI work enters through tokens, components, or patterns rather than page-local styling
- [ ] Demonstration pages validate the new system
- [ ] Remaining modules are migrated or explicitly tracked as legacy
- [ ] Governance checks block regression
- [ ] The project no longer contains orphan visual rules with no system owner

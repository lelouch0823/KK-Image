# Design System Master

## Source of Truth

The frontend design system is organized in this dependency order:

1. `src/styles/tokens/*`
2. `src/components/ui/*`
3. `src/design-system/composed/*`
4. `src/design-system/patterns/*`
5. domain views and domain components

Pages must consume the system in that order and must not define their own visual primitives.

Supporting contracts:

- `docs/design-system/foundations.md`
- `docs/design-system/patterns.md`
- `docs/design-system/typography.md`
- `docs/design-system/iconography.md`
- `docs/design-system/status-tone-contract.md`
- `docs/design-system/minisales-token-contract.md`

## Layer Ownership

- Tokens own values only: colors, typography primitives, spacing, radius, shadows, overlays, motion.
- Foundation components own controls and interaction states: button, input, select, table, modal, badge, empty state, permission state, tooltip, skeleton.
- Composed components own reusable UI structures built from foundation: headers, action bars, summary strips, overlay scaffolds, callout panels, reusable surface sections.
- Patterns own page-level shells only: dashboard, management list, workflow detail, public viewer, mobile sales.
- Domain views and domain components compose the layers above and may not create parallel visual systems.

## Required Rules

- Use semantic tokens, not ad hoc colors
- Use the platform shared icon entry point, not page-local icon systems
- Use shared page shells for dashboard and management-list layouts
- Add missing UI capability to the system before patching one page
- Keep status and tone mapping in one shared contract per platform
- Add new reusable surfaces to `ui` or `design-system/composed` before repeating them in domain code
- Treat minisales as a separate implementation surface with the same contract vocabulary and ownership model

## Forbidden in Production UI

- `material-symbols-outlined`
- production-path local `svg` glyph systems when `AppIcon` should own the glyph
- pseudo token values like `varinfo`, `varsuccess`, `vardanger`, `varwarning`
- invalid aliases like `--bg-input`, `--bg-subtle`, `--text-quaternary`, `--bg-card-hover`
- direct brand hex literals in page code
- `font-[Outfit]`, `font-display`, or page-local font-family experiments
- business-layer modal or drawer chrome that bypasses `Modal` and shared overlay primitives
- local status `hex` or `rgba` maps in business modules
- minisales `style="{{color/background}}"` status injection or controller-owned card palettes

## Platform Contract Rules

- Web and minisales may use different component files, but they must share the same tone/status ownership model.
- Web must use `AppIcon` as the shared product icon entry point.
- minisales must use one shared minisales icon entry point for product UI glyphs.
- Each platform may define status mapping only inside one shared contract, with at most one shared mapping source per UI primitive family.
- Status labels may be domain-specific; status colors, surfaces, and emphasis rules may not.
- If a page or module needs a new visual primitive, add it below the page layer first, then consume it.

## Overlay Surface Policy

- Overlay mask, elevation, radius, spacing, header/footer framing, and action placement are shared design-system concerns.
- Foundation owns the base modal behavior.
- Composed components own reusable overlay scaffolds and shared internal overlay sections.
- Domain modules may supply content and workflow state, but may not create parallel modal or drawer chrome systems.
- If an overlay pattern repeats across modules, it must move into `src/components/ui` or `src/design-system/composed`.

## Rollout Order

1. Tokens
2. Foundation components
3. Composed components
4. Page shells
5. Demonstration pages
6. Remaining modules
7. Governance enforcement

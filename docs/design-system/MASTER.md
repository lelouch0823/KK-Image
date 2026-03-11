# Design System Master

## Source of Truth

The frontend design system is organized in this dependency order:

1. `src/styles/tokens/*`
2. `src/components/ui/*`
3. `src/design-system/composed/*`
4. `src/design-system/patterns/*`
5. domain views and domain components

Pages must consume the system in that order and must not define their own visual primitives.

## Required Rules

- Use semantic tokens, not ad hoc colors
- Use `AppIcon`, not page-local icon systems
- Use shared page shells for dashboard and management-list layouts
- Add missing UI capability to the system before patching one page

## Forbidden in Production UI

- `material-symbols-outlined`
- pseudo token values like `varinfo`, `varsuccess`, `vardanger`, `varwarning`
- invalid aliases like `--bg-input`, `--bg-subtle`, `--text-quaternary`, `--bg-card-hover`
- direct brand hex literals in page code

## Rollout Order

1. Tokens
2. Foundation components
3. Composed components
4. Page shells
5. Demonstration pages
6. Remaining modules
7. Governance enforcement

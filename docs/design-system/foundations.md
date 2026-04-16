# Foundations

## Foundation Components

Current foundation layer lives in `src/components/ui`.

Core contracts:

- `AppButton`
- `AppInput`
- `AppCard`
- `AppTable`
- `Modal`
- `ConfirmDialog`
- `StatusBadge`
- `EmptyState`
- `PermissionDeniedState`
- `Skeleton`
- `Tooltip`

Supporting contracts:

- `docs/design-system/status-tone-contract.md`
- `docs/design-system/typography.md`
- `docs/design-system/iconography.md`

## Rules

- Foundation components own default interaction behavior
- Shared components may not hardcode white/gray utility design language when semantic tokens should be used
- Focus, hover, disabled, and dark-mode behavior must be stable at this layer
- New design-contract tests should be added before changing shared contracts
- Foundation is the only place that may define base button, input, select, checkbox, modal, badge, and table interaction contracts
- Domain code must not recreate foundation controls with raw `button`, `input`, `select`, or `textarea` plus local utility styling
- Foundation components must consume shared tone/status contracts instead of local color maps
- Foundation components must consume `AppIcon` for product UI glyphs unless the content is user-authored media or a brand asset
- Foundation components may not introduce second visual systems for cards, badges, demos, or permission states

## What Foundation Owns

- Keyboard, hover, focus, pressed, disabled, and loading states
- Shared control density and spacing rules
- Shared border, radius, shadow, and background contracts for controls
- Shared status/tone rendering for primitive status controls such as badges and selectors

## What Foundation Does Not Own

- Page shells
- Domain-specific workflows
- Module-local status palettes
- Module-local dialog and drawer chrome
- Summary, metric, and multi-region status surfaces that combine layout structure with tone rendering

## Enforcement

- If a domain needs a control capability that foundation does not expose, extend foundation first.
- If a change alters a foundation contract, update or add design-contract tests in the same change.

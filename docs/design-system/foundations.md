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

## Design Token System

All styling must use the three-tier token architecture in `src/styles/tokens/`. No hardcoded hex colors, font sizes, or inline `:style` for static token values.

### Token Layers

| Layer | File | Purpose |
|-------|------|---------|
| Primitive | `tokens/primitive.css` | Raw palette, radii, shadows, font-size scale |
| Semantic | `tokens/semantic.css` | Light-mode contextual aliases (bg/border/text) |
| Dark Theme | `tokens/themes.css` | `.dark` overrides for all semantic tokens |
| Motion | `tokens/motion.css` | Transition timing tokens |
| Charts | `tokens/charts.css` | Chart color palette |

### Font-Size Scale

| Token | Value | Tailwind |
|-------|-------|----------|
| `--text-[10px]` | 0.625rem | `text-[10px]` |
| `--text-xs` | 0.75rem | `text-xs` |
| `--text-sm` | 0.875rem | `text-sm` |
| `--text-base` | 1rem | `text-base` |
| `--text-lg` | 1.125rem | `text-lg` |
| `--text-xl` | 1.25rem | `text-xl` |

### Required Pattern

```vue
<!-- ✅ Tailwind utility with token reference -->
<div class="bg-(--bg-card) text-(--text-main) border-(--border-color)">

<!-- ❌ Inline style with static token -->
<div :style="{ backgroundColor: 'var(--bg-card)' }">

<!-- ❌ Hardcoded hex -->
<div style="color: #6b7280">
```

### Border-Radius Convention

- Card-level containers: `rounded-2xl`
- Smaller elements (icons, badges, buttons): `rounded-lg` / `rounded-xl`

### Legitimate Inline `:style`

- Dynamic computed values (progress bars, virtual scroll, drag position)
- User-configured values (print accent color, custom themes)
- CSS calculations that depend on runtime data

### Checklist

- Search for `:style` bindings — static token references must be Tailwind utility classes
- Search for hex color literals — replace with token references
- Verify card containers use `rounded-2xl`
- Run `pnpm qa:check-design-system` after styling changes

## Enforcement

- If a domain needs a control capability that foundation does not expose, extend foundation first.
- If a change alters a foundation contract, update or add design-contract tests in the same change.

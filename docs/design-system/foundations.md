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

## Rules

- Foundation components own default interaction behavior
- Shared components may not hardcode white/gray utility design language when semantic tokens should be used
- Focus, hover, disabled, and dark-mode behavior must be stable at this layer
- New design-contract tests should be added before changing shared contracts

# Iconography

## Rule

`AppIcon` is the single icon entry point for product UI.

## Do

- Add new icons to `src/components/ui/AppIcon.vue`
- Keep icons in a consistent 24x24 or 20x20 system
- Use consistent visual weight by context

## Do Not

- Add new `material-symbols-outlined` usage in production UI
- Build page-local icon object systems when `AppIcon` should own the glyph
- Mix multiple icon families within one page section

## Migration Priority

1. Replace dashboard Material Symbols usage
2. Replace high-visibility shared component and product builder usage
3. Remove remaining Material Symbols only after all production references are migrated

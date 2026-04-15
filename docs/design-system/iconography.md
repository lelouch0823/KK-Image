# Iconography

## Rule

- Web: `AppIcon` is the single icon entry point for product UI.
- minisales: one shared minisales icon entry point must own product UI glyphs.

## Do

- Add new Web product UI icons to `src/components/ui/AppIcon.vue`
- Add new minisales product UI icons to the shared minisales icon entry point, not to page-local files
- Keep icons in a consistent 24x24 or 20x20 system
- Use consistent visual weight by context
- Use the same icon entry point inside shared components, page views, drawers, tables, and status surfaces
- Treat Web and minisales as separate implementations of the same ownership rule: one shared icon entry point per platform

## Do Not

- Add new `material-symbols-outlined` usage in production UI
- Build page-local icon object systems when `AppIcon` should own the glyph
- Mix multiple icon families within one page section
- Add inline `svg` product UI glyphs in views or business components when the icon is not user content or a brand asset
- Keep dead compatibility classes or styles that preserve old icon systems after migration

## Exceptions

- User-authored SVG content
- Brand assets or third-party marks that are not part of the product icon system
- Non-product illustration assets

These exceptions must not become alternate icon systems for product UI controls.

## Migration Priority

1. Replace dashboard Material Symbols usage
2. Replace high-visibility shared component and product builder usage
3. Remove remaining Material Symbols only after all production references are migrated

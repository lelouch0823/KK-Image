# Typography

## Rule

Use one primary UI sans family and one mono family across the product.

## Current Direction

- UI sans: shared application sans only
- Mono: shared mono family for IDs, order numbers, SKUs, technical values, and tabular numeric emphasis

## Do

- Use shared heading weights and size scale
- Use mono only for technical or numeric emphasis
- Keep page titles and section titles inside the shared sans family
- Keep chart labels, legend labels, drawer metadata, and status metadata inside the same shared family rules
- Route numeric emphasis through the shared mono or documented numeric emphasis contract, not page-local branding fonts

## Do Not

- Add page-local `font-[...]` experiments
- Reintroduce `font-display`
- Use `Outfit` or similar as a module-local numeric branding shortcut
- Hardcode chart library font families in component code
- Mix multiple sans families within a single page section or workflow

## Ownership

- Token and global style layers own font family values.
- Foundation and composed layers may choose semantic typography roles such as title, label, helper, code, numeric emphasis.
- Domain code may choose roles, but may not introduce new families.

## Exceptions Policy

- Typography exceptions are opt-in and rare.
- Allowed exception classes:
  - user-authored rich text content
  - third-party embedded content that cannot inherit the product type system
  - legal or brand assets that are not part of the product UI language
- A module may not create a typography exception for numeric branding, charts, dashboards, procurement, or other product UI convenience.
- Any new exception must be documented in the relevant design-system doc before implementation.

## Migration Priority

1. Remove `font-display`
2. Remove `font-[Outfit]` from high-visibility dashboard and procurement pages
3. Normalize numeric emphasis with the shared mono family where needed

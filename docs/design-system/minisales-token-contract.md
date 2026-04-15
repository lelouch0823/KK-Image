# Minisales Token Contract

## Purpose

Define how minisales should express the same design-system ownership model without reusing Web Vue component files directly.

## Ownership Model

- `minisales/miniprogram/styles/variables.scss` owns raw values and semantic aliases.
- shared minisales primitives own shared controls and base interaction presentation.
- shared minisales composed surfaces own reusable multi-region surfaces, status-bearing panels, and overlay scaffolds.
- page files compose shared minisales surfaces and tokens.
- controller and component TS files own state and data shaping, not color composition.

## Required Token Categories

minisales must express reusable semantic tokens for:

- surface backgrounds
- text emphasis levels
- border emphasis levels
- overlay masks
- overlay shadows
- chip radius and surface radius
- shared spacing steps
- status/tone hooks

## Naming Rules

- Prefer semantic names over page names.
- Good:
  - `surface-page`
  - `surface-card`
  - `surface-muted`
  - `text-primary`
  - `text-secondary`
  - `border-default`
  - `overlay-mask`
  - `shadow-overlay`
  - `tone-success-surface`
- Avoid:
  - `stats-blue-card`
  - `detail-purple-chip`
  - `login-bg-1`
  - `order-card-warning-2`

## Shared Surface Rules

If a UI shape appears in more than one minisales page or component, promote it into a shared minisales surface. Common candidates include:

- status chip
- surface card / section card
- overlay panel / drawer shell
- shared section header
- resource or summary tile

## Overlay Surface Policy

- Overlay masks, panel elevation, panel radius, internal spacing, and footer action placement must come from shared minisales surfaces.
- Page files may choose overlay content and flow state, but may not define parallel drawer or modal chrome systems.
- If more than one minisales feature needs the same drawer, picker, or sheet structure, it must be promoted into a shared minisales surface before further reuse.

## Banned Patterns

- page or controller-owned card palette strings
- page-local status `hex` maps
- repeated `rgba(...)` overlay recipes in feature files
- direct `style="{{color/background}}"` composition for status or summary surfaces
- per-page shadow and radius systems that do not map back to shared variables

## Controller Rules

- Controllers may return status keys, tone keys, and semantic flags.
- Controllers may not return raw color strings for shared UI.
- Controllers may not own visual palettes for cards, chips, or drawers.

## Migration Rule

- When minisales needs a new UI treatment, first add the semantic token or shared surface.
- Do not solve recurring UI differences by creating a new page-local palette.

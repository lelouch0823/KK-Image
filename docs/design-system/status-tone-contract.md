# Status and Tone Contract

## Purpose

Define one shared ownership model for semantic tones and status rendering across Web and minisales.

## Allowed Tones

Only these semantic tones may own product UI emphasis:

- `primary`
- `success`
- `warning`
- `danger`
- `info`
- `neutral`

## Ownership Rules

- Tokens own tone values.
- Foundation owns tone rendering for primitive shared controls such as badges and selectors.
- Composed components own reusable status-bearing surfaces that combine layout structure with tone rendering.
- Composed components may consume tones, but may not redefine their values.
- Domain modules may map domain states to tones, but may not define new visual values for those tones.

## Status Mapping Rules

- A platform may have one shared status mapping source per UI primitive family.
- Allowed primitive families are:
  - primitive status controls such as badges and selectors
  - summary or metric surfaces
  - minisales shared status surfaces
- A module may not invent a new mapping registry by calling itself a separate concern.
- Domain code may provide:
  - domain status key
  - domain label
  - optional semantic metadata
- Domain code may not provide:
  - direct `hex`
  - direct `rgba`
  - direct background color strings
  - ad hoc gradient strings
  - local badge/card palette maps

## Web Contract

- Shared Web status presentation must flow through foundation or composed primitives such as:
  - `StatusBadge`
  - `StatusSelector`
  - shared stat or metric surfaces
- If multiple modules need the same status presentation pattern, it must be promoted to `src/components/ui` or `src/design-system/composed`.

## Minisales Contract

- minisales status presentation must use shared status keys and semantic tones.
- Controllers and component TS files must not inject `style="color:...;background:..."` strings for status rendering.
- minisales shared surfaces must choose classes or data attributes from semantic tone keys rather than returning raw palette values.

## Banned Patterns

- `const STATUS_META = { pending: { color: '#...', background: '#...' } }`
- `style="{{statusStyle}}"`
- `:style="{ color: ..., background: ... }"` for shared status surfaces
- repeated per-module status palette maps
- domain-owned RGBA glow or badge background logic

## Escalation Rule

- If a domain status needs a new visual treatment, extend the shared tone contract or shared status primitive.
- Do not solve the gap by adding a new local palette.

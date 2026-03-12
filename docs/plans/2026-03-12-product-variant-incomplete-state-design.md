# Product Variant Incomplete State Design

## Context

The product edit form now preserves existing variant identity when specs expand. This avoids silently rewriting an existing variant like `Black` into `Black + L`, but it introduces a new UX need: legacy variants can remain in the table even when they no longer satisfy the current spec structure.

Those variants must be visible, obviously actionable, and impossible to save accidentally as valid active variants.

## Design Decision

Adopt a blocking warning pattern in edit mode:

- Existing variants whose spec keys no longer match the current active dimension set are marked as `pending_incomplete`.
- These rows render as yellow warning rows, not normal active rows.
- The form shows a summary warning banner above the variants table.
- Save is blocked while any incomplete legacy variant remains.
- The primary resolution is deleting the row from the form, which already maps to backend archive behavior on save.

This keeps variant IDs stable, avoids automatic migration, and prevents invalid mixed spec structures from being persisted.

## Why This Approach

### Recommended approach: Blocking warning rows

- Highest visibility in a dense management table.
- Aligns the severity of the state with the consequence: user must resolve before save.
- Matches the existing product-management visual language of bordered cards, badges, and explicit table actions.

### Alternative 1: Small badge only

- Lower visual noise.
- Rejected because users can miss the issue in a large variant table.

### Alternative 2: Passive warning without save block

- Lower friction.
- Rejected because it allows mixed-generation variant states to become durable data.

## UX Specification

### Variant row presentation

For an incomplete legacy variant row:

- Row background: warning-tinted yellow.
- Row border/accent: subtle warning border.
- Leading cell: warning icon + variant label.
- Secondary helper text under the variant name:
  `This legacy variant no longer matches the current spec structure.`
- Status column: show a warning badge labeled `Pending`.
- Status toggle for these rows should not behave like a normal active/archive toggle.
- Delete action remains available and is the main resolution path.

### Summary warning banner

Render above the variant table when one or more incomplete rows exist:

- Warning icon
- Count-aware summary
- Clear action guidance

Example copy:

`There are 2 legacy variants that no longer match the current specs. Remove/archive them before saving.`

### Save behavior

- In edit mode only, if any variant is `pending_incomplete`, disable Save.
- Surface the reason in the warning banner and in submit-time toast fallback.

## Data Rules

### Detection

A variant is incomplete when all of the following are true:

- The form is in edit mode
- The variant has an existing `id`
- The current active dimension names differ from the variant's `options_values` key set

### Persistence

- `pending_incomplete` is a client-side editing state.
- It should not be sent as a new persisted business status unless backend support is intentionally added later.
- On submit, the user must remove/archive such rows before the request is sent.

## Testing Strategy

- Add a composable-level regression test for detection and save blocking.
- Add a table rendering test for warning row styling and pending label.
- Add a modal test proving edit-mode spec expansion creates a pending legacy row and disables save until removed.

## UI Notes

Derived from `ui-ux-pro-max` guidance:

- Use strong visual differentiation rather than subtle badge-only feedback.
- Keep table mobile-safe with the existing `overflow-x-auto` wrapper.
- Make submit constraints explicit; do not rely on disabled buttons without explanation.

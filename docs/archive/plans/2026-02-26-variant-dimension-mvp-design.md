# Variant Dimension Structure MVP Design

**Date:** 2026-02-26  
**Status:** Approved

## Goal

Enable product-specific, custom variant dimensions (max 3) with safe structure changes: rename with alias tracking, archive/restore values or dimensions, and impact-aware delete flows. Creation flow allows free dimension changes; edit flow enforces cautious rules.

## Non-Goals (MVP)

- Full structure versioning or migration history beyond aliases
- Advanced multi-step mapping wizard beyond basic “impact + choose option”
- Cross-product dimension templates

## Data Model (Persistent)

### New Tables

**`product_dimensions`**

- `id` TEXT PK
- `product_id` TEXT FK
- `name` TEXT (current display name)
- `status` TEXT ENUM (`active`, `archived`)
- `sort_order` INTEGER (0..2)
- Constraints:
  - max 3 `active` dimensions per product (enforced in API + DB constraint/trigger)

**`product_dimension_values`**

- `id` TEXT PK
- `dimension_id` TEXT FK
- `value` TEXT
- `status` TEXT ENUM (`active`, `archived`)
- `sort_order` INTEGER

**`product_dimension_aliases`**

- `id` TEXT PK
- `dimension_id` TEXT FK
- `from_name` TEXT (old name)
- `to_name` TEXT (new name)
- `created_at` INTEGER

### Existing Tables (Updates)

**`product_variants`**

- `variant_signature` TEXT UNIQUE (hash of sorted `options_values`)
- `options_values` JSON: keys are `dimension_id`, values are dimension values

## Key Rules

- Custom dimensions per product, max 3 active.
- **Create flow:** free add/remove dimensions (variants not yet saved).
- **Edit flow:** dimension delete is allowed but **only via impact dialog**; delete = archive (not physical delete).
- Rename allowed and recorded in aliases; variants’ data stays intact because `dimension_id` is stable.
- Archive dimension/value:
  - marks `status=archived`
  - related variants marked `archived`
  - archived values/dimensions do not participate in new combinations
- Restore reactivates and re-enables combination generation.

## API Design (MVP)

### Read

`GET /api/manage/products/:id`

- include `dimensions[]` with values and aliases
- include `dimension_map` (`id -> name`)
- variants contain `options_values` keyed by `dimension_id`

### Write

- `POST /api/manage/products/:id/dimensions`
  - create dimension (<=3 active)
- `PATCH /api/manage/products/:id/dimensions/:dimensionId`
  - rename (record alias), re-order
- `PATCH /api/manage/products/:id/dimensions/:dimensionId/archive`
  - archive dimension + archive affected variants
- `POST /api/manage/products/:id/dimensions/:dimensionId/values`
  - add value
- `PATCH /api/manage/products/:id/values/:valueId/archive`
  - archive value + archive affected variants
- `PATCH /api/manage/products/:id/values/:valueId/restore`
  - restore value

### Impact Preview (Wizard)

`POST /api/manage/products/:id/dimensions/impact`

- payload: `{ action, dimensionId?, valueId?, map? }`
- return: `{ affectedVariantsCount, sampleVariants[] }`

## UI/UX (MVP)

### Dimension Panel

- Custom dimensions (max 3), each as a card.
- Unused dimensions hidden with “Add Dimension” entry.
- **Create flow:** remove dimension freely.
- **Edit flow:** remove dimension only via impact dialog (archive).
- Rename shows confirmation: “will record alias; variants unchanged”.

### Value Management

- Values shown as pills.
- Delete value → impact preview → archive.
- Restore entry for archived values per dimension.

### Delete Dimension Wizard

1. Impact preview (count + sample)
2. Choose:
   - Archive affected variants
   - **Merge & keep** (ignore removed dimension, dedupe by `variant_signature`, keep one active)
   - Cancel

### Variant Generation

- Uses `dimension_id` keys
- `variant_signature` prevents duplicates
- Archived values/dimensions excluded

## Testing Plan (MVP)

- DB constraints: max 3 active dims
- Rename records alias
- Archive value/dimension archives variants
- Merge & keep behavior for dimension removal
- UI: create flow allows free remove; edit flow requires wizard

## Migration & Rollout

1. Add new tables + variant_signature.
2. Update product read/write APIs.
3. Frontend UI flow changes.
4. Regression tests + smoke on create/edit.

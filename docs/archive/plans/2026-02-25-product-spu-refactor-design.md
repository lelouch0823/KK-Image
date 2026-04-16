# Product SKU to SPU Refactor Design

## Goal

Refactor product identifier semantics so the main product uses `spu` (optional), while variant `sku` remains required and globally unique.

## Scope

- Replace all main-product `sku` usage with `spu` across DB, backend, frontend, import/export, and tests.
- Remove old `sku` compatibility logic (development-stage direct cutover).
- Keep `product_variants.sku` unchanged (`UNIQUE NOT NULL`).

## Data Model

- `products.sku` is removed.
- `products.spu` is added as optional unique identifier:
  - `spu TEXT UNIQUE` (nullable)
- Existing product `sku` values are migrated into `spu`.
- Index migrated from `idx_products_sku` to `idx_products_spu`.

## Backend Design

- `ProductRepository`
  - Replace all product-level `sku` reads/writes/search filters with `spu`.
  - Create/update payload mapping uses `spu`.
  - Uniqueness checks only run when `spu` is non-empty.
- Product routes
  - Create validation changes from `name + sku required` to `name required`.
  - Conflict checks are conditional on non-empty `spu`.
  - Response payloads expose `spu` only.

## Frontend Design

- Product create/edit form:
  - Field renamed to `SPU`.
  - Becomes optional.
  - Submission payload sends `spu`.
- Product list/detail/table/filter:
  - Display and search fields use `spu`.
- Order/space binding:
  - Main product identifier displays `spu`.
  - Variant selector and bindings continue to use `variant.sku`.
- Import/export:
  - Product import schema uses optional `spu` column.
  - Any product export field uses `spu`.

## Error Handling Rules

- Empty `spu` accepted.
- Duplicate non-empty `spu` returns conflict.
- Variant `sku` constraints remain strict and unchanged.

## Testing Strategy (TDD)

- Migration-level checks
  - schema contains `products.spu` and no `products.sku`.
  - nullable `spu` inserts succeed.
  - duplicate non-empty `spu` fails.
- Repository/API tests
  - create product without `spu` succeeds.
  - create/update with duplicate non-empty `spu` fails.
  - search/list returns `spu`.
- Frontend tests
  - product form validates only product name as required.
  - payload uses `spu`.
  - product list/detail renders `spu`.
  - import parsing accepts missing `spu`.

## Risks

- Broad rename touches many modules; missing one path may break product flows.
- Existing UI/tests referencing `product.form.sku` need synchronized i18n and assertions.
- Import/export mapping must stay consistent with API contract after rename.

## Non-Goals

- No change to `product_variants.sku` semantics.
- No backward-compatibility bridge for old `sku` payloads.

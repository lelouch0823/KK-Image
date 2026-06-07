# Product Variant Images Design

**Date:** 2026-02-25
**Status:** Approved

## Goal

Support per-variant image differentiation for all key flows:

- order binding and variant switching
- product detail variant gallery
- space/export rendering with variant-specific image priority

## Scope

- Introduce a dedicated multi-image model for variants.
- Provide two management entries:
  - inline lightweight editor in product editor rows
  - advanced modal for batch operations
- Keep backward compatibility with existing product-level images as fallback.

## Data Model

### New Table: `variant_images`

- `id TEXT PRIMARY KEY`
- `variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE`
- `file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE`
- `sort_order INTEGER DEFAULT 0`
- `is_primary INTEGER DEFAULT 0 CHECK (is_primary IN (0,1))`
- `created_at INTEGER NOT NULL`
- `UNIQUE(variant_id, file_id)`

### Integrity Rules

- At most one primary image per variant.
- If variant has images but no primary flag after deletion/update, assign first by `sort_order`.
- Variant image lookup must always be constrained by `product_id` ownership in write APIs.

## Read/Display Rules

### Order Flow

- When a variant is selected, show `variant.primaryImage` first.
- Fallback order:
  1. variant primary
  2. first variant image
  3. product main image

### Product Detail

- Variant switch updates gallery to `variant.images`.
- If no variant images exist, show product images.

### Space/Export

- If `variantId` exists and variant has images, use variant primary image.
- Otherwise fallback to product image chain.

## API Design

### Product Detail Enrichment

- `GET /api/manage/products/:id`
  - return `variants[].images` and `variants[].primaryImage`

### Variant Image Mutations

- `POST /api/manage/products/:id/variants/:variantId/images`
  - payload: `{ fileIds: string[] }`
  - append images with stable `sort_order`
- `PATCH /api/manage/products/:id/variants/:variantId/images/sort`
  - payload: `{ items: [{ id, sortOrder }] }`
- `PATCH /api/manage/products/:id/variants/:variantId/images/:imageId/primary`
  - atomically clear old primary and set new one
- `DELETE /api/manage/products/:id/variants/:variantId/images/:imageId`
  - remove link; auto-repair primary when needed

## UI/UX

### Entry A: Inline Variant Row Editor

- Small image strip in each variant row.
- Actions: upload, set primary, remove.
- Optimistic updates with rollback on error.

### Entry B: Advanced Modal

- Left: variant list.
- Right: selected variant gallery.
- Features: batch upload, drag-sort, set primary, remove, copy to other variants.

## Error Handling

- `400 BAD_REQUEST`: variant-product mismatch, malformed payload.
- `404 NOT_FOUND`: variant or file missing.
- `409 CONFLICT`: stale sort mutation/version mismatch.

## Variant Governance Extensions (2026-02-25)

- Variant selector now supports dynamic 3D/2D/1D dimensions (`颜色 / 材质 / 尺码`) and explicit availability states:
  - `disabled_archived`
  - `disabled_out_of_stock`
  - `low_stock`
  - `available`
- Purchase suggestion and replenishment flows moved to variant-first logic with unified `variant_display_name`.
- Variant operational fields added for supply-chain control:
  - `moq`, `pack_size`, `order_step`
  - `suggested_purchase_price`
  - `barcode`, `supplier_sku`
- Variant pricing strategy output exposed in purchase suggestions:
  - `variant_cost_price`
  - `suggested_purchase_price`
  - `last_purchase_price`
  - `price_delta`
- Product editor includes batch matrix builder for 3D/2D/1D combinations, dedupe against existing variants, and bulk defaults.
- Variant operation auditing added:
  - `variant_audit_logs` table
  - route-level write hooks on variant create/update/archive operations.
- Mutation failures are atomic at variant level.

## Cache and Consistency

- Invalidate:
  - `/api/manage/products`
  - `/api/manage/products/:id`
  - any dependent space/product detail caches
- Frontend cache key should include updated timestamp from variant image payload.

## Migration and Rollout

1. Add schema and integrity triggers.
2. Add backend read support.
3. Add mutation APIs.
4. Release advanced modal (feature flag optional).
5. Release inline editor.
6. Enable full regression checklist in CI.

## Regression Checklist

- Variant-only image updates reflect in order modal.
- Variant switch updates product detail image correctly.
- Spaces/export use variant image when `variantId` is present.
- Deleting primary image repairs to first sorted image.
- Invalid variant-product bindings are rejected.

## Verification Log

- 2026-02-25: `pnpm test:unit functions/repositories/__tests__/variant-images.test.js` (pass)
- 2026-02-25: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/variant-images-routes.test.js` (pass)
- 2026-02-25: `pnpm test:unit src/components/product/__tests__/VariantImageManagerModal.test.js` (pass)
- 2026-02-25: `pnpm test:unit src/components/product/__tests__/ProductCreateModal.variant-images.test.js` (pass)
- 2026-02-25: `pnpm run dev:all` (aborted by user; manual smoke checks skipped by request)

# Refactor Variant Image Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the Variant Image Management feature to use the reusable `ImageUploader` component with "Immediate Upload" strategy. Update the backend API to support batch saving variant images when creating or updating a product.

**Architecture:**

1. **Backend:** Add `syncImages` to `VariantImageRepository`, and update `POST /` and `PATCH /:id` / `PUT /:id` product endpoints to save the `variant.images` array.
2. **Frontend:** Replace the custom image management grid in `VariantImageManagerModal` with the `ImageUploader` (immediate upload mode). Update data sync in `ProductCreateModal.vue`.

**Tech Stack:** Node.js, Cloudflare D1 (SQLite), Vue 3 Composition API, Tailwind CSS, Vite.

---

### Task 1: Backend Repository Updates

**Files:**

- Modify: `o:/Code/KK-Image/functions/repositories/VariantImageRepository.js`

**Step 1.1: Add `syncImages` method**

```javascript
    async syncImages(productId, variantId, images = []) {
        await this.productVariantRepository.assertBelongsToProduct(variantId, productId);
        const timestamp = now();
        const statements = [];

        // 1. Delete existing images for the variant
        statements.push(
            this.db.prepare('DELETE FROM variant_images WHERE variant_id = ?').bind(variantId)
        );

        // 2. Insert new images
        images.forEach((image, index) => {
            const id = generateId();
            const imageId = image.image_id || image.id;
            const isPrimary = image.is_primary ? 1 : (index === 0 ? 1 : 0);

            if (!imageId) return;

            statements.push(
                this.db.prepare(
                    `INSERT INTO variant_images (id, variant_id, image_id, sort_order, is_primary, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    id, variantId, imageId, index, isPrimary, timestamp, timestamp
                )
            );
        });

        if (statements.length > 0) {
            await this.db.batch(statements);
        }
    }
```

### Task 2: Backend API Updates

**Files:**

- Modify: `o:/Code/KK-Image/functions/lib/hono/routes/manage/products/index.js`
- Modify: `o:/Code/KK-Image/functions/lib/hono/routes/manage/products/[id].js`

**Step 2.1: Update `POST /` (createProduct) in `index.js`**
After `variantRepo.createBatch`:

```javascript
const createdVariants = await variantRepo.createBatch(product.id, normalizedVariants);

// Sync variant images
const variantImageRepo = new VariantImageRepository(env.DB, variantRepo);
for (const inputVariant of body.variants) {
  if (Array.isArray(inputVariant.images) && inputVariant.images.length > 0) {
    // Find corresponding created variant by matching sku or signature
    // Since normal createBatch preserves sku, we can match by sku
    const createdVariant = createdVariants.find((v) => v.sku === inputVariant.sku);
    if (createdVariant) {
      await variantImageRepo.syncImages(product.id, createdVariant.id, inputVariant.images);
    }
  }
}
```

**Step 2.2: Update `PATCH /:id` and `PUT /:id` in `[id].js`**
After `variantRepo.syncVariants`:

```javascript
const variantImageRepo = new VariantImageRepository(env.DB, variantRepo);
for (const inputVariant of body.variants) {
  if (Array.isArray(inputVariant.images) && inputVariant.id) {
    await variantImageRepo.syncImages(id, inputVariant.id, inputVariant.images);
  }
}
```

_Make sure to import `VariantImageRepository` in `index.js`._

### Task 3: Frontend `VariantImageManagerModal.vue` Update

**Files:**

- Modify: `o:/Code/KK-Image/src/components/product/VariantImageManagerModal.vue`

**Step 3.1: Replace UI with ImageUploader**

- Import `ImageUploader` and use it inside the images section.
- Use `computed` for `variantImagesForUploader` to map DB format (`image_id`, `is_primary`) to Uploader format (`id`, `url`).
- Remove manual add/setPrimary/sort button logic since `ImageUploader` supports this via drag & drop. Emits should trigger exactly when the `ImageUploader`'s `v-model` updates.
- Set `context="variant"` and `deferred=false` (immediate upload).

### Task 4: Frontend `ProductCreateModal.vue` Update

**Files:**

- Modify: `o:/Code/KK-Image/src/components/product/ProductCreateModal.vue`

**Step 4.1: Bind update events**

- Listen to `@update-images="handleUpdateVariantImages"` on `<VariantImageManagerModal>`.
- Update `handleUpdateVariantImages({ variantId, images })` to update `form.variants`.
- When submitting, ensure `variant.images` is passed to the backend payload (already handled if `variants` is passed directly, just make sure `images` array is correctly formatted as `[{image_id, is_primary...}]`).

### Task 5: Run tests

Run `pnpm run build` and `pnpm run test:unit`. Fix any broken assertions in `ProductCreateModal.*.test.js` or `VariantImageManagerModal.test.js`.

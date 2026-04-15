import { describe, expect, it, vi } from 'vitest';
import { syncCatalogVariantImages } from '../product-catalog/variant-images.js';

describe('product-catalog variant image helper', () => {
  it('syncs resolved tasks and archives by folder', async () => {
    const syncImages = vi.fn(async () => {});
    const archiveByFolder = vi.fn(async () => {});

    await syncCatalogVariantImages({
      env: {},
      productId: 'product-1',
      inputVariants: [{ id: 'input-1' }],
      persistedVariants: [{ id: 'variant-1' }],
      variantImageRepo: { syncImages },
      resolvePlan: () => ({
        unresolved: [],
        tasks: [{ variantId: 'variant-1', images: ['img-1'] }],
      }),
      archiveByFolder,
    });

    expect(syncImages).toHaveBeenCalledWith('product-1', 'variant-1', ['img-1']);
    expect(archiveByFolder).toHaveBeenCalledWith({}, 'product-1', [
      { variantId: 'variant-1', images: ['img-1'] },
    ]);
  });

  it('throws when image targets cannot be reconciled', async () => {
    await expect(
      syncCatalogVariantImages({
        env: {},
        productId: 'product-1',
        inputVariants: [],
        persistedVariants: [],
        variantImageRepo: { syncImages: vi.fn() },
        resolvePlan: () => ({
          unresolved: [{ variantId: 'missing' }],
          tasks: [],
        }),
      })
    ).rejects.toThrow('Unable to reconcile variant image targets');
  });
});

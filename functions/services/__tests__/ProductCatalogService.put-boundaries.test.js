import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockProductRepo = {
  findById: vi.fn(),
  updateWithMeta: vi.fn(),
  findBySpuBatch: vi.fn(),
  bulkUpsertFromImport: vi.fn(),
};

const mockVariantRepo = {
  findByProductId: vi.fn(),
  syncVariants: vi.fn(),
  buildAuditEvents: vi.fn(),
  findByProductIds: vi.fn(),
  bulkSyncFromImport: vi.fn(),
};

const mockDimensionRepo = {
  listByProduct: vi.fn(),
  restoreSnapshot: vi.fn(),
};

const mockAuditRepo = {
  createBatch: vi.fn(),
};

const mockProjectionRefresh = {
  refreshByProductId: vi.fn(async () => undefined),
  refreshByProductIds: vi.fn(async () => undefined),
};

vi.mock('../../repositories/ProductRepository.js', () => ({
  ProductRepository: class {
    findById(...args) {
      return mockProductRepo.findById(...args);
    }
    updateWithMeta(...args) {
      return mockProductRepo.updateWithMeta(...args);
    }
    findBySpuBatch(...args) {
      return mockProductRepo.findBySpuBatch(...args);
    }
    bulkUpsertFromImport(...args) {
      return mockProductRepo.bulkUpsertFromImport(...args);
    }
  },
}));

vi.mock('../../repositories/ProductVariantRepository.js', () => ({
  ProductVariantRepository: class {
    findByProductId(...args) {
      return mockVariantRepo.findByProductId(...args);
    }
    syncVariants(...args) {
      return mockVariantRepo.syncVariants(...args);
    }
    buildAuditEvents(...args) {
      return mockVariantRepo.buildAuditEvents(...args);
    }
    findByProductIds(...args) {
      return mockVariantRepo.findByProductIds(...args);
    }
    bulkSyncFromImport(...args) {
      return mockVariantRepo.bulkSyncFromImport(...args);
    }
  },
}));

vi.mock('../../repositories/ProductDimensionRepository.js', () => ({
  ProductDimensionRepository: class {
    listByProduct(...args) {
      return mockDimensionRepo.listByProduct(...args);
    }
    restoreSnapshot(...args) {
      return mockDimensionRepo.restoreSnapshot(...args);
    }
  },
}));

vi.mock('../../repositories/VariantAuditRepository.js', () => ({
  VariantAuditRepository: class {
    createBatch(...args) {
      return mockAuditRepo.createBatch(...args);
    }
  },
}));

vi.mock('../ProductProjectionRefreshService.js', () => ({
  ProductProjectionRefreshService: class {
    refreshByProductId(...args) {
      return mockProjectionRefresh.refreshByProductId(...args);
    }
    refreshByProductIds(...args) {
      return mockProjectionRefresh.refreshByProductIds(...args);
    }
  },
}));

vi.mock('../../repositories/VariantImageRepository.js', () => ({
  VariantImageRepository: class {
    syncImages() {
      return Promise.resolve();
    }
  },
}));

vi.mock('../_shared/cache-invalidation.js', () => ({
  scheduleProductCacheInvalidation: vi.fn(async () => {}),
}));

vi.mock('../_shared/variant-image-folders.js', () => ({
  archiveVariantImagesByFolder: vi.fn(async () => {}),
}));

import { BadRequestError } from '../../lib/hono/errors.js';
import { scheduleProductCacheInvalidation } from '../_shared/cache-invalidation.js';
import { ProductCatalogService } from '../ProductCatalogService.js';

describe('ProductCatalogService putProduct boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductRepo.findById.mockResolvedValue({
      id: 'p1',
      name: 'Tee',
      currency: 'CNY',
      images: [],
      specifications: {},
      options: [],
    });
    mockProductRepo.updateWithMeta.mockResolvedValue({ success: true, changes: 1 });
    mockVariantRepo.findByProductId
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'v1', product_id: 'p1', sku: 'SKU-1', price: 10, options_values: {} },
      ]);
    mockVariantRepo.syncVariants.mockResolvedValue({
      createdCount: 0,
      updatedCount: 1,
      archivedCount: 0,
      reactivatedCount: 0,
    });
    mockVariantRepo.buildAuditEvents.mockReturnValue([]);
    mockDimensionRepo.listByProduct.mockResolvedValue([]);
    mockDimensionRepo.restoreSnapshot.mockResolvedValue(undefined);
    mockAuditRepo.createBatch.mockResolvedValue(undefined);
    mockProjectionRefresh.refreshByProductId.mockResolvedValue(undefined);
    mockProjectionRefresh.refreshByProductIds.mockResolvedValue(undefined);
    mockProductRepo.findBySpuBatch.mockResolvedValue(new Map());
    mockProductRepo.bulkUpsertFromImport.mockResolvedValue({ successes: [], failures: [] });
    mockVariantRepo.findByProductIds.mockResolvedValue(new Map());
    mockVariantRepo.bulkSyncFromImport.mockResolvedValue({ successes: [], failures: [] });
  });

  it('rejects ambiguous full replace when variants are replaced but dimensions are omitted on a dimensioned product', async () => {
    mockDimensionRepo.listByProduct.mockResolvedValue([
      {
        id: 'dim-color',
        name: 'Color',
        status: 'active',
        values: [{ id: 'val-red', value: 'Red', status: 'active' }],
      },
    ]);

    const service = new ProductCatalogService({});

    await expect(
      service.putProduct({ env: {}, executionCtx: { waitUntil: vi.fn() } }, 'p1', {
        name: 'Tee',
        variants: [
          {
            id: 'v1',
            sku: 'SKU-1',
            price: 10,
            cost_price: 6,
            stock_quantity: 5,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red' },
          },
        ],
      })
    ).rejects.toThrow(BadRequestError);

    expect(mockProductRepo.updateWithMeta).not.toHaveBeenCalled();
    expect(mockVariantRepo.syncVariants).not.toHaveBeenCalled();
  });

  it('allows full replace without dimensions when the product has no dimensioned data', async () => {
    const service = new ProductCatalogService({});

    const result = await service.putProduct(
      { env: {}, executionCtx: { waitUntil: vi.fn() } },
      'p1',
      {
        name: 'Tee',
        variants: [
          {
            id: 'v1',
            sku: 'SKU-1',
            price: 10,
            cost_price: 6,
            stock_quantity: 5,
            alert_threshold: 1,
            status: 'active',
            options_values: {},
          },
        ],
      }
    );

    expect(result).toEqual({
      changes: 1,
      variantSync: {
        created: 0,
        updated: 1,
        archived: 0,
        reactivated: 0,
      },
      variantsUpdated: true,
    });
    expect(mockProductRepo.updateWithMeta).toHaveBeenCalledTimes(1);
    expect(mockVariantRepo.syncVariants).toHaveBeenCalledTimes(1);
  });

  it('syncs dimensions even when patch payload does not include variants', async () => {
    const service = new ProductCatalogService({});
    const syncDimensionsSpy = vi.spyOn(service, 'syncDimensionsFromPayload').mockResolvedValue([
      {
        id: 'dim-color',
        name: 'Color',
        status: 'active',
        values: [{ id: 'val-red', value: 'Red', status: 'active' }],
      },
    ]);

    const result = await service.patchProduct(
      { env: {}, executionCtx: { waitUntil: vi.fn() } },
      'p1',
      {
        dimensions: [
          {
            id: 'dim-color',
            name: 'Color',
            values: [{ value: 'Red' }],
          },
        ],
      }
    );

    expect(syncDimensionsSpy).toHaveBeenCalledWith(
      'p1',
      [
        {
          id: 'dim-color',
          name: 'Color',
          values: [{ value: 'Red' }],
        },
      ],
      { replaceMissing: false }
    );
    expect(mockProductRepo.updateWithMeta).not.toHaveBeenCalled();
    expect(mockVariantRepo.syncVariants).not.toHaveBeenCalled();
    expect(result).toEqual({
      changes: 0,
      variantSync: undefined,
      variantsUpdated: false,
    });
  });

  it('batchImport still preserves rollback semantics under chunk preload', async () => {
    const deleteRun = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const deleteBind = vi.fn(() => ({ run: deleteRun }));
    const prepare = vi.fn(() => ({ bind: deleteBind }));
    const service = new ProductCatalogService({ prepare });

    mockProductRepo.bulkUpsertFromImport.mockResolvedValue({
      successes: [
        { itemKey: 'SPU-OK', operation: 'created', productId: 'p-created-1' },
        { itemKey: 'SPU-FAIL', operation: 'created', productId: 'p-created-2' },
      ],
      failures: [],
    });
    mockVariantRepo.bulkSyncFromImport.mockResolvedValue({
      successes: [
        {
          itemKey: 'SPU-OK',
          productId: 'p-created-1',
          stats: { createdCount: 1, updatedCount: 0, archivedCount: 0, reactivatedCount: 0 },
        },
      ],
      failures: [
        {
          itemKey: 'SPU-FAIL',
          operation: 'created',
          productId: 'p-created-2',
          error: new Error('variant conflict'),
        },
      ],
    });

    const result = await service.batchImport(
      { env: {}, executionCtx: { waitUntil: vi.fn() } },
      {
        items: [
          { name: 'A', spu: 'SPU-OK', variants: [{ sku: 'SKU-OK', price: 10 }] },
          { name: 'B', spu: 'SPU-FAIL', variants: [{ sku: 'SKU-FAIL', price: 20 }] },
        ],
      },
      { skipCacheInvalidation: true }
    );

    expect(mockProductRepo.findBySpuBatch).toHaveBeenCalledTimes(1);
    expect(mockVariantRepo.findByProductIds).toHaveBeenCalledTimes(1);
    expect(mockProductRepo.bulkUpsertFromImport).toHaveBeenCalledTimes(1);
    expect(mockVariantRepo.bulkSyncFromImport).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledWith('DELETE FROM products WHERE id = ?');
    expect(deleteBind).toHaveBeenCalledWith('p-created-2');

    expect(result.summary.createdProducts).toBe(1);
    expect(result.summary.failedProducts).toBe(1);
    expect(result.count).toBe(1);
    expect(result.success).toBe(true);
    expect(mockProjectionRefresh.refreshByProductIds).toHaveBeenCalledWith(
      ['p-created-1'],
      expect.anything(),
      { strict: true }
    );
  });

  it('blocks product cache invalidation when strict projection refresh fails', async () => {
    const service = new ProductCatalogService({});
    mockProjectionRefresh.refreshByProductId.mockRejectedValueOnce(new Error('projection failed'));

    await expect(
      service.patchProduct(
        { env: {}, executionCtx: { waitUntil: vi.fn() } },
        'p1',
        { name: 'Updated Tee' },
        { skipCacheInvalidation: false }
      )
    ).rejects.toThrow('projection failed');

    expect(mockProjectionRefresh.refreshByProductId).toHaveBeenCalledWith(
      'p1',
      expect.anything(),
      { strict: true }
    );
    expect(scheduleProductCacheInvalidation).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createManagedProduct } from '../create-product.js';

const mockProductRepo = {
  create: vi.fn(),
  findBySpu: vi.fn(),
};
const mockVariantRepo = {
  createBatch: vi.fn(),
};
const mockVariantImageRepo = {
  syncImages: vi.fn(),
};
const mockDimensionRepo = {
  createDimension: vi.fn(),
  addValue: vi.fn(),
};

vi.mock('../../../../../../repositories/ProductRepository.js', () => ({
  ProductRepository: class {
    create(...args) { return mockProductRepo.create(...args); }
    findBySpu(...args) { return mockProductRepo.findBySpu(...args); }
  },
}));

vi.mock('../../../../../../repositories/ProductVariantRepository.js', () => ({
  ProductVariantRepository: class {
    createBatch(...args) { return mockVariantRepo.createBatch(...args); }
  },
}));

vi.mock('../../../../../../repositories/VariantImageRepository.js', () => ({
  VariantImageRepository: class {
    syncImages(...args) { return mockVariantImageRepo.syncImages(...args); }
  },
}));

vi.mock('../../../../../../repositories/ProductDimensionRepository.js', () => ({
  ProductDimensionRepository: class {
    createDimension(...args) { return mockDimensionRepo.createDimension(...args); }
    addValue(...args) { return mockDimensionRepo.addValue(...args); }
  },
}));

vi.mock('../../../../middleware/cache.js', () => ({
  invalidateCache: vi.fn(),
  getProductCacheUrls: vi.fn(() => []),
}));

describe('createManagedProduct transactional rollback boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductRepo.findBySpu.mockResolvedValue(null);
    mockProductRepo.create.mockResolvedValue({ id: 'product-1', name: 'Catalog Tee' });
    mockDimensionRepo.createDimension.mockResolvedValue({ id: 'dim-1', name: 'Color' });
    mockDimensionRepo.addValue.mockResolvedValue({ id: 'value-1', value: 'Red' });
    mockVariantRepo.createBatch.mockResolvedValue([
      { id: 'variant-1', sku: 'SKU-1', options_values: { Color: 'Red' } },
    ]);
  });

  it('removes all newly created catalog rows when create fails after product insert', async () => {
    const run = vi.fn(async () => ({ meta: { changes: 1 } }));
    const db = {
      prepare: vi.fn((sql) => ({
        bind: vi.fn(() => ({ run })),
      })),
    };
    const c = {
      env: { DB: db, executionCtx: { waitUntil: vi.fn() } },
      executionCtx: { waitUntil: vi.fn() },
      get: vi.fn(),
      set: vi.fn(),
    };

    mockVariantImageRepo.syncImages.mockRejectedValueOnce(new Error('variant image sync failed'));

    await expect(createManagedProduct(c, {
      name: 'Catalog Tee',
      currency: 'USD',
      dimensions: [{ name: 'Color', values: ['Red'] }],
      variants: [{
        sku: 'SKU-1',
        price: 100,
        cost_price: 60,
        stock_quantity: 5,
        alert_threshold: 2,
        status: 'active',
        options_values: { Color: 'Red' },
        images: [{ image_id: 'img-1', is_primary: 1 }],
      }],
    })).rejects.toThrow('variant image sync failed');

    const preparedSql = db.prepare.mock.calls.map(([sql]) => sql);
    expect(preparedSql).toContain('DELETE FROM variant_images WHERE variant_id = ?');
    expect(preparedSql).toContain('DELETE FROM product_variants WHERE id = ?');
    expect(preparedSql).toContain('DELETE FROM product_dimensions WHERE id = ?');
    expect(preparedSql).toContain('DELETE FROM products WHERE id = ?');
  });
});

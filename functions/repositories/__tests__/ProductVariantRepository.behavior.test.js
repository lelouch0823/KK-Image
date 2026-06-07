import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductVariantRepository } from '../ProductVariantRepository.js';

function createStatement(sql, response = {}) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    first: vi.fn(async () => response.first),
    all: vi.fn(async () => response.all),
    run: vi.fn(async () => response.run),
  };

  return statement;
}

describe('ProductVariantRepository behavior coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T10:00:00.000Z'));
  });

  it('normalizes sku, external codes, and option signatures', () => {
    const repo = new ProductVariantRepository({});

    expect(repo.buildFallbackVariantSku(' variant-1 ')).toBe('SKU-VARIANT1');
    expect(repo.buildVariantSku(' SKU-1 ', 'variant-1')).toBe('SKU-1');
    expect(() => repo.buildVariantSku('', 'variant-1')).toThrow(
      'variant sku is required (variant-1)'
    );
    expect(repo.normalizeExternalCode('  EXT-1  ')).toBe('EXT-1');
    expect(repo.normalizeExternalCode('   ')).toBeNull();
    expect(repo.normalizeOptionsValues({ b: '2', a: '1', empty: '', nil: null })).toEqual({
      a: '1',
      b: '2',
    });
    expect(repo.buildVariantSignature({ b: '2', a: '1' })).toBe('{"a":"1","b":"2"}');
  });

  it('finds variants by product ids and parses option payloads into grouped maps', async () => {
    const responses = [
      {
        all: {
          results: [
            { id: 'v1', product_id: 'p1', options_values: '{"color":"Blue"}' },
            { id: 'v2', product_id: 'p2', options_values: '{"size":"L"}' },
            { id: 'skip', product_id: '', options_values: '{}' },
          ],
        },
      },
    ];
    const db = {
      prepare: vi.fn((sql) => createStatement(sql, responses.shift())),
    };
    const repo = new ProductVariantRepository(db);

    await expect(repo.findByProductIds(['p1', ' ', 'p2', 'p1'])).resolves.toEqual(
      new Map([
        ['p1', [{ id: 'v1', product_id: 'p1', options_values: { color: 'Blue' } }]],
        ['p2', [{ id: 'v2', product_id: 'p2', options_values: { size: 'L' } }]],
      ])
    );
    await expect(repo.findByProductIds([])).resolves.toEqual(new Map());
  });

  it('finds single variants and checks product ownership', async () => {
    const db = {
      prepare: vi
        .fn()
        .mockReturnValueOnce(
          createStatement('findById', {
            first: { id: 'v1', product_id: 'p1', options_values: '{"color":"Blue"}' },
          })
        )
        .mockReturnValueOnce(
          createStatement('findById', {
            first: null,
          })
        )
        .mockReturnValueOnce(
          createStatement('findByIdAndProductId', {
            first: { id: 'v2', product_id: 'p2', options_values: '{"size":"L"}' },
          })
        )
        .mockReturnValueOnce(
          createStatement('findByIdAndProductId', {
            first: null,
          })
        ),
    };
    const repo = new ProductVariantRepository(db);

    await expect(repo.findById('v1')).resolves.toEqual({
      id: 'v1',
      product_id: 'p1',
      options_values: { color: 'Blue' },
    });
    await expect(repo.findById('missing')).resolves.toBeNull();
    await expect(repo.assertBelongsToProduct('v2', 'p2')).resolves.toEqual({
      id: 'v2',
      product_id: 'p2',
      options_values: { size: 'L' },
    });
    await expect(repo.assertBelongsToProduct('v3', 'p3')).rejects.toThrow(
      'Variant does not belong to product'
    );
  });

  it('searches variants for AI workflows with normalized filters and labels', async () => {
    const countStatement = createStatement('count', { first: { total: 3 } });
    const listStatement = createStatement('list', {
      all: {
        results: [
          {
            id: 'v1',
            product_id: 'p1',
            product_name: 'Jacket',
            product_spu: 'SPU-1',
            product_brand: 'North',
            product_category: 'Outerwear',
            options_values: '{"color":"Blue","size":"L"}',
          },
        ],
      },
    });
    const db = {
      prepare: vi.fn().mockReturnValueOnce(countStatement).mockReturnValueOnce(listStatement),
    };
    const repo = new ProductVariantRepository(db);

    await expect(
      repo.searchForAI({
        status: 'inactive',
        productId: 'p1',
        brand: 'North',
        category: 'Outerwear',
        search: 'jacket',
        limit: 50,
      })
    ).resolves.toEqual({
      items: [
        {
          id: 'v1',
          product_id: 'p1',
          options_values: { color: 'Blue', size: 'L' },
          variantLabel: 'Blue / L',
          product: {
            id: 'p1',
            name: 'Jacket',
            spu: 'SPU-1',
            brand: 'North',
            category: 'Outerwear',
          },
          product_name: 'Jacket',
          product_spu: 'SPU-1',
          product_brand: 'North',
          product_category: 'Outerwear',
        },
      ],
      total: 3,
    });

    expect(countStatement.params).toEqual([
      'inactive',
      'p1',
      'North',
      'Outerwear',
      '%jacket%',
      '%jacket%',
      '%jacket%',
      '%jacket%',
      '%jacket%',
      '%jacket%',
      '%jacket%',
      '%jacket%',
    ]);
    expect(listStatement.params.at(-1)).toBe(20);
  });

  it('updates moving average cost only when arrival data is valid', async () => {
    const selectStatement = createStatement('select', {
      first: { stock_quantity: 10, cost_price: 20 },
    });
    const updateStatement = createStatement('update', {
      run: { success: true, meta: { changes: 1 } },
    });
    const db = {
      prepare: vi.fn().mockReturnValueOnce(selectStatement).mockReturnValueOnce(updateStatement),
    };
    const repo = new ProductVariantRepository(db);

    await expect(repo.updateMovingAverageCost('variant-1', 4, 120)).resolves.toBe(true);
    expect(updateStatement.params[0]).toBe(24);
    expect(updateStatement.params[2]).toBe('variant-1');

    const noRowRepo = new ProductVariantRepository({
      prepare: vi.fn().mockReturnValue(createStatement('select', { first: null })),
    });
    await expect(noRowRepo.updateMovingAverageCost('variant-2', 4, 120)).resolves.toBe(false);
    await expect(repo.updateMovingAverageCost('', 1, 10)).resolves.toBe(false);
    await expect(repo.updateMovingAverageCost('variant-1', 0, 10)).resolves.toBe(false);
  });

  it('wraps syncVariants and bulkSyncFromImport results for import flows', async () => {
    const repo = new ProductVariantRepository({});
    const successRows = Object.assign([{ id: 'v1' }], {
      createdCount: 1,
      updatedCount: 2,
      archivedCount: 3,
      reactivatedCount: 4,
    });
    const syncSpy = vi
      .spyOn(repo, 'syncVariantPlan')
      .mockResolvedValueOnce(successRows)
      .mockResolvedValueOnce(successRows)
      .mockRejectedValueOnce(new Error('sync failed'));

    await expect(repo.syncVariants('product-1', [{ id: 'v1' }])).resolves.toBe(successRows);
    await expect(
      repo.bulkSyncFromImport([
        {
          itemKey: 'line-1',
          productId: 'product-1',
          variantsToSync: [{ id: 'v1' }],
        },
        {
          itemKey: 'line-2',
          productId: 'product-2',
          variantsToSync: [{ id: 'v2' }],
          fallbackStats: { createdCount: 9 },
        },
      ])
    ).resolves.toEqual({
      successes: [
        {
          itemKey: 'line-1',
          productId: 'product-1',
          stats: {
            createdCount: 1,
            updatedCount: 2,
            archivedCount: 3,
            reactivatedCount: 4,
          },
          variants: successRows,
        },
      ],
      failures: [
        {
          itemKey: 'line-2',
          productId: 'product-2',
          error: expect.any(Error),
        },
      ],
    });

    expect(syncSpy).toHaveBeenNthCalledWith(1, 'product-1', [{ id: 'v1' }]);
    expect(syncSpy).toHaveBeenNthCalledWith(2, 'product-1', [{ id: 'v1' }], []);
    expect(syncSpy).toHaveBeenNthCalledWith(3, 'product-2', [{ id: 'v2' }], []);
  });
});

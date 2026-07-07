import { describe, it, expect, vi } from 'vitest';
import { executeAITool, filterAIToolsForUser } from '../ai-tool-executor.js';

describe('executeAITool - variant aware tools', () => {
  it('denies order and purchase tools when the AI subject only has stats access', async () => {
    const orderRepo = {
      listForAdmin: vi.fn().mockResolvedValue({ items: [{ id: 'o1' }], total: 1 }),
    };
    const purchaseOrderRepo = {
      list: vi.fn().mockResolvedValue({ items: [{ id: 'po1' }], total: 1 }),
    };
    const viewer = { id: 'viewer', role: 'viewer', permissions: ['stats:read'] };

    await expect(
      executeAITool(
        'searchOrders',
        {},
        { orderRepo, authzUser: viewer, enforcePermissions: true }
      )
    ).resolves.toEqual({ error: true, message: 'AI tool permission denied' });
    await expect(
      executeAITool(
        'searchPurchaseOrders',
        {},
        { purchaseOrderRepo, authzUser: viewer, enforcePermissions: true }
      )
    ).resolves.toEqual({ error: true, message: 'AI tool permission denied' });

    expect(orderRepo.listForAdmin).not.toHaveBeenCalled();
    expect(purchaseOrderRepo.list).not.toHaveBeenCalled();
  });

  it('filters advertised AI tools by subject permissions', async () => {
    const tools = [
      { type: 'function', function: { name: 'getOrderStats' } },
      { type: 'function', function: { name: 'searchOrders' } },
      { type: 'function', function: { name: 'searchProducts' } },
    ];
    const viewer = { id: 'viewer', role: 'viewer', permissions: ['stats:read'] };

    const filtered = await filterAIToolsForUser(tools, viewer);

    expect(filtered.map((tool) => tool.function.name)).toEqual(['getOrderStats']);
  });

  it('searchProducts defaults to active catalog scope', async () => {
    const productRepo = {
      search: vi.fn().mockResolvedValue({
        items: [{ id: 'prod-1' }],
        total: 1,
      }),
    };

    const result = await executeAITool(
      'searchProducts',
      { search: 'tee', brand: 'KK', limit: 99 },
      { productRepo }
    );

    expect(productRepo.search).toHaveBeenCalledWith({
      search: 'tee',
      category: undefined,
      brand: 'KK',
      status: 'active',
      limit: 20,
      page: 1,
    });
    expect(result.scope).toEqual(
      expect.objectContaining({
        status: 'active',
        search: 'tee',
        brand: 'KK',
      })
    );
  });

  it('searchVariants uses variant repo and returns normalized paging meta', async () => {
    const searchForAI = vi.fn().mockResolvedValue({
      items: [{ id: 'v1' }, { id: 'v2' }],
      total: 42,
    });
    const result = await executeAITool(
      'searchVariants',
      {
        search: 'red',
        brand: 'ACME',
        category: 'Shoes',
        status: 'active',
        limit: 99,
      },
      {
        variantRepo: { searchForAI },
      }
    );

    expect(searchForAI).toHaveBeenCalledWith({
      search: 'red',
      brand: 'ACME',
      category: 'Shoes',
      status: 'active',
      limit: 20,
    });
    expect(result).toEqual(
      expect.objectContaining({
        items: [{ id: 'v1' }, { id: 'v2' }],
        total: 42,
        returned: 2,
        limit: 20,
        page: 1,
        hasMore: true,
      })
    );
    expect(result.scope).toEqual(
      expect.objectContaining({
        status: 'active',
        brand: 'ACME',
      })
    );
  });

  it('getVariantDetail returns variant + product snapshot', async () => {
    const variantRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'var-1',
        product_id: 'prod-1',
        options_values: { Color: 'Red', Size: '42' },
        stock_quantity: 8,
        available_quantity: 5,
      }),
    };
    const productRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'prod-1',
        name: 'Sneaker',
        brand: 'ACME',
        spu: 'SPU-1',
      }),
    };

    const result = await executeAITool(
      'getVariantDetail',
      { id: 'var-1' },
      { variantRepo, productRepo }
    );

    expect(variantRepo.findById).toHaveBeenCalledWith('var-1');
    expect(productRepo.findById).toHaveBeenCalledWith('prod-1');
    expect(result).toEqual(
      expect.objectContaining({
        id: 'var-1',
        available_quantity: 5,
        product: {
          id: 'prod-1',
          name: 'Sneaker',
          brand: 'ACME',
          spu: 'SPU-1',
        },
      })
    );
  });

  it('getProductDetail keeps only active variants when variant repo is available', async () => {
    const productRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'prod-1',
        name: 'Sneaker',
      }),
    };
    const variantRepo = {
      findByProductId: vi.fn().mockResolvedValue([
        { id: 'v1', product_id: 'prod-1', status: 'active', options_values: { Color: 'Red' } },
        { id: 'v2', product_id: 'prod-1', status: 'archived', options_values: { Color: 'Grey' } },
      ]),
    };

    const result = await executeAITool(
      'getProductDetail',
      { id: 'prod-1' },
      { productRepo, variantRepo }
    );

    expect(variantRepo.findByProductId).toHaveBeenCalledWith('prod-1');
    expect(result).toEqual(
      expect.objectContaining({
        id: 'prod-1',
        variants: [expect.objectContaining({ id: 'v1', variantLabel: 'Red' })],
      })
    );
  });

  it('getRecentPendingOrders returns list with true total pending count', async () => {
    const orderStatsRepo = {
      getRecentPending: vi.fn().mockResolvedValue([{ id: 'o1' }, { id: 'o2' }]),
      countByStatus: vi.fn().mockResolvedValue(17),
    };

    const result = await executeAITool('getRecentPendingOrders', { limit: 5 }, { orderStatsRepo });

    expect(orderStatsRepo.getRecentPending).toHaveBeenCalledWith(5);
    expect(orderStatsRepo.countByStatus).toHaveBeenCalledWith('pending');
    expect(result).toEqual(
      expect.objectContaining({
        total: 17,
        returned: 2,
        limit: 5,
        scope: { status: 'pending' },
      })
    );
  });

  it('getGoodsOverviewList returns total before slicing', async () => {
    const goodsOverviewRepo = {
      getList: vi.fn().mockResolvedValue([{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }]),
    };

    const result = await executeAITool(
      'getGoodsOverviewList',
      { shortageOnly: true, limit: 2 },
      { goodsOverviewRepo }
    );

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(3);
    expect(result.returned).toBe(2);
    expect(result.scope).toEqual(
      expect.objectContaining({
        shortageOnly: true,
      })
    );
  });

  it('getGoodsOverviewList canonicalizes string shortageOnly flags before querying repo', async () => {
    const goodsOverviewRepo = {
      getList: vi.fn().mockResolvedValue([{ id: 'g1' }]),
    };

    await executeAITool(
      'getGoodsOverviewList',
      { shortageOnly: 'true', limit: 2, category: 'Outerwear' },
      { goodsOverviewRepo }
    );

    expect(goodsOverviewRepo.getList).toHaveBeenCalledWith({
      category: 'Outerwear',
      brand: '',
      shortageOnly: true,
      sort: 'shortage',
    });
  });

  it('searchPurchaseOrders returns paging meta with true total', async () => {
    const purchaseOrderRepo = {
      list: vi.fn().mockResolvedValue({
        items: [{ id: 'po1' }, { id: 'po2' }],
        total: 19,
      }),
    };

    const result = await executeAITool(
      'searchPurchaseOrders',
      { search: 'PO-2026', status: 'ordered', limit: 30 },
      { purchaseOrderRepo }
    );

    expect(purchaseOrderRepo.list).toHaveBeenCalledWith({
      search: 'PO-2026',
      status: 'ordered',
      page: 1,
      limit: 20,
    });
    expect(result).toEqual(
      expect.objectContaining({
        total: 19,
        returned: 2,
        limit: 20,
        scope: { search: 'PO-2026', status: 'ordered' },
      })
    );
  });

  it('getPurchaseOrderDetail and getPurchaseStats delegate to repo', async () => {
    const purchaseOrderRepo = {
      findById: vi.fn().mockResolvedValue({ id: 'po-1', po_no: 'PO-1', items: [] }),
      getStats: vi.fn().mockResolvedValue({ total: 10, draft_count: 3 }),
    };

    const detail = await executeAITool(
      'getPurchaseOrderDetail',
      { id: 'po-1' },
      { purchaseOrderRepo }
    );
    const stats = await executeAITool('getPurchaseStats', {}, { purchaseOrderRepo });

    expect(detail).toEqual(expect.objectContaining({ id: 'po-1' }));
    expect(stats).toEqual(expect.objectContaining({ total: 10 }));
  });
});

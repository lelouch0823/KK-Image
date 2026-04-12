import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGoodsOverview } from '../useGoodsOverview';
import { API } from '@/utils/constants';

const mockAuthFetch = vi.fn();
globalThis.fetch = vi.fn(() => Promise.reject(new Error('direct fetch should not be used in manage composables')));

vi.mock('../useAuth', () => ({
  useAuth: () => ({ authFetch: mockAuthFetch }),
}));

vi.mock('@/utils/constants', () => ({
  API: {
    MANAGE_GOODS_OVERVIEW: '/api/manage/goods-overview',
    MANAGE_GOODS_OVERVIEW_SUMMARY: '/api/manage/goods-overview/summary',
    MANAGE_GOODS_OVERVIEW_EXPORT: '/api/manage/goods-overview/export',
    MANAGE_PURCHASE_ORDERS: '/api/manage/purchase-orders',
    MANAGE_PURCHASE_ORDER_FROM_ORDERS: '/api/manage/purchase-orders/from-orders',
  },
}));

describe('useGoodsOverview composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads overview list via authFetch', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            items: [{ id: 'v-1', name: 'Variant 1' }],
            filters: { categories: ['tops'], brands: ['kk'] },
          },
        }),
    });

    const { loadData, items, availableFilters } = useGoodsOverview();
    await loadData();

    expect(mockAuthFetch).toHaveBeenCalledWith(`${API.MANAGE_GOODS_OVERVIEW}?sort=shortage`);
    expect(items.value).toEqual([{ id: 'v-1', name: 'Variant 1' }]);
    expect(availableFilters.value).toEqual({ categories: ['tops'], brands: ['kk'] });
  });

  it('marks forbidden when authFetch rejects with 403', async () => {
    const err = new Error('权限不足: goods:read');
    err.status = 403;
    err.data = { error: '权限不足: goods:read' };
    mockAuthFetch.mockRejectedValueOnce(err);

    const { loadData, errorCode, error } = useGoodsOverview();
    await loadData();

    expect(errorCode.value).toBe('FORBIDDEN');
    expect(error.value).toContain('权限不足');
  });

  it('loads summary via authFetch', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: { totalProducts: 10, shortageCount: 2 },
        }),
    });

    const { loadSummary, summary } = useGoodsOverview();
    await loadSummary();

    expect(mockAuthFetch).toHaveBeenCalledWith(API.MANAGE_GOODS_OVERVIEW_SUMMARY);
    expect(summary.value).toEqual({ totalProducts: 10, shortageCount: 2 });
  });

  it('keeps the latest overview list when earlier filter loads resolve late', async () => {
    const resolvers = [];
    mockAuthFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
    );

    const goodsOverview = useGoodsOverview();
    goodsOverview.filters.category = 'tops';
    await Promise.resolve();

    goodsOverview.filters.category = 'pants';
    await Promise.resolve();

    expect(resolvers).toHaveLength(2);
    const [resolveFirst, resolveSecond] = resolvers;

    resolveSecond({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            items: [{ id: 'v-new', name: 'Pants Variant' }],
            filters: { categories: ['pants'], brands: [] },
          },
        }),
    });
    await vi.waitFor(() => {
      expect(goodsOverview.items.value).toEqual([{ id: 'v-new', name: 'Pants Variant' }]);
    });

    resolveFirst({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            items: [{ id: 'v-old', name: 'Top Variant' }],
            filters: { categories: ['tops'], brands: [] },
          },
        }),
    });
    await vi.waitFor(() => {
      expect(goodsOverview.items.value).toEqual([{ id: 'v-new', name: 'Pants Variant' }]);
    });
  });

  it('keeps the latest summary when earlier summary loads resolve late', async () => {
    let resolveFirst;
    let resolveSecond;
    mockAuthFetch
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    const { loadSummary, summary } = useGoodsOverview();
    const firstPending = loadSummary();
    const secondPending = loadSummary();

    resolveSecond({
      json: () =>
        Promise.resolve({
          success: true,
          data: { totalProducts: 20, shortageCount: 3 },
        }),
    });
    await secondPending;

    expect(summary.value).toEqual({ totalProducts: 20, shortageCount: 3 });

    resolveFirst({
      json: () =>
        Promise.resolve({
          success: true,
          data: { totalProducts: 10, shortageCount: 1 },
        }),
    });
    await firstPending;

    expect(summary.value).toEqual({ totalProducts: 20, shortageCount: 3 });
  });

  it('creates purchase order from selected variants via authFetch', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              items: [{ id: 'var-1', productId: 'prod-1', name: 'Tee', sku: 'TEE-S', shortage: 5, avgUnitCost: 8.8 }],
              filters: { categories: [], brands: [] },
            },
          }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: { id: 'po-1' } }),
      });

    const { loadData, toggleSelect, items, createPOFromSelected } = useGoodsOverview();
    await loadData();
    toggleSelect(items.value[0]);
    const result = await createPOFromSelected();

    expect(result.success).toBe(true);
    expect(mockAuthFetch).toHaveBeenNthCalledWith(
      2,
      API.MANAGE_PURCHASE_ORDERS,
      expect.objectContaining({ method: 'POST' }),
    );

    const [, request] = mockAuthFetch.mock.calls[1];
    const payload = JSON.parse(request.body);
    expect(payload.items).toEqual([
      expect.objectContaining({
        product_id: 'prod-1',
        variant_id: 'var-1',
        product_sku: 'TEE-S',
        quantity: 5,
      }),
    ]);
  });

  it('retries through create-from-orders when historical-demand items fail manual PO validation', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              items: [{
                id: 'var-archived',
                variantId: 'var-archived',
                productId: 'prod-1',
                name: 'Archived Tee',
                sku: 'TEE-ARCHIVED',
                shortage: 5,
                avgUnitCost: 8.8,
                orderIds: ['o-2', 'o-1', 'o-2'],
              }],
              filters: { categories: [], brands: [] },
            },
          }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: '仅可采购 active 变体' }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: { id: 'po-2' } }),
      });

    const { loadData, toggleSelect, items, createPOFromSelected } = useGoodsOverview();
    await loadData();
    toggleSelect(items.value[0]);
    const result = await createPOFromSelected();

    expect(result.success).toBe(true);
    expect(mockAuthFetch).toHaveBeenNthCalledWith(
      2,
      API.MANAGE_PURCHASE_ORDERS,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mockAuthFetch).toHaveBeenNthCalledWith(
      3,
      API.MANAGE_PURCHASE_ORDER_FROM_ORDERS,
      expect.objectContaining({ method: 'POST' }),
    );

    const [, retryRequest] = mockAuthFetch.mock.calls[2];
    const retryPayload = JSON.parse(retryRequest.body);
    expect(retryPayload.order_ids).toEqual(['o-2', 'o-1']);
    expect(retryPayload.allocation_method).toBe('by_quantity');
  });

  it('builds export url from current filters', () => {
    mockAuthFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: { items: [], filters: { categories: [], brands: [] } } }),
    });
    const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    const removeChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
    const click = vi.fn();
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue({
      click,
      href: '',
      download: '',
    });

    const { filters, exportCSV } = useGoodsOverview();
    filters.category = 'tops';
    filters.brand = 'KK';
    filters.shortageOnly = true;
    filters.sort = 'demand';

    exportCSV();

    const link = createElement.mock.results[0].value;
    expect(createElement).toHaveBeenCalledWith('a');
    expect(link.href).toBe(`${API.MANAGE_GOODS_OVERVIEW_EXPORT}?category=tops&brand=KK&shortageOnly=1&sort=demand`);
    expect(click).toHaveBeenCalledTimes(1);
    appendChild.mockRestore();
    removeChild.mockRestore();
    createElement.mockRestore();
  });

  it('blocks purchase-order creation when selected items have no shortage', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            items: [{ id: 'var-1', productId: 'prod-1', name: 'Tee', sku: 'TEE-S', shortage: 0, avgUnitCost: 8.8 }],
            filters: { categories: [], brands: [] },
          },
        }),
    });

    const { loadData, toggleSelect, items, createPOFromSelected } = useGoodsOverview();
    await loadData();
    toggleSelect(items.value[0]);

    const result = await createPOFromSelected();

    expect(result.success).toBe(false);
    expect(result.error).toContain('缺货');
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);
  });
});

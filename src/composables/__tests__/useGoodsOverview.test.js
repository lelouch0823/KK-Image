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
});

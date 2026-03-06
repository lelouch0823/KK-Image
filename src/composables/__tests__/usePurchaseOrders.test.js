import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthFetch = vi.fn();
globalThis.fetch = vi.fn(() => Promise.reject(new Error('direct fetch should not be used in manage composables')));

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
}));

vi.mock('@/utils/constants', () => ({
  API: {
    MANAGE_PURCHASE_ORDERS: '/api/manage/purchase-orders',
    MANAGE_PURCHASE_ORDER_BY_ID: (id) => `/api/manage/purchase-orders/${id}`,
    MANAGE_PURCHASE_ORDER_STATUS: (id) => `/api/manage/purchase-orders/${id}/status`,
    MANAGE_PURCHASE_ORDER_ITEMS: (id) => `/api/manage/purchase-orders/${id}/items`,
    MANAGE_PURCHASE_ORDER_ITEM: (poId, itemId) => `/api/manage/purchase-orders/${poId}/items/${itemId}`,
    MANAGE_PURCHASE_ORDER_ALLOCATE: (id) => `/api/manage/purchase-orders/${id}/allocate`,
    MANAGE_PURCHASE_ORDER_SUGGESTIONS: '/api/manage/purchase-orders/suggestions',
    MANAGE_PURCHASE_ORDER_STATS: '/api/manage/purchase-orders/stats',
    MANAGE_PURCHASE_ORDER_FROM_ORDERS: '/api/manage/purchase-orders/from-orders',
  },
}));

vi.mock('../useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('../useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

vi.mock('../useAuth', () => ({
  useAuth: () => ({ authFetch: mockAuthFetch }),
}));

import { usePurchaseOrders } from '../usePurchaseOrders';

describe('usePurchaseOrders authz handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks FORBIDDEN when list API responds 403', async () => {
    const err = new Error('权限不足: purchase_orders:read');
    err.status = 403;
    err.data = { error: '权限不足: purchase_orders:read' };
    mockAuthFetch.mockRejectedValueOnce(err);

    const { loadList, error, errorCode } = usePurchaseOrders();
    await loadList();

    expect(mockAuthFetch).toHaveBeenCalledTimes(1);
    expect(errorCode.value).toBe('FORBIDDEN');
    expect(error.value).toContain('权限不足');
  });

  it('does not mark page forbidden when stats API responds 403', async () => {
    const statsForbidden = new Error('权限不足: purchase_orders:stats');
    statsForbidden.status = 403;
    statsForbidden.data = { error: '权限不足: purchase_orders:stats' };
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: { items: [], total: 0 } }),
      })
      .mockRejectedValueOnce(statsForbidden);

    const { loadList, loadStats, errorCode, stats } = usePurchaseOrders();
    await loadList();
    const ok = await loadStats();

    expect(mockAuthFetch).toHaveBeenCalledTimes(2);
    expect(ok).toBe(false);
    expect(errorCode.value).toBeNull();
    expect(stats.value).toBeNull();
  });

  it('keeps list forbidden reason when list and stats both respond 403', async () => {
    const listForbidden = new Error('权限不足: purchase_orders:read');
    listForbidden.status = 403;
    listForbidden.data = { error: '权限不足: purchase_orders:read' };
    const statsForbidden = new Error('权限不足: stats:read');
    statsForbidden.status = 403;
    statsForbidden.data = { error: '权限不足: stats:read' };
    mockAuthFetch.mockRejectedValueOnce(listForbidden).mockRejectedValueOnce(statsForbidden);

    const { loadList, loadStats, error, errorCode } = usePurchaseOrders();
    await Promise.all([loadList(), loadStats()]);

    expect(mockAuthFetch).toHaveBeenCalledTimes(2);
    expect(errorCode.value).toBe('FORBIDDEN');
    expect(error.value).toContain('purchase_orders:read');
  });
});

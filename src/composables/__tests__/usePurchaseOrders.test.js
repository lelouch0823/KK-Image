import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthFetch = vi.fn();
const mockRandomUUID = vi.fn();
globalThis.fetch = vi.fn(() => Promise.reject(new Error('direct fetch should not be used in manage composables')));
vi.stubGlobal('crypto', { randomUUID: mockRandomUUID });

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
    MANAGE_PURCHASE_ORDER_RECEIPTS: (id) => `/api/manage/purchase-orders/${id}/receipts`,
    MANAGE_PURCHASE_ORDER_RECEIPT_REVERSAL: (poId, receiptId) => `/api/manage/purchase-orders/${poId}/receipts/${receiptId}/reversal`,
    MANAGE_PURCHASE_ORDER_SHORTAGE_CLOSURES: (id) => `/api/manage/purchase-orders/${id}/shortage-closures`,
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
    mockRandomUUID.mockReset();
    mockRandomUUID.mockReturnValue('idem-1');
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

  it('keeps the latest purchase-order list when earlier list loads resolve late', async () => {
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

    const purchaseOrders = usePurchaseOrders();
    purchaseOrders.filters.status = 'draft';
    const firstPending = purchaseOrders.loadList({ forceRefresh: true });

    purchaseOrders.filters.status = 'ordered';
    const secondPending = purchaseOrders.loadList({ forceRefresh: true });

    resolveSecond({
      json: () =>
        Promise.resolve({
          success: true,
          data: { items: [{ id: 'po-new', status: 'ordered' }], total: 1 },
        }),
    });
    await secondPending;

    expect(purchaseOrders.list.value).toEqual([{ id: 'po-new', status: 'ordered' }]);

    resolveFirst({
      json: () =>
        Promise.resolve({
          success: true,
          data: { items: [{ id: 'po-old', status: 'draft' }], total: 1 },
        }),
    });
    await firstPending;

    expect(purchaseOrders.list.value).toEqual([{ id: 'po-new', status: 'ordered' }]);
  });

  it('uses backend status-update message when present', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        success: true,
        data: { message: '状态已更新，同步更新了 2 个预订单采购状态' },
      }),
    });

    const { updateStatus } = usePurchaseOrders();
    const ok = await updateStatus('po-1', 'ordered');

    expect(ok).toBe(true);
    expect(mocks.addToast).toHaveBeenCalledWith({
      message: '状态已更新，同步更新了 2 个预订单采购状态',
      type: 'success',
    });
  });

  it('updates purchase-order settlement fields through the managed auth client', async () => {
    const updatedDetail = {
      id: 'po-1',
      currency: 'USD',
      actual_shipping_cost: 12.5,
      actual_tariff_cost: 3.2,
    };
    mockAuthFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        success: true,
        data: updatedDetail,
      }),
    });

    const { updatePO, detail } = usePurchaseOrders();
    const ok = await updatePO('po-1', {
      currency: 'USD',
      actual_shipping_cost: 12.5,
      actual_tariff_cost: 3.2,
    });

    expect(ok).toBe(true);
    expect(detail.value).toEqual(updatedDetail);
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/manage/purchase-orders/po-1', expect.objectContaining({
      method: 'PUT',
    }));
  });

  it('deduplicates repeated order ids before create-from-orders requests', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        success: true,
        data: { id: 'po-1' },
      }),
    });

    const { createFromOrders } = usePurchaseOrders();
    await createFromOrders(['o-1', 'o-1', 'o-2', 'o-2'], { allocation_method: 'by_quantity' });

    expect(mockAuthFetch).toHaveBeenCalledWith(
      '/api/manage/purchase-orders/from-orders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          order_ids: ['o-1', 'o-2'],
          allocation_method: 'by_quantity',
        }),
      })
    );
  });

  it('does not let stale purchase-order updates overwrite a newer detail context', async () => {
    let resolveUpdate;
    mockAuthFetch
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveUpdate = resolve;
          })
      )
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: { id: 'po-2', status: 'ordered' },
        }),
      });

    const purchaseOrders = usePurchaseOrders();
    const updatePending = purchaseOrders.updatePO('po-1', { remark: 'old update' });
    await purchaseOrders.loadDetail('po-2', { forceRefresh: true });

    expect(purchaseOrders.detail.value).toEqual({ id: 'po-2', status: 'ordered' });

    resolveUpdate({
      json: () =>
        Promise.resolve({
          success: true,
          data: { id: 'po-1', status: 'draft', remark: 'old update' },
        }),
    });
    await updatePending;

    expect(purchaseOrders.detail.value).toEqual({ id: 'po-2', status: 'ordered' });
  });

  it('allocates purchase-order costs through the managed auth client', async () => {
    const allocatedDetail = {
      id: 'po-1',
      items: [{ id: 'poi-1', allocated_freight: 1.5, allocated_tariff: 0.4 }],
    };
    mockAuthFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        success: true,
        data: allocatedDetail,
      }),
    });

    const { allocateCosts, detail } = usePurchaseOrders();
    const ok = await allocateCosts('po-1');

    expect(ok).toBe(true);
    expect(detail.value).toEqual(allocatedDetail);
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/manage/purchase-orders/po-1/allocate', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('submits purchase receipts through the managed auth client', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        success: true,
        data: { receipts: [{ id: 'receipt-1' }] },
      }),
    });

    const { recordReceipts } = usePurchaseOrders();
    const result = await recordReceipts('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 2 }],
    });

    expect(result).toEqual({ receipts: [{ id: 'receipt-1' }] });
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/manage/purchase-orders/po-1/receipts', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Idempotency-Key': 'idem-1',
      }),
    }));
  });

  it('submits receipt reversals through the managed auth client', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        success: true,
        data: { reversal_id: 'reversal-1' },
      }),
    });

    const { reverseReceipt } = usePurchaseOrders();
    const result = await reverseReceipt('po-1', 'receipt-1', { reason: 'rollback' });

    expect(result).toEqual({ reversal_id: 'reversal-1' });
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/manage/purchase-orders/po-1/receipts/receipt-1/reversal', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Idempotency-Key': 'idem-1',
      }),
    }));
  });

  it('bypasses cached purchase-order detail reads when forceRefresh is requested', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        success: true,
        data: { id: 'po-1', status: 'shipping' },
      }),
    });

    const { loadDetail, detail } = usePurchaseOrders();
    await loadDetail('po-1', { forceRefresh: true });

    expect(detail.value).toEqual({ id: 'po-1', status: 'shipping' });
    expect(mockAuthFetch.mock.calls[0]?.[0]).toMatch(/^\/api\/manage\/purchase-orders\/po-1\?_ts=\d+$/);
  });

  it('bypasses cached purchase-order list reads when forceRefresh is requested', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        success: true,
        data: { items: [], total: 0 },
      }),
    });

    const { loadList } = usePurchaseOrders();
    await loadList({ forceRefresh: true });

    expect(mockAuthFetch.mock.calls[0]?.[0]).toMatch(
      /^\/api\/manage\/purchase-orders\?page=1&limit=20&_ts=\d+$/
    );
  });

  it('bypasses cached purchase-order stats reads when forceRefresh is requested', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        success: true,
        data: { draft_count: 0 },
      }),
    });

    const { loadStats, stats } = usePurchaseOrders();
    await loadStats({ forceRefresh: true });

    expect(stats.value).toEqual({ draft_count: 0 });
    expect(mockAuthFetch.mock.calls[0]?.[0]).toMatch(
      /^\/api\/manage\/purchase-orders\/stats\?_ts=\d+$/
    );
  });

  it('loads purchase-order overview through the shared list-and-stats helper', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: { items: [{ id: 'po-1' }], total: 1 },
        }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: { draft_count: 0, ordered_count: 1 },
        }),
      });

    const { loadPurchaseOrderOverview, list, total, stats } = usePurchaseOrders();
    const result = await loadPurchaseOrderOverview();

    expect(result).toEqual({
      listLoaded: true,
      statsLoaded: true,
    });
    expect(list.value).toEqual([{ id: 'po-1' }]);
    expect(total.value).toBe(1);
    expect(stats.value).toEqual({ draft_count: 0, ordered_count: 1 });
    expect(mockAuthFetch).toHaveBeenCalledTimes(2);
    expect(mockAuthFetch.mock.calls[0]?.[0]).toBe('/api/manage/purchase-orders?page=1&limit=20');
    expect(mockAuthFetch.mock.calls[1]?.[0]).toBe('/api/manage/purchase-orders/stats');
  });

  it('refreshes purchase-order detail, list, and stats together after a write', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: { id: 'po-1', status: 'shipping' },
        }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: { items: [{ id: 'po-1' }], total: 1 },
        }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: { draft_count: 0, shipping_count: 1 },
        }),
      });

    const { refreshPurchaseOrderViews, detail, list, total, stats } = usePurchaseOrders();
    const result = await refreshPurchaseOrderViews('po-1');

    expect(result).toEqual({
      detailLoaded: true,
      listLoaded: true,
      statsLoaded: true,
    });
    expect(detail.value).toEqual({ id: 'po-1', status: 'shipping' });
    expect(list.value).toEqual([{ id: 'po-1' }]);
    expect(total.value).toBe(1);
    expect(stats.value).toEqual({ draft_count: 0, shipping_count: 1 });
    expect(mockAuthFetch).toHaveBeenCalledTimes(3);
    expect(mockAuthFetch.mock.calls[0]?.[0]).toMatch(/^\/api\/manage\/purchase-orders\/po-1\?_ts=\d+$/);
    expect(mockAuthFetch.mock.calls[1]?.[0]).toMatch(
      /^\/api\/manage\/purchase-orders\?page=1&limit=20&_ts=\d+$/
    );
    expect(mockAuthFetch.mock.calls[2]?.[0]).toMatch(
      /^\/api\/manage\/purchase-orders\/stats\?_ts=\d+$/
    );
  });

  it('keeps the latest purchase-order detail when earlier detail loads resolve late', async () => {
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

    const { loadDetail, detail } = usePurchaseOrders();
    const firstPending = loadDetail('po-1', { forceRefresh: true });
    const secondPending = loadDetail('po-2', { forceRefresh: true });

    resolveSecond({
      json: () =>
        Promise.resolve({
          success: true,
          data: { id: 'po-2', status: 'ordered' },
        }),
    });
    await secondPending;

    expect(detail.value).toEqual({ id: 'po-2', status: 'ordered' });

    resolveFirst({
      json: () =>
        Promise.resolve({
          success: true,
          data: { id: 'po-1', status: 'draft' },
        }),
    });
    await firstPending;

    expect(detail.value).toEqual({ id: 'po-2', status: 'ordered' });
  });

  it('keeps the latest purchase suggestions when earlier suggestion loads resolve late', async () => {
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

    const { loadSuggestions, suggestions } = usePurchaseOrders();
    const firstPending = loadSuggestions();
    const secondPending = loadSuggestions();

    resolveSecond({
      json: () =>
        Promise.resolve({
          success: true,
          data: [{ variant_id: 'variant-new', shortage: 2 }],
        }),
    });
    await secondPending;

    expect(suggestions.value).toEqual([{ variant_id: 'variant-new', shortage: 2 }]);

    resolveFirst({
      json: () =>
        Promise.resolve({
          success: true,
          data: [{ variant_id: 'variant-old', shortage: 5 }],
        }),
    });
    await firstPending;

    expect(suggestions.value).toEqual([{ variant_id: 'variant-new', shortage: 2 }]);
  });

  it('clears stale purchase suggestions when the latest refresh fails', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: [{ variant_id: 'variant-old', shortage: 5 }],
          }),
      })
      .mockRejectedValueOnce(new Error('network down'));

    const { loadSuggestions, suggestions } = usePurchaseOrders();
    await loadSuggestions();

    expect(suggestions.value).toEqual([{ variant_id: 'variant-old', shortage: 5 }]);

    const ok = await loadSuggestions();

    expect(ok).toBe(false);
    expect(suggestions.value).toEqual([]);
  });

  it('keeps the latest purchase stats when earlier stats loads resolve late', async () => {
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

    const { loadStats, stats } = usePurchaseOrders();
    const firstPending = loadStats({ forceRefresh: true });
    const secondPending = loadStats({ forceRefresh: true });

    resolveSecond({
      json: () =>
        Promise.resolve({
          success: true,
          data: { ordered_count: 2, shipping_count: 1 },
        }),
    });
    await secondPending;

    expect(stats.value).toEqual({ ordered_count: 2, shipping_count: 1 });

    resolveFirst({
      json: () =>
        Promise.resolve({
          success: true,
          data: { ordered_count: 9, shipping_count: 9 },
        }),
    });
    await firstPending;

    expect(stats.value).toEqual({ ordered_count: 2, shipping_count: 1 });
  });

  it('submits purchase-order shortage closures through the managed auth client', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        success: true,
        data: { purchase_order_id: 'po-1', closed_count: 1 },
      }),
    });

    const { closeShortages } = usePurchaseOrders();
    const result = await closeShortages('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', close_qty: 2 }],
    });

    expect(result).toEqual({ purchase_order_id: 'po-1', closed_count: 1 });
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/manage/purchase-orders/po-1/shortage-closures', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Idempotency-Key': 'idem-1',
      }),
    }));
  });

  it('covers purchase-order create and line-item CRUD flows', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: { id: 'po-1' } }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

    const purchaseOrders = usePurchaseOrders();

    await expect(purchaseOrders.createPO({ remark: 'memo' })).resolves.toEqual({ id: 'po-1' });
    await expect(
      purchaseOrders.addItems('po-1', [{ product_id: 'prod-1', quantity: 2 }])
    ).resolves.toBe(true);
    await expect(
      purchaseOrders.updateItem('po-1', 'item-1', { quantity: 3 })
    ).resolves.toBe(true);
    await expect(purchaseOrders.removeItem('po-1', 'item-1')).resolves.toBe(true);

    expect(mocks.addToast).toHaveBeenCalledWith({
      message: 'purchaseOrder.toast.created',
      type: 'success',
    });
    expect(mocks.addToast).toHaveBeenCalledWith({
      message: 'purchaseOrder.toast.itemsAdded',
      type: 'success',
    });
    expect(mocks.addToast).toHaveBeenCalledWith({
      message: 'purchaseOrder.toast.itemUpdated',
      type: 'success',
    });
    expect(mocks.addToast).toHaveBeenCalledWith({
      message: 'purchaseOrder.toast.itemRemoved',
      type: 'success',
    });
  });

  it('surfaces create and line-item failures without mutating state', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: 'create failed' }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: 'add failed' }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: 'update failed' }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: 'remove failed' }),
      });

    const purchaseOrders = usePurchaseOrders();

    await expect(purchaseOrders.createPO({})).resolves.toBeNull();
    await expect(purchaseOrders.addItems('po-1', [])).resolves.toBe(false);
    await expect(purchaseOrders.updateItem('po-1', 'item-1', {})).resolves.toBe(false);
    await expect(purchaseOrders.removeItem('po-1', 'item-1')).resolves.toBe(false);

    expect(mocks.addToast).toHaveBeenCalledWith({ message: 'create failed', type: 'error' });
    expect(mocks.addToast).toHaveBeenCalledWith({ message: 'add failed', type: 'error' });
    expect(mocks.addToast).toHaveBeenCalledWith({ message: 'update failed', type: 'error' });
    expect(mocks.addToast).toHaveBeenCalledWith({ message: 'remove failed', type: 'error' });
  });

  it('refreshes overview only when no detail id is provided', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: { items: [{ id: 'po-1' }], total: 1 },
        }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: { draft_count: 1 },
        }),
      });

    const { refreshPurchaseOrderViews } = usePurchaseOrders();
    const result = await refreshPurchaseOrderViews();

    expect(result).toEqual({
      detailLoaded: false,
      listLoaded: true,
      statsLoaded: true,
    });
    expect(mockAuthFetch).toHaveBeenCalledTimes(2);
  });

  it('keeps detail falsey when loadDetail receives backend and network failures', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: 'missing' }),
      })
      .mockRejectedValueOnce(new Error('network down'));

    const { loadDetail, detail } = usePurchaseOrders();

    await expect(loadDetail('po-404')).resolves.toBe(false);
    await expect(loadDetail('po-net')).resolves.toBe(false);
    expect(detail.value).toBeNull();
    expect(mocks.addToast).toHaveBeenCalledWith({ message: 'missing', type: 'error' });
  });
});

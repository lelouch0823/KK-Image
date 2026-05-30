import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const manageResource = {
    items: { value: [] },
    loading: { value: false },
    error: { value: null },
    errorCode: { value: null },
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    abort: vi.fn(),
  };
  const salesResource = {
    items: { value: [] },
    loading: { value: false },
    error: { value: null },
    errorCode: { value: null },
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    abort: vi.fn(),
  };

  return {
    manageResource,
    salesResource,
    authFetch: vi.fn(),
    addToast: vi.fn(),
    salesOrderApi: {
      auth: vi.fn(),
      login: vi.fn(),
      list: vi.fn(),
      detail: vi.fn(),
      create: vi.fn(),
      comment: vi.fn(),
    },
  };
});

vi.mock('../useResource', () => ({
  useResource: vi.fn((apiEndpoint) =>
    apiEndpoint === '/api/manage/orders' ? mocks.manageResource : mocks.salesResource
  ),
}));

vi.mock('../useAuth', () => ({
  useAuth: () => ({ authFetch: mocks.authFetch }),
}));

vi.mock('../useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('../useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

vi.mock('@/composables/sales/useSalesOrderApi', () => ({
  useSalesOrderApi: () => mocks.salesOrderApi,
}));

import { useOrders } from '../useOrders';

function resetSharedState() {
  mocks.manageResource.items.value = [];
  mocks.manageResource.loading.value = false;
  mocks.manageResource.error.value = null;
  mocks.manageResource.errorCode.value = null;
  mocks.manageResource.pagination.page = 1;
  mocks.manageResource.pagination.limit = 20;
  mocks.manageResource.pagination.total = 0;
  mocks.manageResource.pagination.totalPages = 1;

  mocks.salesResource.items.value = [];
  mocks.salesResource.loading.value = false;
  mocks.salesResource.error.value = null;
  mocks.salesResource.errorCode.value = null;
  mocks.salesResource.pagination.page = 1;
  mocks.salesResource.pagination.limit = 10;
  mocks.salesResource.pagination.total = 0;
  mocks.salesResource.pagination.totalPages = 1;
}

describe('useOrders extra coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedState();
  });

  it('appends manage orders with a 200 item cap and fills missing metadata', async () => {
    mocks.manageResource.items.value = Array.from({ length: 200 }, (_, index) => ({
      id: `old-${index + 1}`,
    }));
    mocks.authFetch.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: [{ id: 'new-1' }],
        salespersons: [{ id: 'sp-1' }],
        statuses: ['draft'],
        procurementStatuses: ['new'],
        deliveryStatuses: ['queued'],
        pagination: { page: 2, limit: 20, total: 201, totalPages: 11 },
      }),
    });

    const { loadOrders, orders, salespersons, statuses, procurementStatuses, deliveryStatuses } =
      useOrders();

    await expect(loadOrders({ page: 2 }, true)).resolves.toBe(true);
    expect(orders.value).toHaveLength(200);
    expect(orders.value[0].id).toBe('old-2');
    expect(orders.value.at(-1).id).toBe('new-1');
    expect(salespersons.value).toEqual([{ id: 'sp-1' }]);
    expect(statuses.value).toEqual(['draft']);
    expect(procurementStatuses.value).toEqual(['new']);
    expect(deliveryStatuses.value).toEqual(['queued']);
  });

  it('falls back to total-based pagination when the backend omits pagination metadata', async () => {
    mocks.authFetch.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: [{ id: 'order-1' }],
        pagination: { page: 3, limit: 15, total: 5, totalPages: 1 },
      }),
    });

    const { loadOrders, pagination } = useOrders();

    await expect(loadOrders({ page: 3, limit: 15, search: '', status: null })).resolves.toBe(true);
    expect(pagination.page).toBe(3);
    expect(pagination.limit).toBe(15);
    expect(pagination.total).toBe(5);
    expect(pagination.totalPages).toBe(1);
    expect(mocks.authFetch.mock.calls[0][0]).toContain('page=3');
    expect(mocks.authFetch.mock.calls[0][0]).toContain('limit=15');
    expect(mocks.authFetch.mock.calls[0][0]).not.toContain('search=');
  });

  it('marks business errors and network errors for manage order loading', async () => {
    mocks.authFetch
      .mockResolvedValueOnce({
        json: async () => ({ success: false, message: 'backend says no' }),
      })
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 0, data: { error: 'offline' } }));

    const { loadOrders, error, errorCode } = useOrders();

    await expect(loadOrders()).resolves.toBe(false);
    expect(errorCode.value).toBe('BUSINESS_ERROR');
    expect(error.value).toBe('backend says no');
    expect(mocks.addToast).toHaveBeenCalledWith({ message: 'backend says no', type: 'error' });

    await expect(loadOrders()).resolves.toBe(false);
    expect(errorCode.value).toBe('NETWORK_ERROR');
    expect(error.value).toBe('offline');
  });

  it('marks unauthorized manage loading responses separately from forbidden and network errors', async () => {
    const unauthorizedError = Object.assign(new Error('unauthorized'), {
      status: 401,
      data: { error: 'unauthorized' },
    });
    mocks.authFetch.mockRejectedValueOnce(unauthorizedError);

    const { loadOrders, errorCode, error } = useOrders();

    await expect(loadOrders()).resolves.toBe(false);
    expect(errorCode.value).toBe('UNAUTHORIZED');
    expect(error.value).toBe('unauthorized');
  });

  it('ignores stale rejected manage requests after a newer request wins', async () => {
    let resolveSecond;
    const staleFailure = Object.assign(new Error('stale'), { status: 500, data: { error: 'stale' } });
    mocks.authFetch
      .mockRejectedValueOnce(staleFailure)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    const { loadOrders, orders } = useOrders();
    const first = loadOrders({ page: 1 });
    const second = loadOrders({ page: 2 });

    resolveSecond({
      json: async () => ({
        success: true,
        data: [{ id: 'fresh' }],
        pagination: { page: 2, limit: 20, total: 1, totalPages: 1 },
      }),
    });

    await expect(second).resolves.toBe(true);
    await expect(first).resolves.toBe(false);
    expect(orders.value).toEqual([{ id: 'fresh' }]);
  });

  it('returns null or data for order detail lookups and handles network failures', async () => {
    mocks.authFetch
      .mockResolvedValueOnce({
        json: async () => ({ success: true, data: { id: 'order-1', status: 'confirmed' } }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ success: false, message: 'missing' }),
      })
      .mockRejectedValueOnce(new Error('network down'));

    const { getOrder } = useOrders();

    await expect(getOrder('order-1')).resolves.toEqual({ id: 'order-1', status: 'confirmed' });
    await expect(getOrder('order-2')).resolves.toBeNull();
    await expect(getOrder('order-3')).resolves.toBeNull();
    expect(mocks.addToast).toHaveBeenCalledWith({ message: 'missing', type: 'error' });
    expect(mocks.addToast).toHaveBeenCalledWith({ message: 'common.networkError', type: 'error' });
  });

  it('rolls back failed order updates and status changes', async () => {
    mocks.authFetch
      .mockResolvedValueOnce({
        json: async () => ({ success: false, message: 'update failed' }),
      })
      .mockRejectedValueOnce(new Error('update network'))
      .mockResolvedValueOnce({
        json: async () => ({ success: false, message: 'status failed' }),
      })
      .mockRejectedValueOnce(new Error('status network'));

    mocks.manageResource.items.value = [{ id: 'order-1', name: 'old', status: 'pending' }];
    const { updateOrder, changeStatus } = useOrders();

    await expect(updateOrder('order-1', { name: 'new' }, 'reason')).resolves.toBe(false);
    expect(mocks.manageResource.items.value[0].name).toBe('old');

    await expect(updateOrder('order-1', { name: 'new' }, 'reason')).resolves.toBe(false);
    expect(mocks.manageResource.items.value[0].name).toBe('old');

    await expect(changeStatus('order-1', 'confirmed')).resolves.toBe(false);
    expect(mocks.manageResource.items.value[0].status).toBe('pending');

    await expect(changeStatus('order-1', 'confirmed')).resolves.toBe(false);
    expect(mocks.manageResource.items.value[0].status).toBe('pending');
  });

  it('handles line command, comment, and delivery failures without throwing', async () => {
    mocks.authFetch
      .mockResolvedValueOnce({ json: async () => ({ success: false, message: 'no reserve' }) })
      .mockRejectedValueOnce(new Error('release network'))
      .mockResolvedValueOnce({ json: async () => ({ success: false, error: 'no ship' }) })
      .mockRejectedValueOnce(new Error('unship network'))
      .mockResolvedValueOnce({ json: async () => ({ success: false, error: 'return no' }) })
      .mockResolvedValueOnce({ json: async () => ({ success: false, error: 'delivery no' }) })
      .mockRejectedValueOnce(new Error('delivery network'))
      .mockResolvedValueOnce({ json: async () => ({ success: false, message: 'comment no' }) })
      .mockRejectedValueOnce(new Error('comment network'));

    const {
      reserveOrderLine,
      releaseOrderLine,
      shipOrderLine,
      unshipOrderLine,
      returnOrderLine,
      confirmOrderDelivery,
      addComment,
    } = useOrders();

    await expect(reserveOrderLine('o-1', 'l-1', 1)).resolves.toBe(false);
    await expect(releaseOrderLine('o-1', 'l-1', 1)).resolves.toBe(false);
    await expect(shipOrderLine('o-1', 'l-1', 1)).resolves.toBe(false);
    await expect(unshipOrderLine('o-1', 'l-1', 1)).resolves.toBe(false);
    await expect(returnOrderLine('o-1', 'l-1', 1)).resolves.toBe(false);
    await expect(confirmOrderDelivery('o-1')).resolves.toBe(false);
    await expect(confirmOrderDelivery('o-1')).resolves.toBe(false);
    await expect(addComment('o-1', 'hello')).resolves.toBe(false);
    await expect(addComment('o-1', 'hello')).resolves.toBe(false);
  });

  it('covers sales auth, login, list, detail, create, comment, and batch actions', async () => {
    mocks.salesOrderApi.auth
      .mockResolvedValueOnce({ ok: false, error: 'bad auth' })
      .mockResolvedValueOnce({ ok: true, data: { token: 'tok' } });
    mocks.salesOrderApi.login
      .mockResolvedValueOnce({ ok: false, error: 'bad login' })
      .mockResolvedValueOnce({ ok: true, data: { token: 'jwt' } });
    mocks.salesOrderApi.list
      .mockResolvedValueOnce({ ok: false, error: 'list fail' })
      .mockResolvedValueOnce({
        ok: true,
        data: Array.from({ length: 101 }, (_, index) => ({ id: `sales-${index + 1}` })),
        pagination: { page: 2, limit: 10, total: 101, totalPages: 11 },
      });
    mocks.salesOrderApi.detail
      .mockResolvedValueOnce({ ok: false, error: 'detail fail' })
      .mockResolvedValueOnce({ ok: true, data: { id: 'sales-1' } });
    mocks.salesOrderApi.create
      .mockResolvedValueOnce({ ok: false, error: 'create fail' })
      .mockResolvedValueOnce({ ok: true, data: { id: 'sales-new' } });
    mocks.salesOrderApi.comment
      .mockResolvedValueOnce({ ok: false, error: 'comment fail' })
      .mockResolvedValueOnce({ ok: true, data: {} });
    mocks.authFetch
      .mockResolvedValueOnce({ json: async () => ({ success: false, message: 'batch fail' }) })
      .mockRejectedValueOnce(new Error('batch network'))
      .mockResolvedValueOnce({ json: async () => ({ success: true, data: { ok: true }, message: 'batch ok' }) });

    const {
      checkSalesAuth,
      loginSales,
      loadSalesOrders,
      getSalesOrder,
      createSalesOrder,
      addSalesComment,
      batchAction,
      salesOrders,
    } = useOrders();

    await expect(checkSalesAuth('')).resolves.toBeNull();
    await expect(checkSalesAuth('token')).resolves.toBeNull();
    await expect(checkSalesAuth('token')).resolves.toEqual({ token: 'tok' });

    await expect(loginSales('token', 'pw')).resolves.toEqual({
      success: false,
      message: 'bad login',
    });
    await expect(loginSales('token', 'pw')).resolves.toEqual({
      success: true,
      data: { token: 'jwt' },
    });

    await expect(loadSalesOrders('sales-token', 1)).resolves.toBe(false);
    await expect(loadSalesOrders('sales-token', 2, true)).resolves.toBe(true);
    expect(salesOrders.value).toHaveLength(100);
    expect(salesOrders.value[0].id).toBe('sales-2');

    await expect(getSalesOrder('sales-token', 'sales-1')).resolves.toBeNull();
    await expect(getSalesOrder('sales-token', 'sales-1')).resolves.toEqual({ id: 'sales-1' });

    await expect(
      createSalesOrder('sales-token', { fileIds: ['f-1'], name: 'A' }, vi.fn())
    ).resolves.toEqual({
      ok: false,
      error: 'create fail',
    });
    const progress = vi.fn();
    await expect(
      createSalesOrder('sales-token', { fileIds: ['f-1'], name: 'A' }, progress)
    ).resolves.toEqual({
      ok: true,
      error: null,
      data: { id: 'sales-new' },
    });
    expect(progress).toHaveBeenCalledWith('creating', 0, 0);
    expect(progress).toHaveBeenCalledWith('done', 0, 0);

    await expect(addSalesComment('sales-token', 'sales-1', 'hi')).resolves.toBe(false);
    await expect(addSalesComment('sales-token', 'sales-1', 'hi')).resolves.toBe(true);

    await expect(batchAction(['o-1'], 'confirm')).resolves.toBeNull();
    await expect(batchAction(['o-1'], 'confirm')).resolves.toBeNull();
    await expect(batchAction(['o-1'], 'confirm')).resolves.toEqual({ ok: true });
  });
});

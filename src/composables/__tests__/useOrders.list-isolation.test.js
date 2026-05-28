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
    apiEndpoint === '/api/manage/orders'
      ? mocks.manageResource
      : mocks.salesResource
  ),
}));

vi.mock('../useAuth', () => ({
  useAuth: () => ({ authFetch: mocks.authFetch }),
}));

vi.mock('../useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('../useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

vi.mock('@/composables/sales/useSalesOrderApi', () => ({
  useSalesOrderApi: () => mocks.salesOrderApi,
}));

import { useOrders } from '../useOrders';

describe('useOrders list isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('keeps the latest manage order list when older requests resolve late', async () => {
    let resolveFirst;
    let resolveSecond;
    mocks.authFetch
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

    const { loadOrders, orders, pagination } = useOrders();
    const firstPending = loadOrders({ page: 1 });
    const secondPending = loadOrders({ page: 2 });

    resolveSecond({
      json: async () => ({
        success: true,
        data: [{ id: 'order-new' }],
        pagination: { page: 2, limit: 20, total: 1, totalPages: 1 },
      }),
    });
    await secondPending;

    expect(orders.value).toEqual([{ id: 'order-new' }]);
    expect(pagination.page).toBe(2);

    resolveFirst({
      json: async () => ({
        success: true,
        data: [{ id: 'order-old' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    });
    await firstPending;

    expect(orders.value).toEqual([{ id: 'order-new' }]);
    expect(pagination.page).toBe(2);
  });

  it('keeps the latest sales order list when older requests resolve late', async () => {
    let resolveFirst;
    let resolveSecond;
    mocks.salesOrderApi.list
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

    const { loadSalesOrders, salesOrders, salesPagination } = useOrders();
    const firstPending = loadSalesOrders('sales-token', 1);
    const secondPending = loadSalesOrders('sales-token', 2);

    resolveSecond({
      ok: true,
      data: [{ id: 'sales-new' }],
      pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });
    await secondPending;

    expect(salesOrders.value).toEqual([{ id: 'sales-new' }]);
    expect(salesPagination.page).toBe(2);

    resolveFirst({
      ok: true,
      data: [{ id: 'sales-old' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    await firstPending;

    expect(salesOrders.value).toEqual([{ id: 'sales-new' }]);
    expect(salesPagination.page).toBe(2);
  });

  it('keeps manage and sales order lists isolated', async () => {
    mocks.authFetch.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: [{ id: 'manage-order' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    });
    mocks.salesOrderApi.list.mockResolvedValueOnce({
      ok: true,
      data: [{ id: 'sales-order' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    const {
      loadOrders,
      loadSalesOrders,
      orders,
      salesOrders,
      pagination,
      salesPagination,
    } = useOrders();

    await loadOrders({ page: 1 });
    await loadSalesOrders('sales-token', 1);

    expect(orders.value).toEqual([{ id: 'manage-order' }]);
    expect(salesOrders.value).toEqual([{ id: 'sales-order' }]);
    expect(pagination.limit).toBe(20);
    expect(salesPagination.limit).toBe(10);
  });
});

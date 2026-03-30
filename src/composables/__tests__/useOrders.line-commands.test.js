import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const resource = {
    items: { value: [{ id: 'o-1', status: 'pending' }] },
    loading: { value: false },
    error: { value: null },
    errorCode: { value: null },
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    abort: vi.fn(),
  };
  return {
    resource,
    authFetch: vi.fn(),
    addToast: vi.fn(),
  };
});

vi.mock('../useResource', () => ({
  useResource: vi.fn(() => mocks.resource),
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
  useSalesOrderApi: () => ({}),
}));

import { useOrders } from '../useOrders';

describe('useOrders line command helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authFetch.mockResolvedValue({
      json: async () => ({ success: true, message: 'ok', data: { ok: true } }),
    });
  });

  it('posts reserve, release, and ship line commands to the dedicated management endpoints', async () => {
    const { reserveOrderLine, releaseOrderLine, shipOrderLine } = useOrders();

    await reserveOrderLine('o-1', 'line-1', 2);
    await releaseOrderLine('o-1', 'line-1', 1);
    await shipOrderLine('o-1', 'line-1', 3);

    expect(mocks.authFetch.mock.calls[0][0]).toBe('/api/manage/orders/o-1/lines/line-1/reserve');
    expect(JSON.parse(mocks.authFetch.mock.calls[0][1].body)).toEqual({ quantity: 2 });
    expect(mocks.authFetch.mock.calls[1][0]).toBe('/api/manage/orders/o-1/lines/line-1/release');
    expect(JSON.parse(mocks.authFetch.mock.calls[1][1].body)).toEqual({ quantity: 1 });
    expect(mocks.authFetch.mock.calls[2][0]).toBe('/api/manage/orders/o-1/lines/line-1/ship');
    expect(JSON.parse(mocks.authFetch.mock.calls[2][1].body)).toEqual({ quantity: 3 });
  });
});

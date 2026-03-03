import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const resource = {
    items: { value: [{ id: 'o-1', name: 'old' }] },
    loading: { value: false },
    error: { value: null },
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

describe('useOrders.updateOrder variant payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resource.items.value = [{ id: 'o-1', name: 'old' }];
    mocks.authFetch.mockResolvedValue({
      json: async () => ({ success: true, message: 'ok' }),
    });
  });

  it('forwards variantId in update payload', async () => {
    const { updateOrder } = useOrders();
    await updateOrder('o-1', { name: 'new' }, 'reason', ['f-1'], 'p-1', 'v-1');

    const [, options] = mocks.authFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body).toMatchObject({
      reason: 'reason',
      productId: 'p-1',
      variantId: 'v-1',
    });
  });

  it('forwards explicit null variantId for unbind flow', async () => {
    const { updateOrder } = useOrders();
    await updateOrder('o-1', { name: 'new' }, 'reason', [], null, null);

    const [, options] = mocks.authFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body).toHaveProperty('productId', null);
    expect(body).toHaveProperty('variantId', null);
  });

  it('replaces optimistic item with server payload when update succeeds', async () => {
    mocks.authFetch.mockResolvedValue({
      json: async () => ({
        success: true,
        message: 'ok',
        data: { id: 'o-1', name: 'server-name', status: 'confirmed' },
      }),
    });

    const { updateOrder } = useOrders();
    const ok = await updateOrder('o-1', { name: 'optimistic-name' }, 'reason');

    expect(ok).toBe(true);
    expect(mocks.resource.items.value[0]).toMatchObject({
      id: 'o-1',
      name: 'server-name',
      status: 'confirmed',
    });
  });
});

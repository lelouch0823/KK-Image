import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const resource = {
    items: { value: [{ id: 'o-1', status: 'pending' }] },
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

describe('useOrders.changeStatus force payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resource.items.value = [{ id: 'o-1', status: 'pending' }];
    mocks.authFetch.mockResolvedValue({
      json: async () => ({ success: true, message: 'ok' }),
    });
  });

  it('forwards force flag and note to status API', async () => {
    const { changeStatus } = useOrders();
    const ok = await changeStatus('o-1', 'fulfilled', 'force reason', true);

    expect(ok).toBe(true);
    const [, options] = mocks.authFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({
      status: 'fulfilled',
      note: 'force reason',
      force: true,
    });
  });
});

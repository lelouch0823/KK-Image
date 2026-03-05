import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const resource = {
    items: { value: [] },
    loading: { value: false },
    error: { value: null },
    errorCode: { value: null },
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
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

describe('useOrders authz handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resource.items.value = [];
    mocks.resource.error.value = null;
    mocks.resource.errorCode.value = null;
  });

  it('sets FORBIDDEN state when order list API returns 403', async () => {
    const forbiddenError = new Error('权限不足: orders:read');
    forbiddenError.status = 403;
    forbiddenError.data = { error: '权限不足: orders:read' };
    mocks.authFetch.mockRejectedValueOnce(forbiddenError);

    const { loadOrders, error, errorCode } = useOrders();
    const ok = await loadOrders();

    expect(ok).toBe(false);
    expect(errorCode.value).toBe('FORBIDDEN');
    expect(error.value).toContain('权限不足');
  });
});

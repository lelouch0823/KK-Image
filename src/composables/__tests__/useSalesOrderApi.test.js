import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ authFetch: mocks.authFetch }),
}));

import { useSalesOrderApi } from '@/composables/sales/useSalesOrderApi';

describe('useSalesOrderApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes success and error payload shape for sales order APIs', async () => {
    const api = useSalesOrderApi();

    mocks.authFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ success: true, data: { items: [] } }),
    });

    const okResult = await api.request('/api/test');
    expect(okResult).toEqual({
      ok: true,
      data: { items: [] },
      error: null,
      pagination: null,
      status: 200,
    });

    mocks.authFetch.mockResolvedValueOnce({
      status: 422,
      json: async () => ({ success: false, error: 'invalid payload' }),
    });

    const failResult = await api.request('/api/test');
    expect(failResult).toEqual({
      ok: false,
      data: null,
      error: 'invalid payload',
      status: 422,
    });
  });
});

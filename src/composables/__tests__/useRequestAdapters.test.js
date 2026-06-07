import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestMock = vi.fn();

vi.mock('@/utils/http-core', () => ({
  request: (...args) => requestMock(...args),
}));

import { useRequestAdapters } from '../useRequestAdapters';

describe('useRequestAdapters', () => {
  beforeEach(() => {
    requestMock.mockReset().mockResolvedValue({ ok: true });
  });

  it('auth adapter injects credentials include', async () => {
    const { requestAuth } = useRequestAdapters();

    await requestAuth('/api/manage/products', { method: 'POST' });

    expect(requestMock).toHaveBeenCalledWith(
      '/api/manage/products',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
  });

  it('sales adapter injects bearer/token header only', async () => {
    const { requestSales } = useRequestAdapters();

    await requestSales('/api/v1/sales/orders', { token: 'sales-token', method: 'GET' });

    expect(requestMock).toHaveBeenCalledWith(
      '/api/v1/sales/orders',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer sales-token',
        }),
      })
    );
    expect(requestMock.mock.calls[0][1].credentials).toBeUndefined();
  });

  it('public adapter does not inject auth credentials', async () => {
    const { requestPublic } = useRequestAdapters();

    await requestPublic('/api/public/health', { method: 'GET' });

    expect(requestMock).toHaveBeenCalledWith(
      '/api/public/health',
      expect.objectContaining({
        method: 'GET',
      })
    );
    expect(requestMock.mock.calls[0][1].credentials).toBeUndefined();
    expect(requestMock.mock.calls[0][1].headers?.Authorization).toBeUndefined();
  });
});

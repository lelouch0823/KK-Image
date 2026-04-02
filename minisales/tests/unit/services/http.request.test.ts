import { describe, expect, it, vi } from 'vitest';
import { installMockWx } from '../../setup/wx';
import { salesRequest } from '../../../miniprogram/services/http/request';

describe('salesRequest', () => {
  it('injects bearer token and unwraps success payload', async () => {
    installMockWx({
      getStorageSync: vi.fn((key: string) => (key === 'sales_token' ? 'jwt-1' : '')),
      request: vi.fn(({ success }: { success?: (res: unknown) => void }) =>
        success?.({
          statusCode: 200,
          data: { success: true, data: { orders: [] } },
        })
      ),
    });

    const result = await salesRequest<{ orders: unknown[] }>({
      path: '/api/sales/token-1/orders',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ orders: [] });
  });

  it('normalizes backend error payloads into a stable shape', async () => {
    installMockWx({
      request: vi.fn(({ success }: { success?: (res: unknown) => void }) =>
        success?.({
          statusCode: 403,
          data: { success: false, error: 'forbidden', code: 'FORBIDDEN' },
        })
      ),
    });

    const result = await salesRequest({
      path: '/api/sales/token-1/orders',
    });

    expect(result).toMatchObject({
      success: false,
      error: 'forbidden',
      code: 'FORBIDDEN',
      status: 403,
    });
  });
});

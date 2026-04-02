import { describe, expect, it, vi } from 'vitest';
import { restoreSalesSession } from '../../../miniprogram/services/auth/session';

describe('restoreSalesSession', () => {
  it('hydrates user state when access token and JWT are valid', async () => {
    const getCurrentUser = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'sp-1', name: 'Alice', store: 'Shanghai' },
    });

    const result = await restoreSalesSession({
      accessToken: 'sales-token',
      getCurrentUser,
    });

    expect(result).toMatchObject({
      ok: true,
      user: { id: 'sp-1', name: 'Alice', store: 'Shanghai' },
    });
  });

  it('clears stale session data when auth check fails', async () => {
    const result = await restoreSalesSession({
      accessToken: 'sales-token',
      getCurrentUser: vi.fn().mockResolvedValue({
        success: false,
        error: 'expired',
      }),
    });

    expect(result).toEqual({ ok: false, reason: 'expired' });
  });
});

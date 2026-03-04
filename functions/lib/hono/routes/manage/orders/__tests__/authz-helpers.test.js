import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
}));

vi.mock('../../../../middleware/auth.js', async () => {
  const actual = await vi.importActual('../../../../middleware/auth.js');
  return {
    ...actual,
    checkPermission: authMocks.checkPermission,
  };
});

import { assertAdminFull, assertForceStatusTransitionAllowed } from '../authz-helpers.js';

describe('orders authz helpers', () => {
  const c = { req: { path: '/api/manage/orders/batch', method: 'POST' } };
  const user = { id: 'u-1', role: 'admin', type: 'user', permissions: [] };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assertAdminFull passes when permission is granted', async () => {
    authMocks.checkPermission.mockResolvedValueOnce(true);
    await expect(assertAdminFull(c, user)).resolves.toBeUndefined();
    expect(authMocks.checkPermission).toHaveBeenCalledWith(c, user, 'admin:full');
  });

  it('assertAdminFull throws ForbiddenError when permission is denied', async () => {
    authMocks.checkPermission.mockResolvedValueOnce(false);
    await expect(assertAdminFull(c, user)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('assertForceStatusTransitionAllowed requires non-empty reason', async () => {
    authMocks.checkPermission.mockResolvedValueOnce(true);
    await expect(assertForceStatusTransitionAllowed(c, user, '   ')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Reason is required for forced status transition',
    });
  });

  it('assertForceStatusTransitionAllowed passes for admin with reason', async () => {
    authMocks.checkPermission.mockResolvedValueOnce(true);
    await expect(
      assertForceStatusTransitionAllowed(c, user, 'manual override by admin')
    ).resolves.toBeUndefined();
  });
});

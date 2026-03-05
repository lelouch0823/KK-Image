import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const mockAuthFetch = vi.fn();
const isAuthenticated = ref(false);

vi.mock('../useAuth', () => ({
  useAuth: () => ({
    authFetch: mockAuthFetch,
    isAuthenticated,
  }),
}));

describe('useAccessControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated.value = false;
  });

  it('loads permissions from /api/v1/permissions/user and allows matched action', async () => {
    isAuthenticated.value = true;
    mockAuthFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: { permissions: ['products:manage'] },
        }),
    });

    const { useAccessControl } = await import('../useAccessControl');
    const access = useAccessControl();
    access.clearPermissions();
    const allowed = await access.can('products:manage');

    expect(allowed).toBe(true);
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/v1/permissions/user');
  });

  it('supports admin:full wildcard', async () => {
    isAuthenticated.value = true;
    mockAuthFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: { permissions: ['admin:full'] },
        }),
    });

    const { useAccessControl } = await import('../useAccessControl');
    const access = useAccessControl();
    access.clearPermissions();
    const allowed = await access.can('notifications:read');

    expect(allowed).toBe(true);
  });

  it('denies missing permission', async () => {
    isAuthenticated.value = true;
    mockAuthFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: { permissions: ['files:read'] },
        }),
    });

    const { useAccessControl } = await import('../useAccessControl');
    const access = useAccessControl();
    access.clearPermissions();
    const allowed = await access.can('products:manage');

    expect(allowed).toBe(false);
  });

  it('clears permission state when user is not authenticated', async () => {
    const { useAccessControl } = await import('../useAccessControl');
    const access = useAccessControl();

    access.clearPermissions();
    access.permissions.value = ['files:read'];
    access.permissionsLoaded.value = true;
    isAuthenticated.value = false;

    const allowed = await access.can('files:read');

    expect(allowed).toBe(false);
    expect(access.permissions.value).toEqual([]);
    expect(access.permissionsLoaded.value).toBe(false);
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });

  it('does not mark permissions loaded when permissions endpoint returns success=false', async () => {
    isAuthenticated.value = true;
    mockAuthFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: false,
          error: 'temporary error',
        }),
    });

    const { useAccessControl } = await import('../useAccessControl');
    const access = useAccessControl();
    access.clearPermissions();

    const allowed = await access.can('files:read');

    expect(allowed).toBe(false);
    expect(access.permissions.value).toEqual([]);
    expect(access.permissionsLoaded.value).toBe(false);
  });
});

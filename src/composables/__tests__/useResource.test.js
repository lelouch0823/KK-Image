import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useResource } from '../useResource';

const mockAuthFetch = vi.fn();
const mockAddToast = vi.fn();

vi.mock('../useAuth', () => ({
  useAuth: () => ({ authFetch: mockAuthFetch }),
}));

vi.mock('../useToast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

describe('useResource Composable Full Coverage', () => {
  const apiEndpoint = '/api/test';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not emit onScopeDispose warning when used outside component scope', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    useResource(apiEndpoint);

    const warnedAboutScopeDispose = warnSpy.mock.calls.some((args) =>
      args.some((arg) => String(arg).includes('onScopeDispose() is called when there is no active effect scope'))
    );
    expect(warnedAboutScopeDispose).toBe(false);
    warnSpy.mockRestore();
  });

  it('updateItem should handle AbortError', async () => {
    const abortErr = new Error('Aborted');
    abortErr.name = 'AbortError';
    mockAuthFetch.mockRejectedValue(abortErr);
    
    const { updateItem } = useResource(apiEndpoint);
    const res = await updateItem(1, {});
    expect(res).toBe(false);
  });

  it('deleteItem should handle AbortError', async () => {
    const abortErr = new Error('Aborted');
    abortErr.name = 'AbortError';
    mockAuthFetch.mockRejectedValue(abortErr);
    
    const { items, deleteItem } = useResource(apiEndpoint);
    items.value = [{ id: 1 }];
    const res = await deleteItem(1);
    expect(res).toBe(false);
  });

  it('abort should call abortController.abort', () => {
      const { abort } = useResource(apiEndpoint);
      abort();
      // Since it's internal we don't directly verify controller, but we can verify it doesn't crash
  });

  it('rawRequest should use subPath correctly', async () => {
    mockAuthFetch.mockResolvedValue({ json: () => Promise.resolve({ data: 'ok' }) });
    const { rawRequest } = useResource(apiEndpoint);
    
    let res = await rawRequest('/sub', { method: 'POST' });
    expect(res.data).toBe('ok');
    expect(mockAuthFetch).toHaveBeenCalledWith(`${apiEndpoint}/sub`, expect.objectContaining({ method: 'POST' }));
    
    await rawRequest();
    expect(mockAuthFetch).toHaveBeenCalledWith(apiEndpoint, expect.anything());
  });

  it('loadItems should retry on failure', async () => {
    mockAuthFetch
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] })
      });
    const { loadItems } = useResource(apiEndpoint, { retryCount: 1, retryDelay: 10 });
    await loadItems();
    expect(mockAuthFetch).toHaveBeenCalledTimes(2);
  });

  it('loadItems should support nested paths, pagination metadata, and cache hits', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            orders: [{ id: 'order-1' }],
          },
          pagination: { page: 2, limit: 5, total: 7, totalPages: 2 },
        }),
    });

    const resource = useResource('/api/nested-orders', { listPath: 'data.orders' });
    const first = await resource.loadItems({ page: 2, limit: 5 });
    const second = await resource.loadItems({ page: 2, limit: 5 });

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(resource.items.value).toEqual([{ id: 'order-1' }]);
    expect(resource.pagination).toMatchObject({ page: 2, limit: 5, total: 7, totalPages: 2 });
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);
  });

  it('loadItems should support subKey payloads and expose API payload errors', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              items: [{ id: 'space-1' }],
            },
          }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: false,
            message: 'bad payload',
          }),
      });

    const nested = useResource('/api/spaces-with-subkey', { subKey: 'items' });
    const errored = useResource('/api/spaces-error');

    await expect(nested.loadItems({}, true)).resolves.toBe(true);
    expect(nested.items.value).toEqual([{ id: 'space-1' }]);

    await expect(errored.loadItems({}, true)).resolves.toBe(false);
    expect(errored.error.value).toBe('bad payload');
    expect(mockAddToast).toHaveBeenCalledWith({ message: 'bad payload', type: 'error' });
  });

  it('loadItems should not retry when forbidden and should expose forbidden state', async () => {
    const forbiddenError = new Error('权限不足: products:manage');
    forbiddenError.status = 403;
    forbiddenError.data = { error: '权限不足: products:manage' };
    mockAuthFetch.mockRejectedValue(forbiddenError);

    const { loadItems, error, errorCode } = useResource('/api/test-forbidden', { retryCount: 2, retryDelay: 10 });
    const ok = await loadItems({}, true);

    expect(ok).toBe(false);
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);
    expect(errorCode.value).toBe('FORBIDDEN');
    expect(error.value).toContain('权限不足');
  });

  it('loadItems should retry when rate limited (429)', async () => {
    const rateLimitError = new Error('Too Many Requests');
    rateLimitError.status = 429;
    mockAuthFetch
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });

    const { loadItems } = useResource('/api/test-rate-limit', { retryCount: 1, retryDelay: 10 });
    const ok = await loadItems({}, true);

    expect(ok).toBe(true);
    expect(mockAuthFetch).toHaveBeenCalledTimes(2);
  });

  it('loadItems should not retry on non-retriable 4xx (404)', async () => {
    const notFoundError = new Error('Not Found');
    notFoundError.status = 404;
    mockAuthFetch.mockRejectedValue(notFoundError);

    const { loadItems, errorCode } = useResource('/api/test-not-found', { retryCount: 2, retryDelay: 10 });
    const ok = await loadItems({}, true);

    expect(ok).toBe(false);
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);
    expect(errorCode.value).toBe('NETWORK_ERROR');
  });

  it('loadItems should expose unauthorized and server error states without forbidden toast leakage', async () => {
    const unauthorized = new Error('Unauthorized');
    unauthorized.status = 401;
    const serverError = new Error('Server exploded');
    serverError.status = 500;

    mockAuthFetch
      .mockRejectedValueOnce(unauthorized)
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: [] }),
      });

    const unauthorizedResource = useResource('/api/test-unauthorized', { retryCount: 0 });
    const serverResource = useResource('/api/test-server', { retryCount: 0 });

    await unauthorizedResource.loadItems({}, true);
    await serverResource.loadItems({}, true);

    expect(unauthorizedResource.errorCode.value).toBe('UNAUTHORIZED');
    expect(serverResource.errorCode.value).toBe('SERVER_ERROR');
    expect(mockAddToast).toHaveBeenCalledWith({
      message: 'common.error.server_error',
      type: 'error',
    });
  });

  it('createItem should handle success, backend failure, and network failure', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: { id: 1 } }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: 'create failed' }),
      })
      .mockRejectedValueOnce(new Error('network down'));

    const resource = useResource('/api/create-check');

    await expect(resource.createItem({ name: 'ok' })).resolves.toEqual({ id: 1 });
    await expect(resource.createItem({ name: 'bad' })).resolves.toBeNull();
    await expect(resource.createItem({ name: 'net' })).resolves.toBeNull();

    expect(mockAddToast).toHaveBeenCalledWith({ message: 'common.created', type: 'success' });
    expect(mockAddToast).toHaveBeenCalledWith({ message: 'create failed', type: 'error' });
    expect(mockAddToast).toHaveBeenCalledWith({ message: 'common.networkError', type: 'error' });
  });

  it('updateItem should optimistically update and rollback on backend failure', async () => {
    const resource = useResource('/api/update-check');
    resource.items.value = [{ id: 1, name: 'old' }];

    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: 'update failed' }),
      });

    await expect(resource.updateItem(1, { name: 'new' })).resolves.toBe(true);
    expect(resource.items.value[0]).toEqual({ id: 1, name: 'new' });

    resource.items.value = [{ id: 1, name: 'stable' }];
    await expect(resource.updateItem(1, { name: 'broken' })).resolves.toBe(false);
    expect(resource.items.value[0]).toEqual({ id: 1, name: 'stable' });
    expect(mockAddToast).toHaveBeenCalledWith({ message: 'update failed', type: 'error' });
  });

  it('deleteItem should rollback on failure and short-circuit when the item is missing', async () => {
    const resource = useResource('/api/delete-check');
    resource.items.value = [{ id: 1, name: 'item-1' }];
    resource.pagination.total = 1;

    mockAuthFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, error: 'delete failed' }),
    });

    await expect(resource.deleteItem(1)).resolves.toBe(false);
    expect(resource.items.value).toEqual([{ id: 1, name: 'item-1' }]);
    expect(resource.pagination.total).toBe(1);
    expect(mockAddToast).toHaveBeenCalledWith({ message: 'delete failed', type: 'error' });
    await expect(resource.deleteItem(999)).resolves.toBe(false);
  });
});

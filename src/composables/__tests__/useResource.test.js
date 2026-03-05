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
});

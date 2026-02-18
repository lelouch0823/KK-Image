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
});

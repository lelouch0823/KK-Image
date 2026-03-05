import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileManager } from '../useFileManager';

const mockAuthFetch = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('../useAuth', () => ({
  useAuth: () => ({
    authFetch: mockAuthFetch,
  }),
}));

vi.mock('../useToast', () => ({
  useToast: () => ({
    success: toastSuccess,
    error: toastError,
  }),
}));

vi.mock('../useI18n', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));

describe('useFileManager authz behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps page-level error clean when mutation is forbidden', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, message: '权限不足: folders:write' }),
    });

    const store = useFileManager();
    const ok = await store.createFolder({ name: 'new-folder' });

    expect(ok).toBe(false);
    expect(store.errorCode.value).toBe(null);
    expect(store.error.value).toBe(null);
    expect(toastError).toHaveBeenCalled();
  });

  it('sets page-level forbidden error when loading list is forbidden', async () => {
    const forbidden = new Error('权限不足: files:read');
    forbidden.status = 403;
    forbidden.data = { error: '权限不足: files:read' };
    mockAuthFetch.mockRejectedValueOnce(forbidden);

    const store = useFileManager();
    await store.loadFolderData('folder-1');

    expect(store.errorCode.value).toBe('FORBIDDEN');
    expect(store.error.value).toContain('权限不足');
  });
});

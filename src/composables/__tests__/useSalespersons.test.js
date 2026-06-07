import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  authFetchJson: vi.fn(),
  addToast: vi.fn(),
  t: vi.fn((key) => key),
  useResource: vi.fn(),
}));

vi.mock('../useAuth', () => ({
  useAuth: () => ({
    authFetch: mocks.authFetch,
    authFetchJson: mocks.authFetchJson,
  }),
}));

vi.mock('../useToast', () => ({
  useToast: () => ({
    addToast: mocks.addToast,
  }),
}));

vi.mock('../useI18n', () => ({
  useI18n: () => ({
    t: mocks.t,
  }),
}));

vi.mock('../useResource', () => ({
  useResource: (...args) => mocks.useResource(...args),
}));

vi.mock('@/utils/constants', () => ({
  API: {
    SALESPERSONS: '/api/salespersons',
    SALESPERSON_RESET_TOKEN: (id) => `/api/salespersons/${id}/reset-token`,
  },
}));

import { useSalespersons } from '../useSalespersons';

describe('useSalespersons', () => {
  let resource;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    resource = {
      items: ref([{ id: 'sales-1' }]),
      loading: ref(false),
      error: ref(null),
      errorCode: ref(null),
      pagination: ref({ total: 1 }),
      loadItems: vi.fn(),
      createItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
    };
    mocks.useResource.mockReturnValue(resource);
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    document.execCommand = vi.fn();
  });

  it('exposes resource state and CRUD methods', () => {
    const salespersons = useSalespersons();

    expect(salespersons.salespersons).toBe(resource.items);
    expect(salespersons.loading).toBe(resource.loading);
    expect(salespersons.error).toBe(resource.error);
    expect(salespersons.errorCode).toBe(resource.errorCode);
    expect(salespersons.pagination).toBe(resource.pagination);
    expect(salespersons.loadSalespersons).toBe(resource.loadItems);
    expect(salespersons.createSalesperson).toBe(resource.createItem);
    expect(salespersons.updateSalesperson).toBe(resource.updateItem);
    expect(salespersons.deleteSalesperson).toBe(resource.deleteItem);
  });

  it('resets tokens and shows success or API error toasts', async () => {
    mocks.authFetchJson
      .mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'new-token' },
      })
      .mockResolvedValueOnce({
        success: false,
        message: 'bad request',
      });

    const salespersons = useSalespersons();

    await expect(salespersons.resetToken('sales-1')).resolves.toEqual({ accessToken: 'new-token' });
    await expect(salespersons.resetToken('sales-2')).resolves.toBeNull();

    expect(mocks.authFetchJson).toHaveBeenNthCalledWith(
      1,
      '/api/salespersons/sales-1/reset-token',
      { method: 'POST' }
    );
    expect(mocks.addToast).toHaveBeenNthCalledWith(1, {
      message: 'salesperson.linkReset',
      type: 'success',
    });
    expect(mocks.addToast).toHaveBeenNthCalledWith(2, { message: 'bad request', type: 'error' });
  });

  it('shows network error toast when resetToken request fails', async () => {
    mocks.authFetch.mockRejectedValueOnce(new Error('offline'));

    const salespersons = useSalespersons();

    await expect(salespersons.resetToken('sales-1')).resolves.toBeNull();
    expect(mocks.addToast).toHaveBeenCalledWith({ message: 'common.networkError', type: 'error' });
  });

  it('copies access links through the secure clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const salespersons = useSalespersons();

    await expect(salespersons.copyAccessLink('token-1')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/sales/token-1`);
    expect(mocks.addToast).toHaveBeenCalledWith({
      message: 'salesperson.linkCopied',
      type: 'success',
    });
  });

  it('falls back to execCommand copy when clipboard API is unavailable or insecure', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;

    const salespersons = useSalespersons();
    const result = await salespersons.copyAccessLink('token-2');

    expect(result).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
    expect(mocks.addToast).toHaveBeenCalledWith({
      message: 'salesperson.linkCopied',
      type: 'success',
    });
  });

  it('falls back after clipboard API failure and returns false when fallback also fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('clipboard blocked')) },
      configurable: true,
    });
    document.execCommand = vi.fn(() => false);

    const salespersons = useSalespersons();
    const result = await salespersons.copyAccessLink('token-3');

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith('Clipboard API failed, trying fallback...');
    expect(errorSpy).toHaveBeenCalledWith('Copy failed', expect.any(Error));
    expect(mocks.addToast).toHaveBeenCalledWith({ message: 'common.copyFailed', type: 'error' });
  });
});

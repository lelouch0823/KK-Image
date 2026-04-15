import { describe, expect, it } from 'vitest';
import { getStorageProvider } from '../index.js';
import { SmartRouter } from '../router.js';

describe('storage defaults', () => {
  it('defaults provider selection to r2 when no explicit provider is configured', () => {
    const provider = getStorageProvider({ R2_BUCKET: {} });

    expect(provider.name).toBe('r2');
  });

  it('falls back unknown providers to r2 instead of telegram', () => {
    const provider = getStorageProvider({ R2_BUCKET: {} }, 'unknown');

    expect(provider.name).toBe('r2');
  });

  it('uses r2 as the single-mode default primary storage', () => {
    const router = new SmartRouter({});

    expect(router.selectStorage({ size: 1024, type: 'image/png', name: 'demo.png' })).toBe('r2');
  });

  it('isolates provider cache by env bindings instead of reusing across distinct env objects', () => {
    const envA = { R2_BUCKET: { bucket: 'a' } };
    const envB = { R2_BUCKET: { bucket: 'b' } };

    const providerA = getStorageProvider(envA);
    const providerB = getStorageProvider(envB);

    expect(providerA).not.toBe(providerB);
    expect(getStorageProvider(envA)).toBe(providerA);
  });

  it('routes small files to r2 in smart mode by default', () => {
    const router = new SmartRouter({ STORAGE_MODE: 'smart' });

    expect(router.selectStorage({ size: 1024, type: 'image/png', name: 'demo.png' })).toBe('r2');
  });
});

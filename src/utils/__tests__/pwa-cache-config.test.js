// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { pwaRuntimeCaching } from '../../../vite.config.js';

describe('PWA runtime caching', () => {
  it('does not cache private API responses', () => {
    expect(pwaRuntimeCaching.map((rule) => rule.options?.cacheName)).not.toContain('api-cache');
    expect(pwaRuntimeCaching.some((rule) => String(rule.urlPattern).includes('/api'))).toBe(false);
  });
});

// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { pwaRuntimeCaching } from '../../../vite.config.js';

describe('PWA runtime caching', () => {
  it('does not cache private API responses', () => {
    expect(pwaRuntimeCaching.map((rule) => rule.options?.cacheName)).not.toContain('api-cache');
    expect(pwaRuntimeCaching.some((rule) => String(rule.urlPattern).includes('/api'))).toBe(false);
  });

  it('does not cache authenticated private file routes', () => {
    // /file/ 路由需要管理员 cookie / 销售 JWT / 分享 token 鉴权：
    // 任何缓存都会在登出或权限回收后泄露旧内容，且 SWR 会先回 stale 响应
    expect(pwaRuntimeCaching.map((rule) => rule.options?.cacheName)).not.toContain('file-cache');
    expect(pwaRuntimeCaching.some((rule) => /\/file\//.test(String(rule.urlPattern)))).toBe(false);
  });
});

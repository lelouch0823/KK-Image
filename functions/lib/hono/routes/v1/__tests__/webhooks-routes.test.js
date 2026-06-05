import { describe, expect, it } from 'vitest';

/**
 * v1 webhooks 路由现在是 manage/webhooks 的薄代理。
 * 这些测试验证 re-export 正确工作。
 */
describe('v1 webhooks routes (thin re-export)', () => {
  it('v1/webhooks re-exports from manage/webhooks', async () => {
    const v1Module = await import('../webhooks.js');
    const manageModule = await import('../../manage/webhooks.js');

    expect(v1Module.default).toBe(manageModule.default);
    expect(v1Module.auditRouteDeclarations).toBe(manageModule.auditRouteDeclarations);
  });
});

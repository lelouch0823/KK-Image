import { describe, expect, it } from 'vitest';

/**
 * v1 文件和文件夹路由现在是 manage 路由的薄代理。
 * 这些测试验证 re-export 正确工作。
 */
describe('v1 file and folder routes (thin re-exports)', () => {
  it('v1/files re-exports from manage/files', async () => {
    const v1Module = await import('../files.js');
    const manageModule = await import('../../manage/files.js');

    expect(v1Module.default).toBe(manageModule.default);
    expect(v1Module.auditRouteDeclarations).toBe(manageModule.auditRouteDeclarations);
  });

  it('v1/folders re-exports from manage/folders', async () => {
    const v1Module = await import('../folders.js');
    const manageModule = await import('../../manage/folders.js');

    expect(v1Module.default).toBe(manageModule.default);
    expect(v1Module.auditRouteDeclarations).toBe(manageModule.auditRouteDeclarations);
  });

  it('v1/webhooks re-exports from manage/webhooks', async () => {
    const v1Module = await import('../webhooks.js');
    const manageModule = await import('../../manage/webhooks.js');

    expect(v1Module.default).toBe(manageModule.default);
    expect(v1Module.auditRouteDeclarations).toBe(manageModule.auditRouteDeclarations);
  });
});

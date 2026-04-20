import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  allowPayload,
  createAdminHeadlessAuditRunner,
  evaluateAdminAuditResults,
  makeResponse,
  pageMeta,
  pickChromePath,
  waitForJson,
} from '../admin-headless-audit-lib.mjs';

describe('admin-headless-audit-lib', () => {
  it('picks the first available chrome path', () => {
    expect(
      pickChromePath({
        candidates: ['/missing', '/chrome'],
        existsSyncImpl: (target) => target === '/chrome',
      })
    ).toBe('/chrome');

    expect(() => pickChromePath({ candidates: ['/missing'], existsSyncImpl: () => false })).toThrow(
      'No Chrome/Edge executable found'
    );
  });

  it('waits for json responses until success and returns page metadata', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, json: vi.fn(async () => ({ ok: true })) });
    const nowValues = [0, 10, 20];
    const result = await waitForJson('http://127.0.0.1:9222/json/list', 100, {
      fetchImpl,
      sleepImpl: vi.fn(async () => undefined),
      nowImpl: () => nowValues.shift() ?? 20,
    });

    expect(result).toEqual({ ok: true });
    expect(pageMeta(new URLSearchParams('page=2&limit=5'))).toEqual({
      page: 2,
      limit: 5,
      total: 0,
      totalPages: 1,
    });
  });

  it('returns allow payloads and violation summaries for multiple routes', () => {
    expect(allowPayload('http://127.0.0.1:4173/api/manage/orders?page=3&limit=10')).toMatchObject({
      success: true,
      data: {
        orders: [],
        pagination: {
          page: 3,
          limit: 10,
        },
      },
    });
    expect(allowPayload('http://127.0.0.1:4173/api/manage/purchase-orders/stats')).toMatchObject({
      success: true,
      data: {
        total: 0,
      },
    });
    expect(allowPayload('http://127.0.0.1:4173/api/v1/permissions/user')).toMatchObject({
      success: true,
      data: {
        permissions: ['admin:full'],
      },
    });
    expect(allowPayload('http://127.0.0.1:4173/api/unknown')).toBeNull();

    expect(makeResponse({ success: true }, 201).responseCode).toBe(201);
    expect(
      evaluateAdminAuditResults(
        [
          { route: '/admin/dashboard', denied: false },
          { route: '/admin/files', denied: true },
          { route: '/admin/forbidden', hasPermissionDeniedState: false },
        ],
        'deny'
      )
    ).toEqual([
      'deny scenario should block /admin/dashboard',
      'forbidden route must render permission-denied-state',
    ]);

    expect(
      evaluateAdminAuditResults(
        [
          { route: '/admin/dashboard', denied: true },
          { route: '/admin/forbidden', hasPermissionDeniedState: true },
        ],
        'allow'
      )
    ).toEqual(['allow scenario should permit /admin/dashboard']);
  });

  it('covers the remaining allow-payload route branches', () => {
    const cases = [
      ['http://127.0.0.1:4173/api/v1/files/abc', 'POST'],
      ['http://127.0.0.1:4173/api/manage/notifications', 'GET'],
      ['http://127.0.0.1:4173/api/manage/notifications/read-all', 'POST'],
      ['http://127.0.0.1:4173/api/manage/dashboard/overview', 'GET'],
      ['http://127.0.0.1:4173/api/manage/stats', 'GET'],
      ['http://127.0.0.1:4173/api/manage/orders/123', 'PATCH'],
      ['http://127.0.0.1:4173/api/manage/orders/batch', 'POST'],
      ['http://127.0.0.1:4173/api/manage/goods-overview', 'GET'],
      ['http://127.0.0.1:4173/api/manage/goods-overview/summary', 'GET'],
      ['http://127.0.0.1:4173/api/manage/purchase-orders', 'GET'],
      ['http://127.0.0.1:4173/api/manage/purchase-orders/stats', 'GET'],
      ['http://127.0.0.1:4173/api/manage/purchase-orders/suggestions', 'GET'],
      ['http://127.0.0.1:4173/api/manage/purchase-orders/po-1', 'PATCH'],
      ['http://127.0.0.1:4173/api/manage/customers?page=3&limit=7', 'GET'],
      ['http://127.0.0.1:4173/api/manage/customers/c-1/orders', 'GET'],
      ['http://127.0.0.1:4173/api/manage/audit-logs?page=2', 'GET'],
      ['http://127.0.0.1:4173/api/manage/audit-logs/actions', 'GET'],
      ['http://127.0.0.1:4173/api/manage/folders', 'GET'],
      ['http://127.0.0.1:4173/api/manage/folders/f-1', 'GET'],
      ['http://127.0.0.1:4173/api/manage/spaces?page=1', 'GET'],
      ['http://127.0.0.1:4173/api/manage/products?page=1', 'GET'],
      ['http://127.0.0.1:4173/api/manage/salespersons?page=1', 'GET'],
      ['http://127.0.0.1:4173/api/manage/anything-else', 'POST'],
    ];

    const payloads = cases.map(([url, method]) => allowPayload(url, method));

    expect(payloads[0]).toEqual({ success: true, data: {} });
    expect(payloads[1]).toMatchObject({ success: true, data: { unreadCount: 0 } });
    expect(payloads[3]).toMatchObject({ success: true, data: { charts: { today: [] } } });
    expect(payloads[4]).toMatchObject({ data: { storage: { totalFiles: 0 } } });
    expect(payloads[5]).toEqual({ success: true, data: {}, message: 'ok' });
    expect(payloads[7]).toMatchObject({ success: true, data: { items: [] } });
    expect(payloads[8]).toMatchObject({ success: true, data: { shortageCount: 0 } });
    expect(payloads[9]).toMatchObject({ success: true, data: { items: [], total: 0 } });
    expect(payloads[10]).toMatchObject({ success: true, data: { draft_count: 0 } });
    expect(payloads[11]).toMatchObject({ success: true, data: [] });
    expect(payloads[13]).toMatchObject({ success: true, data: { page: 3, totalPages: 1 } });
    expect(payloads[15]).toMatchObject({ success: true, pagination: { page: 2, limit: 50 } });
    expect(payloads[18]).toMatchObject({ success: true, data: { id: 'f-1', files: [] } });
    expect(payloads[19]).toMatchObject({ success: true, meta: { page: 1 } });
    expect(payloads[22]).toEqual({ success: true, data: {}, message: 'ok' });
  });

  it('runs the headless audit workflow with injected ws and fs doubles', async () => {
    const written = new Map();
    const kill = vi.fn();
    const wsState = { currentUrl: null };
    class FakeWebSocket {
      constructor() {
        this.onopen = null;
        this.onerror = null;
        this.onmessage = null;
        queueMicrotask(() => this.onopen && this.onopen());
      }
      send(raw) {
        const msg = JSON.parse(raw);
        if (msg.method === 'Page.navigate') {
          wsState.currentUrl = msg.params.url;
        }
        queueMicrotask(() => {
          const result =
            msg.method === 'Runtime.evaluate'
              ? {
                  result: {
                    value: wsState.currentUrl?.includes('/forbidden')
                      ? {
                          path: '/admin/forbidden',
                          title: 'Forbidden',
                          alertCount: 1,
                          hasPermissionDeniedState: true,
                          denied: true,
                          alerts: ['权限不足'],
                        }
                      : {
                          path: wsState.currentUrl ? new URL(wsState.currentUrl).pathname : '/',
                          title: 'Admin',
                          alertCount: 1,
                          hasPermissionDeniedState: false,
                          denied: true,
                          alerts: ['权限不足'],
                        },
                  },
                }
              : msg.method === 'Page.captureScreenshot'
                ? { data: Buffer.from('shot').toString('base64') }
                : {};
          this.onmessage && this.onmessage({ data: JSON.stringify({ id: msg.id, result }) });
        });
      }
      close() {}
    }

    const runner = createAdminHeadlessAuditRunner({
      env: {
        AUDIT_BASE_URL: 'http://127.0.0.1:4173',
        AUDIT_SCENARIO: 'deny',
        SKIP_PREVIEW: '0',
        CHROME_PATH: '/chrome',
      },
      routes: ['/admin/dashboard', '/admin/forbidden'],
      fsModule: {
        mkdir: vi.fn(async () => undefined),
        writeFile: vi.fn(async (file, content) => {
          written.set(file, content);
        }),
      },
      pathModule: path,
      spawnImpl: vi.fn((command, args) => {
        const child = {
          kill,
          on(event, cb) {
            if (event === 'exit') queueMicrotask(() => cb(0));
            return child;
          },
        };
        return child;
      }),
      fetchImpl: vi.fn(async (url) => {
        if (String(url) === 'http://127.0.0.1:4173') return { ok: true, json: async () => ({}) };
        if (String(url).includes('/json/version')) return { ok: true, json: async () => ({}) };
        if (String(url).includes('/json/list')) {
          return {
            ok: true,
            json: async () => [{ type: 'page', webSocketDebuggerUrl: 'ws://127.0.0.1' }],
          };
        }
        return { ok: false, json: async () => ({}) };
      }),
      webSocketCtor: FakeWebSocket,
      setTimeoutImpl: (fn) => {
        fn();
        return 1;
      },
      consoleImpl: { log: vi.fn(), error: vi.fn() },
      existsSyncImpl: () => true,
      skipPreview: false,
    });

    const result = await runner.run();

    expect(result.violations).toEqual([]);
    expect(written.size).toBeGreaterThan(0);
    expect(kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('surfaces violations when allow scenario still denies a protected route', async () => {
    class FakeWebSocket {
      constructor() {
        this.onopen = null;
        this.onerror = null;
        this.onmessage = null;
        queueMicrotask(() => this.onopen && this.onopen());
      }
      send(raw) {
        const msg = JSON.parse(raw);
        queueMicrotask(() => {
          const result = msg.method === 'Runtime.evaluate'
            ? {
                result: {
                  value: {
                    path: '/admin/dashboard',
                    title: 'Admin',
                    alertCount: 0,
                    hasPermissionDeniedState: false,
                    denied: false,
                    alerts: [],
                  },
                },
              }
            : msg.method === 'Page.captureScreenshot'
              ? { data: Buffer.from('shot').toString('base64') }
              : {};
          this.onmessage && this.onmessage({ data: JSON.stringify({ id: msg.id, result }) });
        });
      }
      close() {}
    }

    const runner = createAdminHeadlessAuditRunner({
      env: {
        AUDIT_BASE_URL: 'http://127.0.0.1:4173',
        AUDIT_SCENARIO: 'allow',
        CHROME_PATH: '/chrome',
      },
      routes: ['/admin/dashboard', '/admin/forbidden'],
      fsModule: {
        mkdir: vi.fn(async () => undefined),
        writeFile: vi.fn(async () => undefined),
      },
      pathModule: path,
      spawnImpl: vi.fn(() => ({
        kill: vi.fn(),
        on(event, cb) {
          if (event === 'exit') queueMicrotask(() => cb(0));
          return this;
        },
      })),
      fetchImpl: vi.fn(async (url) => {
        if (String(url) === 'http://127.0.0.1:4173') return { ok: true, json: async () => ({}) };
        if (String(url).includes('/json/version')) return { ok: true, json: async () => ({}) };
        if (String(url).includes('/json/list')) {
          return {
            ok: true,
            json: async () => [{ type: 'page', webSocketDebuggerUrl: 'ws://127.0.0.1' }],
          };
        }
        return { ok: true, json: async () => ({}) };
      }),
      webSocketCtor: FakeWebSocket,
      setTimeoutImpl: (fn) => {
        fn();
        return 1;
      },
      consoleImpl: { log: vi.fn(), error: vi.fn() },
      existsSyncImpl: () => true,
      skipPreview: true,
    });

    await expect(runner.run()).rejects.toThrow('Audit violations: forbidden route must render permission-denied-state');
  });
});

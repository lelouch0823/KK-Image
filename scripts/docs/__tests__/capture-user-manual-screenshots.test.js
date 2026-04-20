import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  createCaptureUserManualScreenshotsRunner,
  fetchJson,
  resolveDocFixtures,
  stabilizePage,
} = require('../capture-user-manual-screenshots-lib.cjs');

function createVisibleLocator(waitFor = vi.fn(async () => undefined)) {
  return {
    first: () => ({ waitFor }),
    nth: () => ({
      fill: vi.fn(async () => undefined),
    }),
    waitFor,
  };
}

describe('capture-user-manual-screenshots-lib', () => {
  it('stabilizes user-facing pages and throws on failed fetchJson responses', async () => {
    const waitFor = vi.fn(async () => undefined);
    const page = {
      locator: vi.fn(() => createVisibleLocator(waitFor)),
      waitForLoadState: vi.fn(async () => undefined),
      evaluate: vi.fn(async () => undefined),
      addStyleTag: vi.fn(async () => undefined),
      waitForTimeout: vi.fn(async () => undefined),
    };

    await stabilizePage(page, 'form');
    expect(waitFor).toHaveBeenCalledWith({ state: 'visible', timeout: 30000 });

    await expect(
      fetchJson(
        {
          fetch: vi.fn(async () => ({
            ok: () => false,
            status: () => 500,
          })),
        },
        'http://localhost:8092/api/manage/salespersons'
      )
    ).rejects.toThrow('Request failed 500');
  });

  it('resolves doc fixtures from management apis', async () => {
    const responses = new Map([
      ['http://localhost:8092/api/manage/salespersons?page=1&limit=50', { data: { salespersons: [{ id: 's1', orderCount: 2, accessToken: 'sales-token' }] } }],
      ['http://localhost:8092/api/manage/shares?page=1&limit=20', { data: { items: [{ shareToken: 'gallery-token' }] } }],
      ['http://localhost:8092/api/gallery/gallery-token', { success: true, data: { files: [{}] } }],
      ['http://localhost:8092/api/manage/spaces?page=1&limit=20', { data: [{ id: 'space-1', fileCount: 1, shareToken: 'space-token' }] }],
    ]);

    const request = {
      fetch: vi.fn(async (url) => ({
        ok: () => true,
        status: () => 200,
        json: async () => responses.get(url),
      })),
    };

    const fixtures = await resolveDocFixtures(request, {
      baseURL: 'http://localhost:8092',
      salesPassword: '123456',
    });

    expect(fixtures).toEqual({
      salesToken: 'sales-token',
      galleryToken: 'gallery-token',
      spaceToken: 'space-token',
    });
    expect(request.fetch).toHaveBeenCalledWith(
      'http://localhost:8092/api/manage/salespersons/s1',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('captures the manual screenshots through the runner', async () => {
    const page = {
      locator: vi.fn(() => createVisibleLocator(vi.fn(async () => undefined))),
      waitForLoadState: vi.fn(async () => undefined),
      evaluate: vi.fn(async () => undefined),
      addStyleTag: vi.fn(async () => undefined),
      waitForTimeout: vi.fn(async () => undefined),
      goto: vi.fn(async () => undefined),
      locator: vi.fn(() => createVisibleLocator(vi.fn(async () => undefined))),
      screenshot: vi.fn(async () => undefined),
      getByRole: vi.fn(() => ({ click: vi.fn(async () => undefined) })),
      waitForURL: vi.fn(async () => undefined),
      emulateMedia: vi.fn(async () => undefined),
      route: vi.fn(async () => undefined),
    };
    page.locator = vi.fn(() => createVisibleLocator(vi.fn(async () => undefined)));
    page.getByText = vi.fn(() => ({ waitFor: vi.fn(async () => undefined) }));
    page.getByRole = vi.fn(() => ({ click: vi.fn(async () => undefined) }));
    page.locator = vi.fn(() => createVisibleLocator(vi.fn(async () => undefined)));

    const authResponse = {
      json: async () => ({ data: { token: 'jwt-token' } }),
    };
    const orderListResponse = {
      json: async () => ({ data: { orders: [{ id: 'order-1' }] } }),
    };

    const request = {
      fetch: vi
        .fn()
        .mockResolvedValueOnce(authResponse)
        .mockResolvedValueOnce(orderListResponse),
    };

    const makeContext = () => ({
      newPage: vi.fn(async () => page),
      request,
      route: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    });

    const browser = {
      newContext: vi
        .fn()
        .mockResolvedValueOnce(makeContext())
        .mockResolvedValueOnce(makeContext())
        .mockResolvedValueOnce(makeContext())
        .mockResolvedValueOnce(makeContext())
        .mockResolvedValueOnce(makeContext()),
      close: vi.fn(async () => undefined),
    };

    const runner = createCaptureUserManualScreenshotsRunner({
      fsModule: { mkdirSync: vi.fn() },
      chromiumImpl: {
        launch: vi.fn(async () => browser),
      },
      pathModule: {
        resolve: (...parts) => parts.join('/'),
        join: (...parts) => parts.join('/'),
      },
      env: {
        USER_BASE_URL: 'http://localhost:8092',
        ADMIN_USER: 'admin',
        ADMIN_PASS: '123',
        SALES_PASS: '123456',
      },
      resolveDocFixturesImpl: vi.fn(async () => ({
        salesToken: 'sales-token',
        galleryToken: 'gallery-token',
        spaceToken: 'space-token',
      })),
    });

    await runner.main();

    expect(browser.newContext).toHaveBeenCalledTimes(5);
    expect(page.screenshot).toHaveBeenCalled();
    expect(browser.close).toHaveBeenCalled();
  });
});

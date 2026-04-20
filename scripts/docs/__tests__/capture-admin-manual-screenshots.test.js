import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  createCaptureAdminManualScreenshotsRunner,
  routes,
  stabilizePage,
} = require('../capture-admin-manual-screenshots-lib.cjs');

function createPageDouble() {
  const mainWait = vi.fn(async () => undefined);
  const fill = vi.fn(async () => undefined);
  const page = {
    locator: vi.fn(() => ({
      first: () => ({
        waitFor: mainWait,
      }),
      nth: () => ({
        fill,
      }),
    })),
    waitForLoadState: vi.fn(async () => undefined),
    evaluate: vi.fn(async () => undefined),
    addStyleTag: vi.fn(async () => undefined),
    waitForTimeout: vi.fn(async () => undefined),
    goto: vi.fn(async () => undefined),
    getByRole: vi.fn(() => ({ click: vi.fn(async () => undefined) })),
    waitForURL: vi.fn(async () => undefined),
    screenshot: vi.fn(async () => undefined),
  };

  return { page, mainWait };
}

describe('capture-admin-manual-screenshots-lib', () => {
  it('stabilizes the page and hides noisy overlays', async () => {
    const { page, mainWait } = createPageDouble();

    await stabilizePage(page);

    expect(mainWait).toHaveBeenCalledWith({ state: 'visible', timeout: 30000 });
    expect(page.evaluate).toHaveBeenCalled();
    expect(page.addStyleTag).toHaveBeenCalled();
    expect(page.waitForTimeout).toHaveBeenCalledWith(1200);
  });

  it('captures configured admin routes through the runner', async () => {
    const { page } = createPageDouble();
    const context = {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => undefined),
    };
    const browser = {
      newContext: vi.fn(async () => context),
      close: vi.fn(async () => undefined),
    };
    const fsModule = { mkdirSync: vi.fn() };
    const consoleImpl = { log: vi.fn(), error: vi.fn() };

    const runner = createCaptureAdminManualScreenshotsRunner({
      fsModule,
      consoleImpl,
      pathModule: {
        resolve: (...parts) => parts.join('/'),
        join: (...parts) => parts.join('/'),
      },
      chromiumImpl: {
        launch: vi.fn(async () => browser),
      },
      routes: routes.slice(0, 2),
      env: {
        ADMIN_BASE_URL: 'http://localhost:8090',
        ADMIN_USER: 'admin',
        ADMIN_PASS: '123',
      },
    });

    await runner.main();

    expect(fsModule.mkdirSync).toHaveBeenCalled();
    expect(page.goto).toHaveBeenCalledWith('http://localhost:8090/login', { waitUntil: 'domcontentloaded' });
    expect(page.screenshot).toHaveBeenCalledTimes(2);
    expect(consoleImpl.log).toHaveBeenCalledWith('captured 01-dashboard.png');
    expect(browser.close).toHaveBeenCalled();
  });
});

import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  createAdminBusinessFlowSmokeRunner,
  createImportCsv,
  createSeed,
  escapeCsv,
  stabilizePage,
} = require('../admin-business-flow-smoke-lib.cjs');

function createPageDouble(options = {}) {
  const fills = new Map();
  const { countByKey = {}, inputValueByKey = {}, textContentByKey = {} } = options;

  const readOverride = (source, key) => (key in source ? source[key] : undefined);

  const defaultTextContent = (key) => {
    if (key.includes('product-detail-brand')) return 'ImportedBrand';
    if (key.includes('product-detail-spu')) return 'spu-1';
    if (key.includes('product-detail-price')) return '99';
    if (key.includes('product-detail-total-stock')) return '9';
    return 'ImportedBrand';
  };

  const createLocator = (key) => {
    const locator = {
      fill: vi.fn(async (value) => {
        fills.set(key, value);
      }),
      click: vi.fn(async () => undefined),
      waitFor: vi.fn(async () => undefined),
      press: vi.fn(async () => undefined),
      hover: vi.fn(async () => undefined),
      setInputFiles: vi.fn(async () => undefined),
      getAttribute: vi.fn(async () => 'select-id'),
      inputValue: vi.fn(async () => readOverride(inputValueByKey, key) ?? fills.get(key) ?? ''),
      textContent: vi.fn(async () => readOverride(textContentByKey, key) ?? defaultTextContent(key)),
      count: vi.fn(async () => readOverride(countByKey, key) ?? 0),
      first: () => locator,
      nth: (index) => createLocator(`${key} nth:${index}`),
      locator: (selector) => createLocator(`${key} locator:${selector}`),
      getByRole: (role, roleOptions = {}) =>
        createLocator(`${key} role:${role}:${String(roleOptions.name ?? '')}`),
      getByTestId: (testId) => createLocator(`${key} testid:${String(testId)}`),
      filter: ({ hasText } = {}) => createLocator(`${key} filter:${String(hasText ?? '')}`),
    };
    return locator;
  };

  return {
    page: {
      goto: vi.fn(async () => undefined),
      locator: vi.fn((selector) => createLocator(`locator:${selector}`)),
      waitForLoadState: vi.fn(async () => undefined),
      evaluate: vi.fn(async () => undefined),
      waitForURL: vi.fn(async () => undefined),
      getByRole: vi.fn((role, roleOptions = {}) => createLocator(`role:${role}:${String(roleOptions.name ?? '')}`)),
      getByTestId: vi.fn((testId) => createLocator(`testid:${String(testId)}`)),
      getByText: vi.fn((text) => createLocator(`text:${String(text)}`)),
      keyboard: { press: vi.fn(async () => undefined) },
      waitForResponse: vi.fn(async () => ({ ok: () => true })),
    },
    fills,
  };
}

describe('admin-business-flow-smoke-lib', () => {
  it('formats deterministic seed and csv content', () => {
    expect(createSeed('ui', { nowImpl: () => 10, randomImpl: () => 0.1234 })).toBe('ui-10-1234');
    expect(escapeCsv('simple')).toBe('simple');
    expect(escapeCsv('a,b')).toBe('"a,b"');
    expect(
      createImportCsv({ name: 'Demo', spu: 'SPU-1', sku: 'SKU-1', color: '黑色' })
    ).toContain('ImportedBrand');
  });

  it('stabilizes and runs the smoke workflow through injected helpers', async () => {
    const { page } = createPageDouble();
    const context = {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => undefined),
    };
    const browser = {
      newContext: vi.fn(async () => context),
      close: vi.fn(async () => undefined),
    };
    const consoleImpl = { log: vi.fn(), error: vi.fn() };

    await stabilizePage(page);
    expect(page.locator).toHaveBeenCalledWith('main');

    const runner = createAdminBusinessFlowSmokeRunner({
      chromiumImpl: {
        launch: vi.fn(async () => browser),
      },
      fsModule: {
        existsSync: vi.fn(() => false),
        mkdtempSync: vi.fn(() => '/tmp/kk'),
        writeFileSync: vi.fn(),
        rmSync: vi.fn(),
      },
      osModule: { tmpdir: () => '/tmp' },
      pathModule: {
        join: (...parts) => parts.join('/'),
      },
      env: {
        ADMIN_BASE_URL: 'http://127.0.0.1:8080',
        ADMIN_USER: 'admin',
        ADMIN_PASS: '123',
        HEADLESS: '1',
        CHROME_BIN: '/usr/bin/google-chrome',
      },
      consoleImpl,
      createSeedImpl: () => 'ui-seed',
      loginImpl: vi.fn(async () => undefined),
      createProductThroughUiImpl: vi.fn(async () => ({ name: 'product', spu: 'spu', sku: 'sku', color: '黑色' })),
      importProductThroughUiImpl: vi.fn(async () => undefined),
      createAndEditPurchaseOrderThroughUiImpl: vi.fn(async () => undefined),
    });

    await runner.main();

    expect(browser.newContext).toHaveBeenCalled();
    expect(consoleImpl.log).toHaveBeenCalledWith(
      JSON.stringify({ success: true, product: { name: 'product', spu: 'spu', sku: 'sku', color: '黑色' } }, null, 2)
    );
    expect(browser.close).toHaveBeenCalled();
  });

  it('executes the built-in login and create-product helpers', async () => {
    const { page } = createPageDouble();
    const runner = createAdminBusinessFlowSmokeRunner({
      env: {
        ADMIN_BASE_URL: 'http://127.0.0.1:8080',
        ADMIN_USER: 'admin',
        ADMIN_PASS: '123',
        HEADLESS: '1',
        CHROME_BIN: '/usr/bin/google-chrome',
      },
    });

    await runner.login(page);
    const product = await runner.createProductThroughUi(page, 'seed-1');

    expect(page.goto).toHaveBeenCalledWith('http://127.0.0.1:8080/login', { waitUntil: 'domcontentloaded' });
    expect(page.goto).toHaveBeenCalledWith('http://127.0.0.1:8080/admin/products', { waitUntil: 'domcontentloaded' });
    expect(product).toEqual({
      name: 'UI Smoke Product seed-1',
      spu: 'UI-SPU-seed-1',
      sku: 'UI-SKU-seed-1',
      color: '黑色',
    });
  });

  it('imports product csv and validates the imported detail content', async () => {
    const { page } = createPageDouble();
    const fsModule = {
      mkdtempSync: vi.fn(() => '/tmp/kk'),
      writeFileSync: vi.fn(),
      rmSync: vi.fn(),
      existsSync: vi.fn(() => false),
    };
    const runner = createAdminBusinessFlowSmokeRunner({
      fsModule,
      osModule: { tmpdir: () => '/tmp' },
      pathModule: { join: (...parts) => parts.join('/') },
      env: {
        ADMIN_BASE_URL: 'http://127.0.0.1:8080',
      },
    });

    await runner.importProductThroughUi(page, {
      name: 'product-1',
      spu: 'spu-1',
      sku: 'sku-1',
      color: '黑色',
    });

    expect(fsModule.writeFileSync).toHaveBeenCalledWith(
      '/tmp/kk/product-import.csv',
      expect.stringContaining('ImportedBrand'),
      'utf8'
    );
    expect(fsModule.rmSync).toHaveBeenCalledWith('/tmp/kk', { recursive: true, force: true });
  });

  it('runs the purchase-order create/edit/remove helper and rejects persistence mismatches', async () => {
    const { page } = createPageDouble();
    const runner = createAdminBusinessFlowSmokeRunner({
      env: {
        ADMIN_BASE_URL: 'http://127.0.0.1:8080',
      },
      createSeedImpl: () => 'remark-seed',
    });

    await runner.createAndEditPurchaseOrderThroughUi(page, { sku: 'sku-1' });

    expect(page.goto).toHaveBeenCalledWith('http://127.0.0.1:8080/admin/purchase-orders', { waitUntil: 'domcontentloaded' });

    const { page: brokenPage } = createPageDouble({
      inputValueByKey: {
        'testid:purchase-order-detail-item-card testid:/purchase-order-detail-item-quantity-/': '5',
        'testid:purchase-order-detail-item-card testid:/purchase-order-detail-item-unit-cost-/': '47',
      },
    });

    await expect(
      runner.createAndEditPurchaseOrderThroughUi(brokenPage, { sku: 'sku-1' })
    ).rejects.toThrow('Purchase order quantity did not persist after reopening detail');
  });
});

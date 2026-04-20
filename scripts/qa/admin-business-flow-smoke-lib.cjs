const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

function createSeed(prefix, options = {}) {
  const nowImpl = options.nowImpl || Date.now;
  const randomImpl = options.randomImpl || Math.random;
  return `${prefix}-${nowImpl()}-${Math.floor(randomImpl() * 10000)}`;
}

function escapeCsv(value) {
  const raw = String(value ?? '');
  if (!/[",\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

function createImportCsv({ name, spu, sku, color }) {
  const rows = [
    ['品名', 'SPU', 'SKU', '品牌', '售价', '成本', '数量', '预警线', '状态', '颜色'],
    [name, spu, sku, 'ImportedBrand', '99', '50', '9', '2', 'active', color],
  ];
  return `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\n')}`;
}

async function stabilizePage(page) {
  await page.locator('main').first().waitFor({ state: 'visible', timeout: 30000 });
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch {
    // Some admin views keep polling; DOM readiness is sufficient for this smoke flow.
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

function createAdminBusinessFlowSmokeRunner(options = {}) {
  const fsModule = options.fsModule || fs;
  const osModule = options.osModule || os;
  const pathModule = options.pathModule || path;
  const chromiumImpl = options.chromiumImpl || chromium;
  const env = options.env || process.env;
  const baseURL = env.ADMIN_BASE_URL || 'http://127.0.0.1:8080';
  const username = env.ADMIN_USER || 'admin';
  const password = env.ADMIN_PASS || '123';
  const headless = env.HEADLESS !== '0';
  const chromePath = env.CHROME_BIN || '/usr/bin/google-chrome';
  const createSeedImpl = options.createSeedImpl || createSeed;
  const stabilizePageImpl = options.stabilizePageImpl || stabilizePage;
  const loginImpl = options.loginImpl || login;
  const createProductThroughUiImpl = options.createProductThroughUiImpl || createProductThroughUi;
  const importProductThroughUiImpl = options.importProductThroughUiImpl || importProductThroughUi;
  const createAndEditPurchaseOrderThroughUiImpl =
    options.createAndEditPurchaseOrderThroughUiImpl || createAndEditPurchaseOrderThroughUi;
  const consoleImpl = options.consoleImpl || console;

  async function login(page) {
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input').nth(0).fill(username);
    await page.locator('input').nth(1).fill(password);
    await Promise.all([
      page.waitForURL(/\/admin(\/.*)?$/, { timeout: 30000 }),
      page.getByRole('button', { name: /登录|log ?in|login/i }).click(),
    ]);
    await stabilizePageImpl(page);
  }

  async function createProductThroughUi(page, seed) {
    const name = `UI Smoke Product ${seed}`;
    const spu = `UI-SPU-${seed}`;
    const sku = `UI-SKU-${seed}`;

    await page.goto(`${baseURL}/admin/products`, { waitUntil: 'domcontentloaded' });
    await stabilizePageImpl(page);

    await page.getByTestId('product-create-trigger').click();
    await page.getByTestId('product-create-modal').waitFor({ state: 'visible', timeout: 30000 });

    await page.getByTestId('product-form-name').fill(name);
    await page.getByTestId('product-form-brand').fill('UI Smoke Brand');
    await page.getByTestId('product-form-category').fill('UI Smoke Category');
    await page.getByTestId('product-form-spu').fill(spu);

    await page.getByTestId('product-option-add').click();
    await page.getByTestId('product-option-name-0').fill('颜色');
    await page.getByTestId('product-option-value-0').fill('黑色');
    await page.getByTestId('product-option-value-0').press('Enter');

    const variantRow = page.getByTestId('variant-row-0');
    await variantRow.waitFor({ state: 'visible', timeout: 30000 });
    await page.getByTestId('variant-sku-0').fill(sku);
    await page.getByTestId('variant-price-0').fill('88');
    await page.getByTestId('variant-cost-0').fill('45');
    await page.getByTestId('variant-stock-0').fill('3');
    await page.getByTestId('variant-alert-0').fill('1');

    await page.getByTestId('product-create-submit').click();
    await page.getByTestId('product-create-modal').waitFor({ state: 'hidden', timeout: 30000 });

    const detailEditTrigger = page.getByTestId('enter-edit');
    try {
      await detailEditTrigger.waitFor({ state: 'visible', timeout: 5000 });
      await page.keyboard.press('Escape');
      await detailEditTrigger.waitFor({ state: 'hidden', timeout: 30000 });
    } catch {
      // Auto-open detail is filter/order dependent; the flow can continue without it.
    }

    return { name, spu, sku, color: '黑色' };
  }

  async function importProductThroughUi(page, product) {
    const tempDir = fsModule.mkdtempSync(pathModule.join(osModule.tmpdir(), 'kk-image-ui-smoke-'));
    const csvPath = pathModule.join(tempDir, 'product-import.csv');
    fsModule.writeFileSync(csvPath, createImportCsv(product), 'utf8');

    try {
      await page.getByTestId('product-import-trigger').click();
      await page.getByTestId('product-import-modal').waitFor({ state: 'visible', timeout: 30000 });
      await page.getByTestId('product-import-file-input').setInputFiles(csvPath);

      await page.getByTestId('product-import-confirm-mapping').waitFor({ state: 'visible', timeout: 30000 });
      const specNameInput = page.getByTestId('product-import-spec-name-0');
      const specColumnSelect = page.getByTestId('product-import-spec-column-0');
      const specColumnTrigger = specColumnSelect.getByRole('button');
      const triggerId = await specColumnTrigger.getAttribute('id');

      await page.getByTestId('product-import-mode-replace').click();
      await specNameInput.fill('颜色');
      await specColumnTrigger.click();
      await page
        .locator(`[data-select-id="${triggerId}"]`)
        .getByRole('button', { name: '颜色', exact: true })
        .click();
      await page.getByTestId('product-import-confirm-mapping').click();

      await page.getByTestId('product-import-submit').waitFor({ state: 'visible', timeout: 30000 });
      await page.getByTestId('product-import-submit').click();

      await page.getByText('导入完成！', { exact: true }).waitFor({ state: 'visible', timeout: 30000 });
      await page.getByTestId('product-import-submit').click();
      await page.getByTestId('product-import-modal').waitFor({ state: 'hidden', timeout: 30000 });

      const productListEntry = page.getByText(product.name, { exact: false }).first();
      await productListEntry.waitFor({ state: 'visible', timeout: 30000 });
      await productListEntry.click();

      const detailContent = page.getByTestId('product-detail-content');
      await detailContent.waitFor({ state: 'visible', timeout: 30000 });

      const detailLoading = page.getByTestId('detail-loading');
      if (await detailLoading.count()) {
        await detailLoading.waitFor({ state: 'hidden', timeout: 30000 });
      }

      await page.getByTestId('product-detail-name').waitFor({ state: 'visible', timeout: 30000 });
      const brandText = await page.getByTestId('product-detail-brand').textContent();
      const spuText = await page.getByTestId('product-detail-spu').textContent();
      const priceText = await page.getByTestId('product-detail-price').textContent();
      const stockText = await page.getByTestId('product-detail-total-stock').textContent();

      if (String(brandText || '').trim() !== 'ImportedBrand') {
        throw new Error(`Imported product brand did not persist: ${brandText}`);
      }
      if (String(spuText || '').trim() !== product.spu) {
        throw new Error(`Imported product SPU changed unexpectedly: ${spuText}`);
      }
      if (!String(priceText || '').includes('99')) {
        throw new Error(`Imported product price did not update to replace value: ${priceText}`);
      }
      if (String(stockText || '').trim() !== '9') {
        throw new Error(`Imported product stock did not update to replace value: ${stockText}`);
      }

      await page.keyboard.press('Escape');
      await detailContent.waitFor({ state: 'hidden', timeout: 30000 });
    } finally {
      fsModule.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  async function createAndEditPurchaseOrderThroughUi(page, product) {
    const remark = `UI-PO-${createSeedImpl('remark')}`;
    const itemMutationPattern = /\/api\/manage\/purchase-orders\/[^/]+\/items\/[^/]+$/;

    await page.goto(`${baseURL}/admin/purchase-orders`, { waitUntil: 'domcontentloaded' });
    await stabilizePageImpl(page);

    await page.getByTestId('purchase-order-open-create').click();
    await page.getByTestId('purchase-order-create-shell').waitFor({ state: 'visible', timeout: 30000 });
    await page.getByTestId('purchase-order-create-remark').fill(remark);
    await page.getByTestId('purchase-order-open-product-picker-create').click();

    const picker = page.getByTestId('purchase-order-product-picker-shell');
    await picker.waitFor({ state: 'visible', timeout: 30000 });
    await page.getByTestId('purchase-order-product-picker-search').locator('input').fill(product.sku);
    const resultRow = picker.getByTestId(/purchase-order-product-picker-row-/).filter({ hasText: product.sku }).first();
    await resultRow.waitFor({ state: 'visible', timeout: 30000 });
    await resultRow.click();
    await page.getByTestId('purchase-order-product-picker-confirm').click();

    await page.getByTestId('purchase-order-create-submit').click();
    await page.getByTestId('purchase-order-create-shell').waitFor({ state: 'hidden', timeout: 30000 });

    const detailShell = page.getByTestId('purchase-order-detail-shell');
    const openDetailByRemark = async () => {
      const remarkCell = page.getByText(remark, { exact: false }).first();
      await remarkCell.waitFor({ state: 'visible', timeout: 30000 });
      await remarkCell.click();
      await detailShell.waitFor({ state: 'visible', timeout: 30000 });
    };

    const closeDetail = async () => {
      await page.getByTestId('purchase-order-detail-close').click();
      await detailShell.waitFor({ state: 'hidden', timeout: 30000 });
    };

    await openDetailByRemark();

    const itemCard = page.getByTestId('purchase-order-detail-item-card').first();
    await itemCard.waitFor({ state: 'visible', timeout: 30000 });

    const quantityInput = itemCard.getByTestId(/purchase-order-detail-item-quantity-/).first();
    await quantityInput.fill('6');
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === 'PATCH' && itemMutationPattern.test(response.url()), { timeout: 30000 }),
      quantityInput.press('Tab'),
    ]);

    const unitCostInput = itemCard.getByTestId(/purchase-order-detail-item-unit-cost-/).first();
    await unitCostInput.fill('47');
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === 'PATCH' && itemMutationPattern.test(response.url()), { timeout: 30000 }),
      unitCostInput.press('Tab'),
    ]);

    await closeDetail();
    await openDetailByRemark();

    const reopenedItemCard = page.getByTestId('purchase-order-detail-item-card').first();
    await reopenedItemCard.waitFor({ state: 'visible', timeout: 30000 });
    const reopenedQuantityInput = reopenedItemCard.getByTestId(/purchase-order-detail-item-quantity-/).first();
    const reopenedUnitCostInput = reopenedItemCard.getByTestId(/purchase-order-detail-item-unit-cost-/).first();

    if ((await reopenedQuantityInput.inputValue()) !== '6') {
      throw new Error('Purchase order quantity did not persist after reopening detail');
    }
    if ((await reopenedUnitCostInput.inputValue()) !== '47') {
      throw new Error('Purchase order unit cost did not persist after reopening detail');
    }

    await reopenedItemCard.hover();
    const removeButton = reopenedItemCard.getByTestId(/purchase-order-detail-item-remove-/).first();
    await removeButton.waitFor({ state: 'visible', timeout: 30000 });
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === 'DELETE' && itemMutationPattern.test(response.url()), { timeout: 30000 }),
      removeButton.click(),
    ]);
    await page.getByTestId('purchase-order-detail-item-card').waitFor({ state: 'hidden', timeout: 30000 });

    await closeDetail();
    await openDetailByRemark();
    await page.locator('[data-testid="purchase-order-detail-item-card"]').first().waitFor({ state: 'hidden', timeout: 30000 });
  }

  async function main() {
    const browser = await chromiumImpl.launch({
      headless,
      executablePath: fsModule.existsSync(chromePath) ? chromePath : undefined,
      args: ['--no-sandbox'],
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    try {
      await loginImpl(page);
      const product = await createProductThroughUiImpl(page, createSeedImpl('ui'));
      await importProductThroughUiImpl(page, product);
      await createAndEditPurchaseOrderThroughUiImpl(page, product);
      consoleImpl.log(JSON.stringify({ success: true, product }, null, 2));
    } finally {
      await context.close();
      await browser.close();
    }
  }

  return {
    main,
    login,
    createProductThroughUi,
    importProductThroughUi,
    createAndEditPurchaseOrderThroughUi,
  };
}

module.exports = {
  createSeed,
  escapeCsv,
  createImportCsv,
  stabilizePage,
  createAdminBusinessFlowSmokeRunner,
};

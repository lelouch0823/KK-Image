const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const baseURL = process.env.ADMIN_BASE_URL || 'http://127.0.0.1:8080';
const username = process.env.ADMIN_USER || 'admin';
const password = process.env.ADMIN_PASS || '123';
const headless = process.env.HEADLESS !== '0';
const chromePath = process.env.CHROME_BIN || '/usr/bin/google-chrome';

function createSeed(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
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

async function login(page) {
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input').nth(0).fill(username);
  await page.locator('input').nth(1).fill(password);
  await Promise.all([
    page.waitForURL(/\/admin(\/.*)?$/, { timeout: 30000 }),
    page.getByRole('button', { name: /登录|log ?in|login/i }).click(),
  ]);
  await stabilizePage(page);
}

async function createProductThroughUi(page, seed) {
  const name = `UI Smoke Product ${seed}`;
  const spu = `UI-SPU-${seed}`;
  const sku = `UI-SKU-${seed}`;

  await page.goto(`${baseURL}/admin/products`, { waitUntil: 'domcontentloaded' });
  await stabilizePage(page);

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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-image-ui-smoke-'));
  const csvPath = path.join(tempDir, 'product-import.csv');
  fs.writeFileSync(csvPath, createImportCsv(product), 'utf8');

  try {
    await page.getByTestId('product-import-trigger').click();
    await page.getByTestId('product-import-modal').waitFor({ state: 'visible', timeout: 30000 });
    await page.getByTestId('product-import-file-input').setInputFiles(csvPath);

    await page.getByTestId('product-import-confirm-mapping').waitFor({ state: 'visible', timeout: 30000 });
    const specNameInput = page.getByTestId('product-import-spec-name-0');
    const specColumnSelect = page.getByTestId('product-import-spec-column-0');
    const specColumnTrigger = specColumnSelect.getByRole('button');
    const triggerId = await specColumnTrigger.getAttribute('id');

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
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function createAndEditPurchaseOrderThroughUi(page, product) {
  const remark = `UI-PO-${createSeed('remark')}`;

  await page.goto(`${baseURL}/admin/purchase-orders`, { waitUntil: 'domcontentloaded' });
  await stabilizePage(page);

  await page.getByTestId('purchase-order-open-create').click();
  await page.getByTestId('purchase-order-create-shell').waitFor({ state: 'visible', timeout: 30000 });
  await page.getByTestId('purchase-order-create-remark').fill(remark);
  await page.getByTestId('purchase-order-open-product-picker-create').click();

  const picker = page.getByTestId('purchase-order-product-picker-shell');
  await picker.waitFor({ state: 'visible', timeout: 30000 });
  await picker.locator('input').first().fill(product.sku);
  await page.waitForTimeout(400);
  await picker.locator('input[type="checkbox"]').first().check();
  await page.getByTestId('purchase-order-product-picker-confirm').click();

  await page.getByTestId('purchase-order-create-submit').click();
  await page.getByTestId('purchase-order-create-shell').waitFor({ state: 'hidden', timeout: 30000 });

  const remarkCell = page.getByText(remark, { exact: false }).first();
  await remarkCell.waitFor({ state: 'visible', timeout: 30000 });
  await remarkCell.click();

  const detailShell = page.getByTestId('purchase-order-detail-shell');
  await detailShell.waitFor({ state: 'visible', timeout: 30000 });

  const itemCard = page.getByTestId('purchase-order-detail-item-card').first();
  await itemCard.waitFor({ state: 'visible', timeout: 30000 });

  const quantityInput = itemCard.getByTestId(/purchase-order-detail-item-quantity-/).first();
  await quantityInput.fill('6');
  await quantityInput.press('Tab');

  const unitCostInput = itemCard.getByTestId(/purchase-order-detail-item-unit-cost-/).first();
  await unitCostInput.fill('47');
  await unitCostInput.press('Tab');

  await page.waitForTimeout(600);
  await itemCard.hover();
  await itemCard.getByTestId(/purchase-order-detail-item-remove-/).first().click();
  await page.getByTestId('purchase-order-detail-item-card').waitFor({ state: 'hidden', timeout: 30000 });
}

async function main() {
  const browser = await chromium.launch({
    headless,
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();

  try {
    await login(page);
    const product = await createProductThroughUi(page, createSeed('ui'));
    await importProductThroughUi(page, product);
    await createAndEditPurchaseOrderThroughUi(page, product);
    console.log(JSON.stringify({ success: true, product }, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

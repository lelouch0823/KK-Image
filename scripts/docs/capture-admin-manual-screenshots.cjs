const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseURL = process.env.ADMIN_BASE_URL || 'http://localhost:8090';
const screenshotDir = path.resolve(process.cwd(), 'docs/assets/admin-manual');
const username = process.env.ADMIN_USER || 'admin';
const password = process.env.ADMIN_PASS || '123';

const routes = [
  { file: '01-dashboard.png', path: '/admin/dashboard' },
  { file: '02-files.png', path: '/admin/files' },
  { file: '03-spaces.png', path: '/admin/spaces' },
  { file: '04-products.png', path: '/admin/products' },
  { file: '05-orders.png', path: '/admin/orders' },
  { file: '06-goods-overview.png', path: '/admin/goods-overview' },
  { file: '07-purchase-orders.png', path: '/admin/purchase-orders' },
  { file: '08-customers.png', path: '/admin/customers' },
  { file: '09-salespersons.png', path: '/admin/salespersons' },
  { file: '10-stats.png', path: '/admin/stats' },
  { file: '11-settings.png', path: '/admin/settings' },
  { file: '12-audit-logs.png', path: '/admin/audit-logs' },
  { file: '13-outbox-ops.png', path: '/admin/outbox-ops' },
];

async function stabilizePage(page) {
  await page.locator('main').first().waitFor({ state: 'visible', timeout: 30000 });
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch {
    // Some admin pages keep background polling alive; visible content is enough for docs screenshots.
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.addStyleTag({
    content: `
      #nprogress,
      [data-sonner-toaster],
      .Toastify,
      [role="status"][aria-live] {
        display: none !important;
      }
      * {
        caret-color: transparent !important;
      }
    `,
  });
  await page.waitForTimeout(1200);
}

async function main() {
  fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();

  try {
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input').nth(0).fill(username);
    await page.locator('input').nth(1).fill(password);
    await Promise.all([
      page.waitForURL(/\/admin(\/.*)?$/, { timeout: 30000 }),
      page.getByRole('button', { name: /登录|log ?in|login/i }).click(),
    ]);
    await stabilizePage(page);

    for (const route of routes) {
      await page.goto(`${baseURL}${route.path}`, { waitUntil: 'domcontentloaded' });
      await stabilizePage(page);
      await page.screenshot({
        path: path.join(screenshotDir, route.file),
        fullPage: false,
        caret: 'hide',
      });
      console.log(`captured ${route.file}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

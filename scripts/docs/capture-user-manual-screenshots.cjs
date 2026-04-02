const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseURL = process.env.USER_BASE_URL || 'http://localhost:8092';
const screenshotDir = path.resolve(process.cwd(), 'docs/assets/user-manual');
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPass = process.env.ADMIN_PASS || '123';
const salesPassword = process.env.SALES_PASS || '123456';
const salesViewport = { width: 390, height: 844 };

async function stabilizePage(page, waitFor) {
  if (waitFor) {
    await page.locator(waitFor).first().waitFor({ state: 'visible', timeout: 30000 });
  } else {
    await page.locator('body').waitFor({ state: 'visible', timeout: 30000 });
  }
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch {
    // Some pages poll in the background; visible content is enough.
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
  await page.waitForTimeout(1000);
}

async function fetchJson(request, url, options = {}) {
  const response = await request.fetch(url, options);
  if (!response.ok()) {
    throw new Error(`Request failed ${response.status()} ${url}`);
  }
  return response.json();
}

async function resolveDocFixtures(request) {
  const salesList = await fetchJson(request, `${baseURL}/api/manage/salespersons?page=1&limit=50`);
  const salesperson = (salesList?.data?.salespersons || []).find((item) => Number(item.orderCount || 0) > 0);
  if (!salesperson) {
    throw new Error('No salesperson with orders found for docs screenshots');
  }

  await fetchJson(request, `${baseURL}/api/manage/salespersons/${salesperson.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ password: salesPassword }),
  });

  const sharesList = await fetchJson(request, `${baseURL}/api/manage/shares?page=1&limit=20`);
  const shareItems = sharesList?.data?.items || [];
  let galleryToken = shareItems[0]?.shareToken || null;
  for (const item of shareItems) {
    const gallery = await fetchJson(request, `${baseURL}/api/gallery/${item.shareToken}`);
    if (gallery?.success) {
      galleryToken = item.shareToken;
      if ((gallery?.data?.files || []).length > 0) break;
    }
  }
  if (!galleryToken) {
    throw new Error('No gallery share token available for docs screenshots');
  }

  const spaces = await fetchJson(request, `${baseURL}/api/manage/spaces?page=1&limit=20`);
  const publicSpaceCandidate = (spaces?.data || []).find((item) => Number(item.fileCount || 0) > 0) || spaces?.data?.[0];
  if (!publicSpaceCandidate) {
    throw new Error('No space available for docs screenshots');
  }

  await fetchJson(request, `${baseURL}/api/manage/spaces/${publicSpaceCandidate.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ isPublic: true }),
  });

  return {
    salesToken: salesperson.accessToken,
    galleryToken,
    spaceToken: publicSpaceCandidate.shareToken,
  };
}

async function main() {
  fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox'],
  });

  try {
    const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    const adminPage = await adminContext.newPage();

    await adminPage.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
    await adminPage.locator('input').nth(0).fill(adminUser);
    await adminPage.locator('input').nth(1).fill(adminPass);
    await Promise.all([
      adminPage.waitForURL(/\/admin(\/.*)?$/, { timeout: 30000 }),
      adminPage.getByRole('button', { name: /登录|log ?in|login/i }).click(),
    ]);
    await stabilizePage(adminPage, 'form, main, body');

    const fixtures = await resolveDocFixtures(adminContext.request);

    const loginContext = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    const loginPage = await loginContext.newPage();

    await loginPage.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
    await stabilizePage(loginPage, 'form');
    await loginPage.screenshot({
      path: path.join(screenshotDir, '01-admin-login.png'),
      fullPage: false,
      caret: 'hide',
    });

    const publicContext = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    const publicPage = await publicContext.newPage();

    await publicPage.goto(`${baseURL}/gallery/${fixtures.galleryToken}`, { waitUntil: 'domcontentloaded' });
    await stabilizePage(publicPage, 'header, [data-testid="async-empty"], main, body');
    await publicPage.screenshot({
      path: path.join(screenshotDir, '02-gallery-share.png'),
      fullPage: false,
      caret: 'hide',
    });

    await publicPage.goto(`${baseURL}/space/${fixtures.spaceToken}`, { waitUntil: 'domcontentloaded' });
    await stabilizePage(publicPage, 'footer, main, body');
    await publicPage.screenshot({
      path: path.join(screenshotDir, '03-space-share.png'),
      fullPage: false,
      caret: 'hide',
    });

    const salesLoginContext = await browser.newContext({
      viewport: salesViewport,
      screen: salesViewport,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    const salesLoginPage = await salesLoginContext.newPage();

    await salesLoginPage.goto(`${baseURL}/sales/${fixtures.salesToken}`, { waitUntil: 'domcontentloaded' });
    await stabilizePage(salesLoginPage, 'form');
    await salesLoginPage.screenshot({
      path: path.join(screenshotDir, '04-sales-login.png'),
      fullPage: false,
      caret: 'hide',
    });

    const salesAuthResponse = await adminContext.request.fetch(`${baseURL}/api/sales/${fixtures.salesToken}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ password: salesPassword }),
    });
    const salesAuthPayload = await salesAuthResponse.json();
    const salesJwt = salesAuthPayload?.data?.token;
    if (!salesJwt) {
      throw new Error('Failed to obtain sales JWT for docs screenshots');
    }

    const salesContext = await browser.newContext({
      viewport: salesViewport,
      screen: salesViewport,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    await salesContext.route(`${baseURL}/api/sales/**`, async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          Authorization: `Bearer ${salesJwt}`,
        },
      });
    });
    const salesPage = await salesContext.newPage();

    await salesPage.emulateMedia({ media: 'screen' });
    await salesPage.goto(`${baseURL}/sales/${fixtures.salesToken}`, { waitUntil: 'domcontentloaded' });
    await stabilizePage(salesPage, '.order-item, [data-testid="async-empty"], body');
    await salesPage.screenshot({
      path: path.join(screenshotDir, '05-sales-orders.png'),
      fullPage: false,
      caret: 'hide',
    });

    const orderListResponse = await salesContext.request.fetch(
      `${baseURL}/api/sales/${fixtures.salesToken}/orders?page=1&limit=3`,
      {
        headers: { Authorization: `Bearer ${salesJwt}` },
      }
    );
    const orderList = await orderListResponse.json();
    const firstOrderId = orderList?.data?.orders?.[0]?.id || null;

    await salesPage.goto(`${baseURL}/sales/${fixtures.salesToken}/create`, { waitUntil: 'domcontentloaded' });
    await stabilizePage(salesPage, '[data-testid="binding-header"], form, body');
    await salesPage.screenshot({
      path: path.join(screenshotDir, '06-sales-create.png'),
      fullPage: false,
      caret: 'hide',
    });

    if (firstOrderId) {
      await salesPage.goto(`${baseURL}/sales/${fixtures.salesToken}/detail/${firstOrderId}`, { waitUntil: 'domcontentloaded' });
      await stabilizePage(salesPage, '[data-testid="order-lines-card"], body');
      await salesPage.screenshot({
        path: path.join(screenshotDir, '07-sales-detail.png'),
        fullPage: false,
        caret: 'hide',
      });
    }

    await salesPage.goto(`${baseURL}/sales/${fixtures.salesToken}/stats`, { waitUntil: 'domcontentloaded' });
    await stabilizePage(salesPage, '[data-testid="stats-empty"], [data-testid="stats-error"], body');
    await salesPage.screenshot({
      path: path.join(screenshotDir, '08-sales-stats.png'),
      fullPage: false,
      caret: 'hide',
    });

    await salesPage.goto(`${baseURL}/sales/${fixtures.salesToken}/spaces`, { waitUntil: 'domcontentloaded' });
    await stabilizePage(salesPage, 'a[href^="/space/"], body');
    await salesPage.screenshot({
      path: path.join(screenshotDir, '09-sales-spaces.png'),
      fullPage: false,
      caret: 'hide',
    });

    await loginContext.close();
    await adminContext.close();
    await publicContext.close();
    await salesLoginContext.close();
    await salesContext.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

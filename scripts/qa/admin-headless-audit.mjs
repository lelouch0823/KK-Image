import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BASE_URL = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:4173';
const CDP_PORT = Number(process.env.CDP_PORT || 9222);
const AUDIT_SCENARIO = process.env.AUDIT_SCENARIO || 'deny';
const OUTPUT_DIR = path.resolve('artifacts', 'admin-audit', AUDIT_SCENARIO);
const USER_DATA_DIR = path.resolve('.tmp', 'chrome-headless-audit');
const SKIP_PREVIEW = process.env.SKIP_PREVIEW === '1';

const adminRoutes = [
  '/admin/dashboard',
  '/admin/files',
  '/admin/spaces',
  '/admin/salespersons',
  '/admin/products',
  '/admin/orders',
  '/admin/goods-overview',
  '/admin/purchase-orders',
  '/admin/customers',
  '/admin/stats',
  '/admin/audit-logs',
];

function pickChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error('No Chrome/Edge executable found. Set CHROME_PATH.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
    } catch {
      // retry
    }
    await sleep(250);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

function makeResponse(body, code = 200, headers = { 'Content-Type': 'application/json' }) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const headerEntries = Object.entries(headers).map(([name, value]) => ({
    name,
    value: String(value),
  }));
  return {
    responseCode: code,
    responseHeaders: headerEntries,
    body: Buffer.from(text, 'utf8').toString('base64'),
  };
}

function pageMeta(searchParams, fallbackLimit = 20) {
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || fallbackLimit);
  return { page, limit, total: 0, totalPages: 1 };
}

function allowPayload(url, method = 'GET') {
  const u = new URL(url);
  const { pathname, searchParams } = u;
  const m = String(method || 'GET').toUpperCase();

  if (pathname === '/api/v1/files' && m === 'GET') {
    return { success: true, data: { data: [], pagination: pageMeta(searchParams) } };
  }
  if (pathname.startsWith('/api/v1/files/')) {
    return { success: true, data: {} };
  }
  if (pathname === '/api/v1/permissions' || pathname === '/api/v1/permissions/user') {
    return {
      success: true,
      data: {
        roles: ['admin'],
        permissions: ['admin:full'],
        effectivePermissions: ['admin:full'],
      },
    };
  }

  if (pathname === '/api/manage/notifications' && m === 'GET') {
    return { success: true, data: { list: [], unreadCount: 0 } };
  }
  if (pathname.startsWith('/api/manage/notifications/')) {
    return { success: true, data: {} };
  }

  if (pathname === '/api/manage/dashboard/overview' && m === 'GET') {
    return {
      success: true,
      data: {
        todayCount: 0,
        pendingCount: 0,
        weekCount: 0,
        lastWeekCount: 0,
        activeSharesCount: 0,
        recentPendingOrders: [],
        recentFiles: [],
        recentShares: [],
        charts: {
          today: [],
          pending: [],
          week: [],
          shares: [],
        },
      },
    };
  }

  if (pathname === '/api/manage/stats' && m === 'GET') {
    return {
      data: {
        storage: {
          totalFiles: 0,
          todayUploads: 0,
          totalSize: 0,
          largeFiles: [],
        },
        traffic: {
          monthTotal: 0,
          daily: {},
          topSpaces: [],
        },
        health: {
          status: {
            normal: 0,
            blocked: 0,
            whitelisted: 0,
            liked: 0,
          },
          fileTypes: [],
        },
      },
    };
  }

  if (pathname === '/api/manage/orders' && m === 'GET') {
    return {
      success: true,
      data: {
        orders: [],
        salespersons: [],
        statuses: ['pending', 'confirmed', 'completed', 'cancelled'],
        pagination: pageMeta(searchParams),
      },
    };
  }
  if (pathname.startsWith('/api/manage/orders/')) {
    return { success: true, data: {}, message: 'ok' };
  }
  if (pathname === '/api/manage/orders/batch') {
    return { success: true, data: {}, message: 'ok' };
  }

  if (pathname === '/api/manage/goods-overview' && m === 'GET') {
    return {
      success: true,
      data: {
        items: [],
        filters: { categories: [], brands: [] },
      },
    };
  }
  if (pathname === '/api/manage/goods-overview/summary' && m === 'GET') {
    return {
      success: true,
      data: {
        totalProducts: 0,
        totalDemand: 0,
        shortageCount: 0,
      },
    };
  }

  if (pathname === '/api/manage/purchase-orders' && m === 'GET') {
    return { success: true, data: { items: [], total: 0 } };
  }
  if (pathname === '/api/manage/purchase-orders/stats' && m === 'GET') {
    return {
      success: true,
      data: {
        total: 0,
        draft_count: 0,
        ordered_count: 0,
        shipping_count: 0,
        arrived_count: 0,
        completed_count: 0,
      },
    };
  }
  if (pathname === '/api/manage/purchase-orders/suggestions' && m === 'GET') {
    return { success: true, data: [] };
  }
  if (pathname.startsWith('/api/manage/purchase-orders')) {
    return { success: true, data: {}, message: 'ok' };
  }

  if (pathname === '/api/manage/customers' && m === 'GET') {
    const meta = pageMeta(searchParams);
    return {
      success: true,
      data: {
        list: [],
        total: 0,
        totalPages: 1,
        page: meta.page,
      },
    };
  }
  if (pathname.startsWith('/api/manage/customers/')) {
    return { success: true, data: [] };
  }

  if (pathname === '/api/manage/audit-logs' && m === 'GET') {
    return {
      success: true,
      data: [],
      pagination: pageMeta(searchParams, 50),
    };
  }
  if (pathname === '/api/manage/audit-logs/actions' && m === 'GET') {
    return { success: true, data: [] };
  }

  if (pathname === '/api/manage/folders' && m === 'GET') {
    return { success: true, data: [] };
  }
  if (pathname.startsWith('/api/manage/folders/') && m === 'GET') {
    return {
      success: true,
      data: {
        id: pathname.split('/').pop(),
        name: 'mock-folder',
        subfolders: [],
        files: [],
        breadcrumbs: [],
      },
    };
  }

  if (pathname === '/api/manage/spaces' && m === 'GET') {
    return { success: true, data: [], meta: pageMeta(searchParams) };
  }
  if (pathname === '/api/manage/products' && m === 'GET') {
    return { success: true, data: [], meta: pageMeta(searchParams) };
  }
  if (pathname === '/api/manage/salespersons' && m === 'GET') {
    return { success: true, data: [], meta: pageMeta(searchParams) };
  }

  if (pathname.startsWith('/api/manage/')) {
    return { success: true, data: {}, message: 'ok' };
  }
  return null;
}

async function run() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(path.dirname(USER_DATA_DIR), { recursive: true });

  const preview = SKIP_PREVIEW
    ? null
    : spawn(
        process.execPath,
        [path.resolve('node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4173'],
        { stdio: 'ignore' }
      );

  let reachable = false;
  const start = Date.now();
  while (Date.now() - start < 30000) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) {
        reachable = true;
        break;
      }
    } catch {
      // keep waiting
    }
    await sleep(300);
  }
  if (!reachable) {
    throw new Error(`Base URL not reachable: ${BASE_URL}`);
  }

  const chromePath = pickChromePath();
  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  try {
    await waitForJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
    const targets = await waitForJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const pageTarget = (targets || []).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    const wsUrl = pageTarget?.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error('Cannot find webSocketDebuggerUrl');

    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let seq = 1;

    const send = (method, params = {}) => {
      const id = seq++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, method });
      });
    };

    const waitOpen = new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
    await waitOpen;

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const job = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) job.reject(new Error(`${job.method}: ${msg.error.message}`));
        else job.resolve(msg.result);
        return;
      }

      if (msg.method === 'Fetch.requestPaused') {
        const { requestId, request } = msg.params;
        const url = request.url;

        try {
          if (url.includes('/api/turnstile/verify')) {
            await send('Fetch.fulfillRequest', {
              requestId,
              ...makeResponse({ success: true, data: { enabled: false, siteKey: null } }),
            });
            return;
          }

          if (url.includes('/api/v1/auth/me')) {
            await send('Fetch.fulfillRequest', {
              requestId,
              ...makeResponse({
                success: true,
                data: {
                  id: 'admin',
                  name: 'Administrator',
                  type: 'admin',
                  role: 'admin',
                  permissions: ['admin:full'],
                },
              }),
            });
            return;
          }

          if (url.includes('/api/v1/auth/login')) {
            await send('Fetch.fulfillRequest', {
              requestId,
              ...makeResponse({
                success: true,
                data: { user: { id: 'admin', role: 'admin' }, expiresIn: 604800 },
              }),
            });
            return;
          }

          if (url.includes('/api/manage/') || url.includes('/api/v1/files') || url.includes('/api/v1/permissions')) {
            if (AUDIT_SCENARIO === 'allow') {
              const payload = allowPayload(url, request.method);
              if (payload) {
                await send('Fetch.fulfillRequest', {
                  requestId,
                  ...makeResponse(payload, 200),
                });
                return;
              }
            }
            const reason = url.includes('/notifications')
              ? '权限不足: notifications:read'
              : url.includes('/stats')
                ? '权限不足: stats:read'
                : '权限不足: read';
            await send('Fetch.fulfillRequest', {
              requestId,
              ...makeResponse({ success: false, error: reason }, 403),
            });
            return;
          }

          await send('Fetch.continueRequest', { requestId });
        } catch {
          try {
            await send('Fetch.continueRequest', { requestId });
          } catch {
            // ignore
          }
        }
      }
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });

    const results = [];
    for (const route of adminRoutes) {
      const url = `${BASE_URL}${route}`;
      await send('Page.navigate', { url });
      await sleep(1800);

      const evalResult = await send('Runtime.evaluate', {
        expression: `(() => {
          const alerts = Array.from(document.querySelectorAll('section[role="alert"]')).map((el) => (el.innerText || '').trim());
          const bodyText = (document.body?.innerText || '').trim();
          const denied = alerts.some((txt) => /权限不足|访问受限|权限/.test(txt))
            || /权限不足|访问受限/.test(bodyText);
          return {
            path: location.pathname,
            title: document.title,
            alertCount: alerts.length,
            denied,
            alerts
          };
        })()`,
        returnByValue: true,
      });

      const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const fileSafe = route.replaceAll('/', '_').replace(/^_+/, '');
      const shotPath = path.join(OUTPUT_DIR, `${fileSafe || 'root'}.png`);
      await fs.writeFile(shotPath, Buffer.from(screenshot.data, 'base64'));

      results.push({ route, screenshot: shotPath, ...(evalResult.result?.value || {}) });
      // eslint-disable-next-line no-console
      console.log(`[audit] ${route} -> denied=${results[results.length - 1].denied}`);
    }

    const reportPath = path.join(OUTPUT_DIR, 'report.json');
    await fs.writeFile(
      reportPath,
      JSON.stringify({ baseUrl: BASE_URL, scenario: AUDIT_SCENARIO, results }, null, 2),
      'utf8'
    );

    // eslint-disable-next-line no-console
    console.log(`[audit] report: ${reportPath}`);
    await send('Browser.close').catch(() => {});
  } finally {
    try {
      chrome.kill('SIGTERM');
    } catch {
      // ignore
    }
    if (preview) {
      try {
        preview.kill('SIGTERM');
      } catch {
        // ignore
      }
    }
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[audit] failed:', err);
  process.exit(1);
});

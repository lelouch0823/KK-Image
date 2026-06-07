import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

export const adminRoutes = [
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
  '/admin/forbidden',
];

export function pickChromePath(options = {}) {
  const existsSyncImpl = options.existsSyncImpl || existsSync;
  const candidates = (
    options.candidates || [
      process.env.CHROME_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ]
  ).filter(Boolean);

  for (const target of candidates) {
    if (existsSyncImpl(target)) return target;
  }
  throw new Error('No Chrome/Edge executable found. Set CHROME_PATH.');
}

export function sleep(ms, setTimeoutImpl = setTimeout) {
  return new Promise((resolve) => setTimeoutImpl(resolve, ms));
}

export async function waitForJson(url, timeoutMs = 15000, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const sleepImpl = options.sleepImpl || ((ms) => sleep(ms));
  const nowImpl = options.nowImpl || Date.now;
  const startedAt = nowImpl();

  while (nowImpl() - startedAt < timeoutMs) {
    try {
      const res = await fetchImpl(url);
      if (res.ok) return res.json();
    } catch {
      // retry
    }
    await sleepImpl(250);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

export function makeResponse(body, code = 200, headers = { 'Content-Type': 'application/json' }) {
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

export function pageMeta(searchParams, fallbackLimit = 20) {
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || fallbackLimit);
  return { page, limit, total: 0, totalPages: 1 };
}

export function allowPayload(url, method = 'GET') {
  const targetUrl = new URL(url);
  const { pathname, searchParams } = targetUrl;
  const normalizedMethod = String(method || 'GET').toUpperCase();

  if (pathname === '/api/v1/files' && normalizedMethod === 'GET') {
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

  if (pathname === '/api/manage/notifications' && normalizedMethod === 'GET') {
    return { success: true, data: { list: [], unreadCount: 0 } };
  }
  if (pathname.startsWith('/api/manage/notifications/')) {
    return { success: true, data: {} };
  }

  if (pathname === '/api/manage/dashboard/overview' && normalizedMethod === 'GET') {
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

  if (pathname === '/api/manage/stats' && normalizedMethod === 'GET') {
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

  if (pathname === '/api/manage/orders' && normalizedMethod === 'GET') {
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

  if (pathname === '/api/manage/goods-overview' && normalizedMethod === 'GET') {
    return {
      success: true,
      data: {
        items: [],
        filters: { categories: [], brands: [] },
      },
    };
  }
  if (pathname === '/api/manage/goods-overview/summary' && normalizedMethod === 'GET') {
    return {
      success: true,
      data: {
        totalProducts: 0,
        totalDemand: 0,
        shortageCount: 0,
      },
    };
  }

  if (pathname === '/api/manage/purchase-orders' && normalizedMethod === 'GET') {
    return { success: true, data: { items: [], total: 0 } };
  }
  if (pathname === '/api/manage/purchase-orders/stats' && normalizedMethod === 'GET') {
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
  if (pathname === '/api/manage/purchase-orders/suggestions' && normalizedMethod === 'GET') {
    return { success: true, data: [] };
  }
  if (pathname.startsWith('/api/manage/purchase-orders')) {
    return { success: true, data: {}, message: 'ok' };
  }

  if (pathname === '/api/manage/customers' && normalizedMethod === 'GET') {
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

  if (pathname === '/api/manage/audit-logs' && normalizedMethod === 'GET') {
    return {
      success: true,
      data: [],
      pagination: pageMeta(searchParams, 50),
    };
  }
  if (pathname === '/api/manage/audit-logs/actions' && normalizedMethod === 'GET') {
    return { success: true, data: [] };
  }

  if (pathname === '/api/manage/folders' && normalizedMethod === 'GET') {
    return { success: true, data: [] };
  }
  if (pathname.startsWith('/api/manage/folders/') && normalizedMethod === 'GET') {
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

  if (pathname === '/api/manage/spaces' && normalizedMethod === 'GET') {
    return { success: true, data: [], meta: pageMeta(searchParams) };
  }
  if (pathname === '/api/manage/products' && normalizedMethod === 'GET') {
    return { success: true, data: [], meta: pageMeta(searchParams) };
  }
  if (pathname === '/api/manage/salespersons' && normalizedMethod === 'GET') {
    return { success: true, data: [], meta: pageMeta(searchParams) };
  }

  if (pathname.startsWith('/api/manage/')) {
    return { success: true, data: {}, message: 'ok' };
  }
  return null;
}

export function evaluateAdminAuditResults(results, scenario) {
  const protectedResults = results.filter((item) => item.route !== '/admin/forbidden');
  const violations = [];

  if (scenario === 'deny') {
    for (const item of protectedResults) {
      if (!item.denied) {
        violations.push(`deny scenario should block ${item.route}`);
      }
    }
  } else if (scenario === 'allow') {
    for (const item of protectedResults) {
      if (item.denied) {
        violations.push(`allow scenario should permit ${item.route}`);
      }
    }
  } else {
    throw new Error(`Unknown AUDIT_SCENARIO: ${scenario}`);
  }

  const forbiddenRoute = results.find((item) => item.route === '/admin/forbidden');
  if (!forbiddenRoute?.hasPermissionDeniedState) {
    violations.push('forbidden route must render permission-denied-state');
  }

  return violations;
}

export function createAdminHeadlessAuditRunner(options = {}) {
  const env = options.env || process.env;
  const fsModule = options.fsModule || fs;
  const pathModule = options.pathModule || path;
  const spawnImpl = options.spawnImpl || spawn;
  const fetchImpl = options.fetchImpl || fetch;
  const webSocketCtor = options.webSocketCtor || WebSocket;
  const consoleImpl = options.consoleImpl || console;
  const setTimeoutImpl = options.setTimeoutImpl || setTimeout;
  const baseUrl = options.baseUrl || env.AUDIT_BASE_URL || 'http://127.0.0.1:4173';
  const cdpPort = Number(options.cdpPort || env.CDP_PORT || 9222);
  const auditScenario = options.auditScenario || env.AUDIT_SCENARIO || 'deny';
  const outputDir =
    options.outputDir || pathModule.resolve('artifacts', 'admin-audit', auditScenario);
  const userDataDir = options.userDataDir || pathModule.resolve('.tmp', 'chrome-headless-audit');
  const skipPreview = options.skipPreview ?? env.SKIP_PREVIEW === '1';
  const routeList = options.routes || adminRoutes;

  async function run() {
    await fsModule.mkdir(outputDir, { recursive: true });
    await fsModule.mkdir(pathModule.dirname(userDataDir), { recursive: true });

    const preview = skipPreview
      ? null
      : spawnImpl(
          process.execPath,
          [
            pathModule.resolve('node_modules', 'vite', 'bin', 'vite.js'),
            'preview',
            '--host',
            '127.0.0.1',
            '--port',
            '4173',
          ],
          { stdio: 'ignore' }
        );

    let reachable = false;
    const startedAt = Date.now();
    while (Date.now() - startedAt < 30000) {
      try {
        const res = await fetchImpl(baseUrl);
        if (res.ok) {
          reachable = true;
          break;
        }
      } catch {
        // keep waiting
      }
      await sleep(300, setTimeoutImpl);
    }
    if (!reachable) {
      throw new Error(`Base URL not reachable: ${baseUrl}`);
    }

    const chromePath = pickChromePath(options);
    const chrome = spawnImpl(
      chromePath,
      [
        '--headless=new',
        `--remote-debugging-port=${cdpPort}`,
        `--user-data-dir=${userDataDir}`,
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
      await waitForJson(`http://127.0.0.1:${cdpPort}/json/version`, 15000, {
        fetchImpl,
        sleepImpl: (ms) => sleep(ms, setTimeoutImpl),
      });
      const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json/list`, 15000, {
        fetchImpl,
        sleepImpl: (ms) => sleep(ms, setTimeoutImpl),
      });
      const pageTarget = (targets || []).find(
        (target) => target.type === 'page' && target.webSocketDebuggerUrl
      );
      const wsUrl = pageTarget?.webSocketDebuggerUrl;
      if (!wsUrl) throw new Error('Cannot find webSocketDebuggerUrl');

      const ws = new webSocketCtor(wsUrl);
      const pending = new Map();
      let seq = 1;

      const send = (method, params = {}) => {
        const id = seq;
        seq += 1;
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
          const requestUrl = request.url;

          try {
            if (requestUrl.includes('/api/turnstile/verify')) {
              await send('Fetch.fulfillRequest', {
                requestId,
                ...makeResponse({ success: true, data: { enabled: false, siteKey: null } }),
              });
              return;
            }

            if (requestUrl.includes('/api/v1/auth/me')) {
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

            if (requestUrl.includes('/api/v1/auth/login')) {
              await send('Fetch.fulfillRequest', {
                requestId,
                ...makeResponse({
                  success: true,
                  data: { user: { id: 'admin', role: 'admin' }, expiresIn: 604800 },
                }),
              });
              return;
            }

            if (
              requestUrl.includes('/api/manage/') ||
              requestUrl.includes('/api/v1/files') ||
              requestUrl.includes('/api/v1/permissions')
            ) {
              if (auditScenario === 'allow') {
                const payload = allowPayload(requestUrl, request.method);
                if (payload) {
                  await send('Fetch.fulfillRequest', {
                    requestId,
                    ...makeResponse(payload, 200),
                  });
                  return;
                }
              }
              const reason = requestUrl.includes('/notifications')
                ? '权限不足: notifications:read'
                : requestUrl.includes('/stats')
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
      for (const route of routeList) {
        const url = `${baseUrl}${route}`;
        await send('Page.navigate', { url });
        await sleep(1800, setTimeoutImpl);

        const evalResult = await send('Runtime.evaluate', {
          expression: `(() => {
          const alerts = Array.from(document.querySelectorAll('section[role="alert"]')).map((el) => (el.innerText || '').trim());
          const hasPermissionDeniedState = Boolean(
            document.querySelector('[data-testid="permission-denied-state"], #permission-denied-state')
          );
          const bodyText = (document.body?.innerText || '').trim();
          const denied = hasPermissionDeniedState
            || alerts.some((txt) => /权限不足|访问受限|无权访问|权限/.test(txt))
            || /权限不足|访问受限|无权访问/.test(bodyText);
          return {
            path: location.pathname,
            title: document.title,
            alertCount: alerts.length,
            hasPermissionDeniedState,
            denied,
            alerts
          };
        })()`,
          returnByValue: true,
        });

        const screenshot = await send('Page.captureScreenshot', {
          format: 'png',
          fromSurface: true,
        });
        const fileSafe = route.replaceAll('/', '_').replace(/^_+/, '');
        const shotPath = pathModule.join(outputDir, `${fileSafe || 'root'}.png`);
        await fsModule.writeFile(shotPath, Buffer.from(screenshot.data, 'base64'));

        results.push({ route, screenshot: shotPath, ...(evalResult.result?.value || {}) });
        consoleImpl.log(`[audit] ${route} -> denied=${results[results.length - 1].denied}`);
      }

      const violations = evaluateAdminAuditResults(results, auditScenario);
      const reportPath = pathModule.join(outputDir, 'report.json');
      await fsModule.writeFile(
        reportPath,
        JSON.stringify(
          {
            baseUrl,
            scenario: auditScenario,
            summary: {
              totalRoutes: results.length,
              violations,
            },
            results,
          },
          null,
          2
        ),
        'utf8'
      );

      consoleImpl.log(`[audit] report: ${reportPath}`);

      if (violations.length > 0) {
        throw new Error(`Audit violations: ${violations.join('; ')}`);
      }

      await send('Browser.close').catch(() => {});
      return { reportPath, results, violations };
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

  return {
    run,
    config: {
      baseUrl,
      cdpPort,
      auditScenario,
      outputDir,
      userDataDir,
      skipPreview,
      routes: routeList,
    },
  };
}

export async function runAdminHeadlessAuditCli(options = {}) {
  return createAdminHeadlessAuditRunner(options).run();
}

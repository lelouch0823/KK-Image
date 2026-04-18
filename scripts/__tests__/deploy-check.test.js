import { afterEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts/deploy-check.js');

async function importScript() {
  return import(`${pathToFileURL(SCRIPT_PATH).href}?t=${Date.now()}-${Math.random()}`);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deploy-check exports', () => {
  it('exposes a reusable cli runner and request helpers', async () => {
    const mod = await importScript();

    expect(typeof mod.runDeployCheckCli).toBe('function');
    expect(typeof mod.request).toBe('function');
    expect(typeof mod.checkAPIHealth).toBe('function');
  });
});

describe('deploy-check helpers and runner', () => {
  it('creates env-backed config and logger counters', async () => {
    const mod = await importScript();
    const lines = [];
    const logger = mod.createLogger({ writeLine: (line) => lines.push(line) });

    expect(
      mod.createConfig({
        DEPLOY_URL: 'https://deploy.example',
        API_BASE: 'https://deploy.example/api',
        TEST_USERNAME: 'root',
        TEST_PASSWORD: 'pw',
      })
    ).toEqual({
      BASE_URL: 'https://deploy.example',
      API_BASE: 'https://deploy.example/api',
      TIMEOUT: 10000,
      TEST_USERNAME: 'root',
      TEST_PASSWORD: 'pw',
    });

    logger.success('ok');
    logger.warning('warn');
    logger.error('err');
    expect(logger.counters).toEqual({ passed: 1, failed: 1, warnings: 1 });
    expect(lines.join('\n')).toContain('✅ ok');
    expect(lines.join('\n')).toContain('⚠️  warn');
    expect(lines.join('\n')).toContain('❌ err');
  });

  it('wraps fetch with timeout handling', async () => {
    const mod = await importScript();
    const clearTimeoutImpl = vi.fn();

    const okResponse = { ok: true, status: 200 };
    await expect(
      mod.request('https://example.test', {}, {
        config: { TIMEOUT: 50 },
        fetchImpl: vi.fn(async () => okResponse),
        setTimeoutImpl: vi.fn(() => 7),
        clearTimeoutImpl,
      })
    ).resolves.toBe(okResponse);
    expect(clearTimeoutImpl).toHaveBeenCalledWith(7);

    await expect(
      mod.request('https://example.test', {}, {
        config: { TIMEOUT: 99 },
        fetchImpl: vi.fn(async () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          throw error;
        }),
        setTimeoutImpl: vi.fn(() => 9),
        clearTimeoutImpl,
      })
    ).rejects.toThrow('Request timeout after 99ms');
  });

  it('checks health, auth, endpoints, and environment config branches', async () => {
    const mod = await importScript();
    const lines = [];
    const logger = mod.createLogger({ writeLine: (line) => lines.push(line) });
    const config = mod.createConfig({
      DEPLOY_URL: 'https://deploy.example',
      API_BASE: 'https://deploy.example/api/v1',
      TEST_USERNAME: 'admin',
      TEST_PASSWORD: '123',
    });

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'ok' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, data: { token: 'jwt' } }) })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    await mod.checkBasicPages({ config, logger, fetchImpl, setTimeoutImpl: vi.fn(() => 1), clearTimeoutImpl: vi.fn() });
    expect(await mod.checkAPIHealth({ config, logger, fetchImpl, setTimeoutImpl: vi.fn(() => 1), clearTimeoutImpl: vi.fn() })).toBe(true);
    expect(await mod.checkAuthentication({ config, logger, fetchImpl, setTimeoutImpl: vi.fn(() => 1), clearTimeoutImpl: vi.fn() })).toBe('jwt');
    await mod.checkAPIEndpoints('jwt', { config, logger, fetchImpl, setTimeoutImpl: vi.fn(() => 1), clearTimeoutImpl: vi.fn() });
    expect(
      await mod.checkEnvironmentConfig({
        logger,
        readFileSyncImpl: vi.fn(() => 'BASIC_USER\nTG_Bot_Token\nimg_url'),
      })
    ).toBe(false);

    expect(lines.join('\n')).toContain('主页 (/) - 状态: 200');
    expect(lines.join('\n')).toContain('管理页面 (/admin) - 状态: 503');
    expect(lines.join('\n')).toContain('API 健康检查 - 状态: ok');
    expect(lines.join('\n')).toContain('JWT 认证系统正常');
    expect(lines.join('\n')).toContain('文件列表 API - 状态: 200');
    expect(lines.join('\n')).toContain('Webhook 列表 API - 状态: 403');
    expect(lines.join('\n')).toContain('环境变量 BASIC_PASS 未找到');
  });

  it('handles auth failures, skipped endpoints, and report severity bands', async () => {
    const mod = await importScript();
    const lines = [];
    const logger = mod.createLogger({ writeLine: (line) => lines.push(line) });
    const config = mod.createConfig({
      DEPLOY_URL: 'https://deploy.example',
      API_BASE: 'https://deploy.example/api/v1',
    });

    expect(
      await mod.checkAuthentication({
        config,
        logger,
        fetchImpl: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: false, data: {} }) })),
        setTimeoutImpl: vi.fn(() => 1),
        clearTimeoutImpl: vi.fn(),
      })
    ).toBeNull();

    await mod.checkAPIEndpoints(null, { config, logger });

    mod.generateReport({ passed: 1, failed: 0, warnings: 0 }, { logger });
    mod.generateReport({ passed: 1, failed: 2, warnings: 1 }, { logger });
    mod.generateReport({ passed: 1, failed: 3, warnings: 1 }, { logger });

    expect(lines.join('\n')).toContain('JWT 认证响应格式错误');
    expect(lines.join('\n')).toContain('跳过 API 端点检查（无有效 token）');
    expect(lines.join('\n')).toContain('部署验证通过');
    expect(lines.join('\n')).toContain('部署基本正常');
    expect(lines.join('\n')).toContain('部署存在严重问题');
  });

  it('returns status codes from the cli runner and surfaces fatal errors', async () => {
    const mod = await importScript();
    const goodLines = [];

    const goodExit = await mod.runDeployCheckCli({
      config: mod.createConfig({
        DEPLOY_URL: 'https://deploy.example',
        API_BASE: 'https://deploy.example/api/v1',
      }),
      writeLine: (line) => goodLines.push(line),
      fetchImpl: vi.fn(async (url) => {
        if (url.endsWith('/health')) {
          return { ok: true, status: 200, json: async () => ({ status: 'ok' }) };
        }
        if (url.endsWith('/auth/token')) {
          return { ok: true, status: 200, json: async () => ({ success: true, data: { token: 'jwt' } }) };
        }
        return { ok: true, status: 200 };
      }),
      setTimeoutImpl: vi.fn(() => 1),
      clearTimeoutImpl: vi.fn(),
      readFileSyncImpl: vi.fn(() => 'BASIC_USER\nBASIC_PASS\nTG_Bot_Token\nTG_Chat_ID\nimg_url\nWEBHOOKS_KV\nWEBHOOK_LOGS_KV'),
    });

    expect(goodExit).toBe(0);
    expect(goodLines.join('\n')).toContain('开始 kk-life 部署验证');

    const badExit = await mod.runDeployCheckCli({
      config: mod.createConfig({
        DEPLOY_URL: 'https://deploy.example',
        API_BASE: 'https://deploy.example/api/v1',
      }),
      writeLine: vi.fn(),
      fetchImpl: vi.fn(async () => {
        throw new Error('network down');
      }),
      setTimeoutImpl: vi.fn(() => 1),
      clearTimeoutImpl: vi.fn(),
      readFileSyncImpl: vi.fn(() => {
        throw new Error('wrangler missing');
      }),
    });

    expect(badExit).toBe(1);
  });
});

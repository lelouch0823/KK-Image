import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  passwordHashNeedsMigration: vi.fn(),
  checkAndRespondLockout: vi.fn(),
  handleLoginFailure: vi.fn(),
  clearFailures: vi.fn(),
  generateSalesToken: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
  getUserAgent: vi.fn(() => 'Vitest'),
  recordLogin: vi.fn(),
  findByWechatOpenid: vi.fn(),
  findByToken: vi.fn(),
  scheduleAuditEvent: vi.fn(),
}));

vi.mock('../../../../../_shared/utils.js', () => ({
  MSG: {
    SALESPERSON: {
      DISABLED: 'SALESPERSON_DISABLED',
      NOT_FOUND: 'SALESPERSON_NOT_FOUND',
      INVALID_PASSWORD: 'INVALID_PASSWORD',
    },
  },
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
  passwordHashNeedsMigration: mocks.passwordHashNeedsMigration,
}));

vi.mock('../../../middleware/rateLimit.js', () => ({
  loginRateLimitMiddleware: async (_c, next) => next(),
}));

vi.mock('../../../../../repositories/SalespersonRepository.js', () => ({
  SalespersonRepository: vi.fn(() => ({
    recordLogin: mocks.recordLogin,
    findByWechatOpenid: mocks.findByWechatOpenid,
    findByToken: mocks.findByToken,
  })),
}));

vi.mock('../../../_shared/route-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/route-helpers.js');
  return {
    ...actual,
    requireEntity: async (promise, onNotFound) => {
      const entity = await promise;
      if (!entity) throw onNotFound();
      return entity;
    },
  };
});

vi.mock('../../../_shared/auth-helpers.js', () => ({
  checkAndRespondLockout: mocks.checkAndRespondLockout,
  handleLoginFailure: mocks.handleLoginFailure,
  clearFailures: mocks.clearFailures,
  generateSalesToken: mocks.generateSalesToken,
  SALES_COOKIE_MAX_AGE: 604800,
  getClientIp: mocks.getClientIp,
  getUserAgent: mocks.getUserAgent,
}));

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

import authApp from '../auth.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.route('/api/sales', authApp);
  return app;
}

function createDb(firstRow) {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => firstRow),
        run: vi.fn(async () => ({ success: true })),
      })),
    })),
  };
}

describe('sales auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAndRespondLockout.mockResolvedValue(null);
    mocks.handleLoginFailure.mockImplementation(async (c, identifier, message = 'LOGIN_FAILED') =>
      c.json({ success: false, error: message, identifier }, 401)
    );
    mocks.clearFailures.mockResolvedValue(undefined);
    mocks.generateSalesToken.mockResolvedValue('sales-jwt');
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.hashPassword.mockResolvedValue('new-hash');
    mocks.passwordHashNeedsMigration.mockReturnValue(false);
    mocks.recordLogin.mockResolvedValue(undefined);
    mocks.findByWechatOpenid.mockResolvedValue(null);
    mocks.findByToken.mockResolvedValue({
      id: 'sales-1',
      name: 'Alice',
      store: 'S1',
      is_active: 1,
      password_hash: 'legacy-hash',
    });
  });

  it('logs in with username/password, migrates legacy hashes, and records audit data', async () => {
    mocks.passwordHashNeedsMigration.mockReturnValue(true);
    const db = createDb({
      id: 'sales-1',
      name: 'Alice',
      store: 'S1',
      phone: '13800000000',
      access_token: 'access-1',
      password_hash: 'legacy-hash',
      is_active: 1,
    });
    const app = createApp();

    const response = await app.request(
      'http://localhost/api/sales/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Alice', password: '123456' }),
      },
      { DB: db, JWT_SECRET: 'secret' }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(
      expect.objectContaining({
        id: 'sales-1',
        token: 'sales-jwt',
        accessToken: 'access-1',
      })
    );
    expect(mocks.hashPassword).toHaveBeenCalledWith('123456', 'secret');
    expect(mocks.clearFailures).toHaveBeenCalledWith(expect.anything(), 'Alice');
    expect(mocks.recordLogin).toHaveBeenCalledWith('sales-1', '127.0.0.1', 'Vitest');
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'sales.auth.login',
        targetId: 'sales-1',
      })
    );
  });

  it('records failed password logins for unknown users', async () => {
    const app = createApp();

    const response = await app.request(
      'http://localhost/api/sales/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Missing', password: '123456' }),
      },
      { DB: createDb(null), JWT_SECRET: 'secret' }
    );

    expect(response.status).toBe(401);
    expect(mocks.handleLoginFailure).toHaveBeenCalledWith(expect.anything(), 'Missing');
  });

  it('returns needBind for unbound wechat users and 503 when wechat is disabled', async () => {
    const app = createApp();

    const disabled = await app.request(
      'http://localhost/api/sales/wechat-login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'wx-code' }),
      },
      { DB: {}, JWT_SECRET: 'secret' }
    );
    expect(disabled.status).toBe(503);

    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ openid: 'openid-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const needBind = await app.request(
      'http://localhost/api/sales/wechat-login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'wx-code' }),
      },
      { DB: {}, JWT_SECRET: 'secret', WECHAT_APPID: 'app', WECHAT_SECRET: 'secret2' }
    );

    expect(needBind.status).toBe(200);
    expect(await needBind.json()).toEqual({
      success: true,
      data: { needBind: true, openid: 'openid-1' },
    });
  });

  it('logs in bound wechat users and audits the action', async () => {
    mocks.findByWechatOpenid.mockResolvedValue({
      id: 'sales-1',
      name: 'Alice',
      store: 'S1',
      is_active: 1,
    });
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ openid: 'openid-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const app = createApp();

    const response = await app.request(
      'http://localhost/api/sales/wechat-login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'wx-code' }),
      },
      { DB: {}, JWT_SECRET: 'secret', WECHAT_APPID: 'app', WECHAT_SECRET: 'secret2' }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(
      expect.objectContaining({
        token: 'sales-jwt',
        user: { id: 'sales-1', name: 'Alice', store: 'S1' },
      })
    );
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'sales.auth.wechat_login' })
    );
  });

  it('handles token auth failures and successful token auth', async () => {
    mocks.verifyPassword
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const app = createApp();

    const bad = await app.request(
      'http://localhost/api/sales/access-token/auth',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'bad' }),
      },
      { DB: createDb(null), JWT_SECRET: 'secret' }
    );
    expect(bad.status).toBe(401);
    expect(mocks.handleLoginFailure).toHaveBeenCalledWith(
      expect.anything(),
      'access-token',
      'INVALID_PASSWORD'
    );

    const ok = await app.request(
      'http://localhost/api/sales/access-token/auth',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'good' }),
      },
      { DB: createDb(null), JWT_SECRET: 'secret' }
    );

    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.data).toEqual(
      expect.objectContaining({
        id: 'sales-1',
        token: 'sales-jwt',
      })
    );
    expect(mocks.clearFailures).toHaveBeenCalledWith(expect.anything(), 'access-token');
  });
});

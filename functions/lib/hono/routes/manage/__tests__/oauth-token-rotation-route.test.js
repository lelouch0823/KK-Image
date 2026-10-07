import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  getClientByClientId: vi.fn(),
  detectAndContainRefreshTokenReuse: vi.fn(async () => false),
  getTokenByRefreshToken: vi.fn(),
  rotateRefreshToken: vi.fn(),
  generateAccessTokenValue: vi.fn(() => 'oat_route-access'),
  generateRefreshTokenValue: vi.fn(() => 'ort_route-refresh'),
}));

vi.mock('../../../../../repositories/OAuthRepository.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    OAuthRepository: vi.fn(() => ({
      getClientByClientId: mocks.getClientByClientId,
      detectAndContainRefreshTokenReuse: mocks.detectAndContainRefreshTokenReuse,
      getTokenByRefreshToken: mocks.getTokenByRefreshToken,
      rotateRefreshToken: mocks.rotateRefreshToken,
      generateAccessTokenValue: mocks.generateAccessTokenValue,
      generateRefreshTokenValue: mocks.generateRefreshTokenValue,
    })),
  };
});

import oauthApp from '../oauth.js';
import { hashSecret } from '../../../../../repositories/OAuthRepository.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.route('/api/oauth', oauthApp);
  return app;
}

const postToken = (app, body) =>
  app.request(
    'http://localhost/api/oauth/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    { DB: {} },
    { waitUntil: vi.fn() }
  );

describe('POST /api/oauth/token concurrent refresh rotation', () => {
  const clientSecret = 'client-secret-value';
  let storedSecretHash;

  beforeEach(async () => {
    vi.clearAllMocks();
    storedSecretHash = await hashSecret(clientSecret);
    mocks.getClientByClientId.mockResolvedValue({
      id: 'oacli-1',
      clientId: 'oc_app',
      clientSecret: storedSecretHash,
      enabled: true,
      grantTypes: ['authorization_code', 'refresh_token'],
      scopes: ['read'],
      redirectUris: ['https://app.example.com/callback'],
    });
    mocks.detectAndContainRefreshTokenReuse.mockResolvedValue(false);
    mocks.getTokenByRefreshToken.mockResolvedValue({
      id: 'tok-1',
      accessToken: 'oat_old',
      refreshToken: 'ort_old',
      clientId: 'oc_app',
      userId: 'user-1',
      scopes: ['read'],
      expiresAt: Date.now() + 3600000,
      refreshExpiresAt: Date.now() + 86400000,
      revoked: false,
      createdAt: Date.now(),
    });
    mocks.rotateRefreshToken.mockResolvedValue({
      token: {
        accessToken: 'oat_route-access',
        refreshToken: 'ort_route-refresh',
        expiresAt: Date.now() + 3600000,
        scopes: ['read'],
      },
      reuseDetected: false,
    });
  });

  it('issues a rotated token pair on the happy path', async () => {
    const app = createApp();
    const res = await postToken(app, {
      grant_type: 'refresh_token',
      client_id: 'oc_app',
      client_secret: clientSecret,
      refresh_token: 'ort_old',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        access_token: 'oat_route-access',
        refresh_token: 'ort_route-refresh',
      })
    );
    expect(mocks.detectAndContainRefreshTokenReuse).toHaveBeenCalledTimes(1);
  });

  it('maps a concurrent rotation assertion failure to the reuse-detection rejection (401)', async () => {
    // 败者：changes() 断言失败（令牌已被并发赢家吊销）→ 走重用检测分支
    mocks.rotateRefreshToken.mockRejectedValueOnce(
      new Error('Malformed JSON at position 0: JSON text malformed')
    );
    const app = createApp();

    const res = await postToken(app, {
      grant_type: 'refresh_token',
      client_id: 'oc_app',
      client_secret: clientSecret,
      refresh_token: 'ort_old',
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        error: 'invalid_grant',
        error_description: '刷新令牌已被使用或泄露，已吊销该应用全部令牌',
      })
    );
    // 败者触发 token family 吊销（第一步重用检测 + 失败分支各一次）
    expect(mocks.detectAndContainRefreshTokenReuse).toHaveBeenCalledTimes(2);
  });

  it('rethrows non-assertion rotation failures without revoking the token family', async () => {
    mocks.rotateRefreshToken.mockRejectedValueOnce(new Error('D1 storage unavailable'));
    const app = createApp();

    const res = await postToken(app, {
      grant_type: 'refresh_token',
      client_id: 'oc_app',
      client_secret: clientSecret,
      refresh_token: 'ort_old',
    });

    expect(res.status).toBe(500);
    // 非并发冲突错误不触发令牌族吊销（只保留第一步重用检测的调用）
    expect(mocks.detectAndContainRefreshTokenReuse).toHaveBeenCalledTimes(1);
  });
});

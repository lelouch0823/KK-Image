import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetTurnstileRateLimitForTest,
  onRequestGet,
  onRequestPost,
} from '../verify.js';
import { generateJWT } from '../../utils/auth.js';

function request(body, headers = {}) {
  return new Request('https://example.com/api/turnstile/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.10',
      ...headers,
    },
    body,
  });
}

async function json(response) {
  return response.json();
}

describe('turnstile verify function', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetTurnstileRateLimitForTest();
  });

  it('returns 400 for malformed JSON', async () => {
    const response = await onRequestPost({
      request: request('{bad-json'),
      env: { ENVIRONMENT: 'production', TURNSTILE_SECRET_KEY: 'secret' },
    });

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ success: false });
  });

  it('fails closed in production when the secret is missing', async () => {
    const response = await onRequestPost({
      request: request(JSON.stringify({ token: 'token-1' })),
      env: { ENVIRONMENT: 'production', TURNSTILE_SITE_KEY: 'site-key' },
    });

    expect(response.status).toBe(503);
    expect(await json(response)).toMatchObject({ success: false });
  });

  it('sends Turnstile verification with an abort signal and fails closed on timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        expect(options.signal).toBeTruthy();
        const error = new Error('timeout');
        error.name = 'AbortError';
        throw error;
      })
    );

    const response = await onRequestPost({
      request: request(JSON.stringify({ token: 'token-1' })),
      env: { ENVIRONMENT: 'production', TURNSTILE_SECRET_KEY: 'secret', TURNSTILE_TIMEOUT_MS: '1' },
    });

    expect(response.status).toBe(503);
    expect(await json(response)).toMatchObject({ success: false });
  });

  it('rate limits repeated standalone verification attempts by IP', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: true })))
    );

    let lastResponse;
    for (let index = 0; index < 3; index += 1) {
      lastResponse = await onRequestPost({
        request: request(JSON.stringify({ token: `token-${index}` })),
        env: {
          ENVIRONMENT: 'production',
          TURNSTILE_SECRET_KEY: 'secret',
          TURNSTILE_RATE_LIMIT_MAX: '2',
        },
      });
    }

    expect(lastResponse.status).toBe(429);
    expect(await json(lastResponse)).toMatchObject({ success: false });
  });
});

describe('turnstile verify GET config', () => {
  const env = {
    JWT_SECRET: 'turnstile-get-test-secret-not-in-prod',
    TURNSTILE_SITE_KEY: 'site-key',
    TURNSTILE_SECRET_KEY: 'secret',
  };

  function getRequest(cookieValue) {
    return new Request('https://example.com/api/turnstile/verify', {
      headers: cookieValue ? { Cookie: `ADMIN_AUTH=${cookieValue}` } : {},
    });
  }

  async function getConfig(token, user) {
    const cookieValue = token ? await generateJWT(user, env) : null;
    const response = await onRequestGet({ request: getRequest(cookieValue), env });
    return (await response.json()).data;
  }

  it('does not treat a salesperson token as admin and keeps the widget enabled', async () => {
    const config = await getConfig(
      true,
      { id: 'sp-1', name: 'Sales', type: 'salesperson' }
    );

    expect(config).toMatchObject({ isAdmin: false, enabled: true, siteKey: 'site-key' });
  });

  it('does not treat a public_file_access token as admin', async () => {
    const token = await generateJWT(
      { id: 'share-1', name: 'Share', type: 'public_file_access' },
      env
    );
    const response = await onRequestGet({ request: getRequest(token), env });
    const config = (await response.json()).data;

    expect(config).toMatchObject({ isAdmin: false, enabled: true, siteKey: 'site-key' });
  });

  it('treats an admin token as admin and disables the widget', async () => {
    const token = await generateJWT({ id: 'admin-1', name: 'Admin', type: 'admin' }, env);
    const response = await onRequestGet({ request: getRequest(token), env });
    const config = (await response.json()).data;

    expect(config).toMatchObject({ isAdmin: true, enabled: false, siteKey: null });
  });

  it('treats a legacy type-less token as non-admin', async () => {
    const token = await generateJWT({ id: 'legacy-1', name: 'Legacy', type: undefined }, env);
    const response = await onRequestGet({ request: getRequest(token), env });
    const config = (await response.json()).data;

    expect(config).toMatchObject({ isAdmin: false, enabled: true });
  });

  it('reports non-admin when no token is presented', async () => {
    const response = await onRequestGet({ request: getRequest(null), env });
    const config = (await response.json()).data;

    expect(config).toMatchObject({ isAdmin: false, enabled: true });
  });
});

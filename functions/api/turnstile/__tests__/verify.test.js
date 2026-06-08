import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetTurnstileRateLimitForTest,
  onRequestPost,
} from '../verify.js';

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

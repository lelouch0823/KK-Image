import assert from 'assert';
import { describe, vi } from 'vitest';

export const RUN_REAL_API_TESTS = process.env.RUN_REAL_API_TESTS === '1';
const BASIC_USER = process.env.BASIC_USER || 'admin';
const BASIC_PASS = process.env.BASIC_PASS || '123';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const BEARER_TOKEN_PROMISE_KEY = '__kkImageRealApiBearerTokenPromise';

export function getBaseUrl() {
  const configured = String(process.env.BASE_URL || '').trim();
  if (configured.startsWith('http://') || configured.startsWith('https://')) {
    return configured;
  }
  return 'http://127.0.0.1:8080';
}

export const BASE_URL = getBaseUrl();

export function describeIfRealApi(name, suiteFn) {
  const runner = RUN_REAL_API_TESTS ? describe : describe.skip;
  return runner(name, function wrappedSuite() {
    const timeoutContext = {
      timeout(ms) {
        vi.setConfig({ testTimeout: ms });
      },
    };
    return suiteFn.call(timeoutContext);
  });
}

export const uniqueSeed = (prefix = 'wf') =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(response, payload, attempt) {
  const headerValue = Number(response?.headers?.get('retry-after'));
  const payloadValue = Number(payload?.retryAfter);
  const retryAfterSeconds = Number.isFinite(headerValue) && headerValue > 0
    ? headerValue
    : payloadValue;

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  return 400 * (attempt + 1);
}

export async function waitFor(assertion, {
  timeoutMs = 15000,
  intervalMs = 500,
  onTimeoutMessage = 'waitFor timeout',
} = {}) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await assertion();
    } catch (error) {
      lastError = error;
      await sleep(intervalMs);
    }
  }

  const detail = lastError ? `: ${lastError.message}` : '';
  throw new Error(`${onTimeoutMessage}${detail}`);
}

export async function getBearerToken() {
  if (ADMIN_TOKEN) return ADMIN_TOKEN;
  if (!globalThis[BEARER_TOKEN_PROMISE_KEY]) {
    globalThis[BEARER_TOKEN_PROMISE_KEY] = (async () => {
      let lastStatus = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await fetch(`${getBaseUrl()}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: BASIC_USER,
            password: BASIC_PASS,
          }),
        });

        let payload = null;
        try {
          payload = await response.clone().json();
        } catch {
          payload = null;
        }

        lastStatus = response.status;
        if (response.status === 429) {
          await sleep(getRetryDelayMs(response, payload, attempt));
          continue;
        }

        assert.strictEqual(response.status, 200, 'failed to login for real API tests');
        const setCookie = response.headers.get('set-cookie') || '';
        const match = setCookie.match(/ADMIN_AUTH=([^;]+)/);
        assert.ok(match?.[1], 'ADMIN_AUTH token cookie missing from login response');
        return match[1];
      }

      throw new Error(`failed to login for real API tests after retries, last status=${lastStatus}`);
    })().catch((error) => {
      globalThis[BEARER_TOKEN_PROMISE_KEY] = null;
      throw error;
    });
  }

  return globalThis[BEARER_TOKEN_PROMISE_KEY];
}

export async function apiRequest(path, {
  method = 'GET',
  body,
  expectedStatus,
  bearerToken,
  authHeader,
  headers: extraHeaders,
} = {}) {
  let attempts = 0;
  const finalAuth = authHeader || (bearerToken ? `Bearer ${bearerToken}` : '');
  const headers = {
    'Content-Type': 'application/json',
    ...(extraHeaders || {}),
  };
  if (finalAuth) headers.Authorization = finalAuth;
  let response = null;
  let json = null;

  do {
    response = await fetch(`${getBaseUrl()}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    try {
      json = await response.json();
    } catch {
      json = null;
    }

    if (response.status !== 429) {
      break;
    }

    attempts += 1;
    if (attempts >= 4) {
      break;
    }

    await sleep(getRetryDelayMs(response, json, attempts - 1));
  } while (true);

  if (expectedStatus !== undefined) {
    assert.strictEqual(
      response.status,
      expectedStatus,
      `Unexpected status for ${method} ${path}: ${response.status}, body=${JSON.stringify(json)}`
    );
  }
  return { response, json };
}

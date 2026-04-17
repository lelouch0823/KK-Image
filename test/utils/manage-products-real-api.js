import assert from 'assert';
import FormData from 'form-data';
import fetchMultipart from 'node-fetch';

export const RUN_REAL_API_TESTS = process.env.RUN_REAL_API_TESTS === '1';
const BASIC_USER = process.env.BASIC_USER || 'admin';
const BASIC_PASS = process.env.BASIC_PASS || '123';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const BEARER_TOKEN_PROMISE_KEY = '__kkImageRealApiBearerTokenPromise';
const LOOPBACK_MID_REQUEST_RESTART_MESSAGE = 'Your worker restarted mid-request';
export const REAL_API_RATE_LIMIT_BYPASS_HEADER = 'X-Test-Bypass-RateLimit';
let REAL_API_ISOLATED_IP_COUNTER = 0;

export function getBaseUrl() {
  const configured = String(process.env.BASE_URL || '').trim();
  if (configured.startsWith('http://') || configured.startsWith('https://')) {
    return configured;
  }
  return 'http://127.0.0.1:8080';
}

export const BASE_URL = getBaseUrl();

export function isDirectRealApiTransportEnabled() {
  return (
    String(process.env.REAL_API_TRANSPORT || '')
      .trim()
      .toLowerCase() === 'direct'
  );
}

function isLoopbackRuntime() {
  if (isDirectRealApiTransportEnabled()) return false;
  try {
    const url = new URL(getBaseUrl());
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  } catch {
    return false;
  }
}

function isLoopbackWriteApiRequest(path, method) {
  if (!isLoopbackRuntime()) return false;
  const normalizedMethod = String(method || 'GET').toUpperCase();
  if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD') return false;
  return String(path || '').startsWith('/api/');
}

function shouldWaitForRuntimeStability(path, method, status) {
  if (isDirectRealApiTransportEnabled()) return false;
  if (status < 200 || status >= 300) return false;
  return isLoopbackWriteApiRequest(path, method);
}

export function shouldRetryRealApiLoopbackMidRequest(path, method, status, responseText) {
  if (isDirectRealApiTransportEnabled()) return false;
  if (Number(status) !== 503) return false;
  if (!isLoopbackWriteApiRequest(path, method)) return false;
  return String(responseText || '').includes(LOOPBACK_MID_REQUEST_RESTART_MESSAGE);
}

export async function waitForRealApiRuntimeRecovery() {
  if (isDirectRealApiTransportEnabled()) return;
  await waitFor(
    async () => {
      const response = await Promise.race([
        fetch(`${getBaseUrl()}/api/v1/health`, {
          headers: withRealApiTestHeaders(),
        }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('health check timeout')), 5000);
        }),
      ]);
      assert.strictEqual(response.status, 200, 'loopback runtime is still restarting');
      return response;
    },
    {
      timeoutMs: 30000,
      intervalMs: 500,
      onTimeoutMessage: 'loopback runtime did not recover after loopback write request',
    }
  );
}

async function readResponsePayload(response) {
  let json = null;
  let text = null;
  const jsonSource = typeof response?.clone === 'function' ? response.clone() : response;

  try {
    json = await jsonSource?.json?.();
  } catch {
    json = null;
  }

  if (json == null) {
    const textSource = typeof response?.clone === 'function' ? response.clone() : response;
    try {
      text = await textSource?.text?.();
    } catch {
      text = null;
    }
  }

  return { json, text };
}

function shouldFlushDirectWaitUntil(method) {
  if (!isDirectRealApiTransportEnabled()) return false;
  const normalizedMethod = String(method || 'GET').toUpperCase();
  return normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD';
}

export async function jsonRequest(path, { method = 'GET', headers = {}, body } = {}) {
  if (isDirectRealApiTransportEnabled()) {
    const { directPageRequest } = await import('./direct-pages-real-api.js');
    return directPageRequest(path, {
      method,
      headers,
      body,
      flushWaitUntil: shouldFlushDirectWaitUntil(method),
    });
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await readResponsePayload(response);
  return {
    response,
    json: payload.json,
    text: payload.text,
  };
}

export function describeIfRealApi(name, suiteFn) {
  const runner = RUN_REAL_API_TESTS ? globalThis.describe : globalThis.describe.skip;
  return runner(name, function wrappedSuite() {
    const runtimeContext = this && typeof this.timeout === 'function' ? this : null;
    const timeoutContext = {
      timeout(ms) {
        if (runtimeContext) {
          runtimeContext.timeout(ms);
          return;
        }
        if (globalThis.vi?.setConfig) {
          globalThis.vi.setConfig({ testTimeout: ms });
        }
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

export function createRealApiIsolatedIp(firstOctet = 10) {
  REAL_API_ISOLATED_IP_COUNTER += 1;
  const seed = Date.now() + REAL_API_ISOLATED_IP_COUNTER;
  return [
    firstOctet,
    (Math.floor(seed / 65536) % 250) + 1,
    (Math.floor(seed / 256) % 250) + 1,
    (seed % 250) + 1,
  ].join('.');
}

export function withRealApiTestHeaders(headers = {}) {
  const normalizedHeaders = { ...(headers || {}) };
  if (!RUN_REAL_API_TESTS) return normalizedHeaders;
  if (!(REAL_API_RATE_LIMIT_BYPASS_HEADER in normalizedHeaders)) {
    normalizedHeaders[REAL_API_RATE_LIMIT_BYPASS_HEADER] = '1';
  }
  return normalizedHeaders;
}

function getRetryDelayMs(response, payload, attempt) {
  const headerValue = Number(response?.headers?.get('retry-after'));
  const payloadValue = Number(payload?.retryAfter);
  const retryAfterSeconds =
    Number.isFinite(headerValue) && headerValue > 0 ? headerValue : payloadValue;

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  return 400 * (attempt + 1);
}

export async function waitFor(
  assertion,
  { timeoutMs = 15000, intervalMs = 500, onTimeoutMessage = 'waitFor timeout' } = {}
) {
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
        const payload = await jsonRequest('/api/v1/auth/login', {
          method: 'POST',
          headers: withRealApiTestHeaders({
            'Content-Type': 'application/json',
            'X-Forwarded-For': createRealApiIsolatedIp(),
          }),
          body: {
            username: BASIC_USER,
            password: BASIC_PASS,
          },
        });
        const response = payload.response;
        const json = payload.json;
        const text = payload.text;

        lastStatus = response.status;
        if (response.status === 429) {
          await sleep(getRetryDelayMs(response, json, attempt));
          continue;
        }

        if (
          shouldRetryRealApiLoopbackMidRequest('/api/v1/auth/login', 'POST', response.status, text)
        ) {
          await waitForRealApiRuntimeRecovery();
          continue;
        }

        assert.strictEqual(response.status, 200, 'failed to login for real API tests');
        const setCookie = response.headers.get('set-cookie') || '';
        const match = setCookie.match(/ADMIN_AUTH=([^;]+)/);
        assert.ok(match?.[1], 'ADMIN_AUTH token cookie missing from login response');
        return match[1];
      }

      throw new Error(
        `failed to login for real API tests after retries, last status=${lastStatus}`
      );
    })().catch((error) => {
      globalThis[BEARER_TOKEN_PROMISE_KEY] = null;
      throw error;
    });
  }

  return globalThis[BEARER_TOKEN_PROMISE_KEY];
}

export async function apiRequest(
  path,
  { method = 'GET', body, expectedStatus, bearerToken, authHeader, headers: extraHeaders } = {}
) {
  let attempts = 0;
  const finalAuth = authHeader || (bearerToken ? `Bearer ${bearerToken}` : '');
  const headers = {
    'Content-Type': 'application/json',
    ...withRealApiTestHeaders(extraHeaders || {}),
  };
  if (finalAuth) headers.Authorization = finalAuth;
  let response = null;
  let json = null;
  let text = null;

  do {
    const payload = await jsonRequest(path, {
      method,
      headers,
      body,
    });
    response = payload.response;
    json = payload.json;
    text = payload.text;

    const shouldRetryRateLimit = response.status === 429;
    const shouldRetryRestart = shouldRetryRealApiLoopbackMidRequest(
      path,
      method,
      response.status,
      text
    );

    if (!shouldRetryRateLimit && !shouldRetryRestart) {
      break;
    }

    attempts += 1;
    if (attempts >= 4) {
      break;
    }

    if (shouldRetryRateLimit) {
      await sleep(getRetryDelayMs(response, json, attempts - 1));
      continue;
    }

    await waitForRealApiRuntimeRecovery();
  } while (true);

  if (expectedStatus !== undefined) {
    assert.strictEqual(
      response.status,
      expectedStatus,
      `Unexpected status for ${method} ${path}: ${response.status}, body=${JSON.stringify(json ?? text ?? null)}`
    );
  }

  if (shouldWaitForRuntimeStability(path, method, response.status)) {
    await waitForRealApiRuntimeRecovery();
  }

  return { response, json };
}

function appendMultipartField(formData, key, value) {
  if (value === undefined || value === null) return;

  if (
    typeof value === 'object' &&
    value !== null &&
    Object.prototype.hasOwnProperty.call(value, 'value')
  ) {
    formData.append(key, value.value, {
      filename: value.filename || undefined,
      contentType: value.contentType || 'application/octet-stream',
    });
    return;
  }

  formData.append(key, String(value));
}

function buildMultipartPayload(fields, headers = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields || {})) {
    appendMultipartField(formData, key, value);
  }

  return {
    formData,
    headers: {
      ...headers,
      ...formData.getHeaders(),
    },
  };
}

export async function multipartRequest(
  path,
  {
    method = 'POST',
    fields = {},
    expectedStatus,
    bearerToken,
    authHeader,
    headers: extraHeaders,
  } = {}
) {
  let attempts = 0;
  const finalAuth = authHeader || (bearerToken ? `Bearer ${bearerToken}` : '');
  const baseHeaders = {
    ...withRealApiTestHeaders(extraHeaders || {}),
  };
  if (finalAuth) baseHeaders.Authorization = finalAuth;

  let response = null;
  let json = null;
  let text = null;

  do {
    const { formData, headers } = buildMultipartPayload(fields, baseHeaders);
    response = await fetchMultipart(`${getBaseUrl()}${path}`, {
      method,
      headers,
      body: formData,
    });

    const payload = await readResponsePayload(response);
    json = payload.json;
    text = payload.text;

    const shouldRetryRateLimit = response.status === 429;
    const shouldRetryRestart = shouldRetryRealApiLoopbackMidRequest(
      path,
      method,
      response.status,
      text
    );

    if (!shouldRetryRateLimit && !shouldRetryRestart) {
      break;
    }

    attempts += 1;
    if (attempts >= 4) {
      break;
    }

    if (shouldRetryRateLimit) {
      await sleep(getRetryDelayMs(response, json, attempts - 1));
      continue;
    }

    await waitForRealApiRuntimeRecovery();
  } while (true);

  if (expectedStatus !== undefined) {
    assert.strictEqual(
      response.status,
      expectedStatus,
      `Unexpected status for ${method} ${path}: ${response.status}, body=${JSON.stringify(json ?? text ?? null)}`
    );
  }

  if (shouldWaitForRuntimeStability(path, method, response.status)) {
    await waitForRealApiRuntimeRecovery();
  }

  return { response, json };
}

import assert from 'assert';
import { describe, vi } from 'vitest';

export const RUN_REAL_API_TESTS = process.env.RUN_REAL_API_TESTS === '1';
const BASIC_USER = process.env.BASIC_USER || 'admin';
const BASIC_PASS = process.env.BASIC_PASS || '123';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

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

export async function getBearerToken() {
  if (ADMIN_TOKEN) return ADMIN_TOKEN;
  const response = await fetch(`${getBaseUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: BASIC_USER,
      password: BASIC_PASS,
    }),
  });
  assert.strictEqual(response.status, 200, 'failed to login for real API tests');
  const setCookie = response.headers.get('set-cookie') || '';
  const match = setCookie.match(/ADMIN_AUTH=([^;]+)/);
  assert.ok(match?.[1], 'ADMIN_AUTH token cookie missing from login response');
  return match[1];
}

export async function apiRequest(path, {
  method = 'GET',
  body,
  expectedStatus,
  bearerToken,
  authHeader,
} = {}) {
  const finalAuth = authHeader || (bearerToken ? `Bearer ${bearerToken}` : '');
  const headers = { 'Content-Type': 'application/json' };
  if (finalAuth) headers.Authorization = finalAuth;

  const response = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (expectedStatus !== undefined) {
    assert.strictEqual(
      response.status,
      expectedStatus,
      `Unexpected status for ${method} ${path}: ${response.status}, body=${JSON.stringify(json)}`
    );
  }
  return { response, json };
}

import assert from 'assert';
import {
  apiRequest,
  getBaseUrl,
  multipartRequest,
  sleep,
} from './manage-products-real-api.js';

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

export async function createSalespersonFixture(adminToken, seed, {
  password = '123456',
  namePrefix = 'Real API Sales',
  store = 'Real API Store',
} = {}) {
  const phone = `15${String(Date.now()).slice(-8)}${Math.floor(Math.random() * 10)}`;
  const created = await apiRequest('/api/manage/salespersons', {
    bearerToken: adminToken,
    method: 'POST',
    body: {
      name: `${namePrefix} ${seed}`,
      store,
      phone,
      password,
    },
    expectedStatus: 201,
  });

  const salespersonId = created.json?.data?.id;
  const accessToken = created.json?.data?.accessToken;
  assert.ok(salespersonId, 'salesperson id missing');
  assert.ok(accessToken, 'salesperson access token missing');

  return {
    salespersonId,
    accessToken,
    password,
  };
}

export async function loginSalesperson(accessToken, password = '123456') {
  let response = null;
  let json = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch(`${getBaseUrl()}/api/sales/${accessToken}/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    try {
      json = await response.json();
    } catch {
      json = null;
    }

    if (response.status !== 429 || attempt === 3) {
      break;
    }

    await sleep(getRetryDelayMs(response, json, attempt));
  }

  assert.strictEqual(
    response.status,
    200,
    `sales login failed: status=${response.status}, body=${JSON.stringify(json)}`
  );

  const setCookie = response.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0] || '';
  assert.ok(cookie, 'sales auth cookie missing');

  return {
    cookie,
    token: json?.data?.token || '',
    json,
  };
}

export async function salesApiRequest(accessToken, authToken, path, {
  method = 'GET',
  body,
  expectedStatus,
  headers: extraHeaders,
} = {}) {
  void accessToken;
  return apiRequest(path, {
    method,
    body,
    expectedStatus,
    authHeader: authToken ? `Bearer ${authToken}` : '',
    headers: extraHeaders,
  });
}

export async function salesMultipartRequest(path, {
  method = 'POST',
  fields = {},
  authToken,
  expectedStatus,
  headers: extraHeaders,
} = {}) {
  return multipartRequest(path, {
    method,
    fields,
    expectedStatus,
    authHeader: authToken ? `Bearer ${authToken}` : '',
    headers: extraHeaders,
  });
}

export async function createAuthenticatedSalesSession(adminToken, seed, options = {}) {
  const salesperson = await createSalespersonFixture(adminToken, seed, options);
  const login = await loginSalesperson(salesperson.accessToken, salesperson.password);
  return {
    ...salesperson,
    cookie: login.cookie,
    jwt: login.token,
  };
}

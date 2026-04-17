import assert from 'assert';
import {
  describeIfRealApi,
  getBaseUrl,
  getBearerToken,
  apiRequest,
  shouldRetryRealApiLoopbackMidRequest,
  uniqueSeed,
  waitForRealApiRuntimeRecovery,
  waitFor,
  sleep,
  withRealApiTestHeaders,
} from './utils/manage-products-real-api.js';
import { createWorkflowProduct } from './utils/order-procurement-real-api.js';

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

async function postJsonWithRetry(path, body, { expectedStatus, headers: extraHeaders } = {}) {
  let response = null;
  let json = null;
  let text = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch(`${getBaseUrl()}${path}`, {
      method: 'POST',
      headers: withRealApiTestHeaders({
        'Content-Type': 'application/json',
        ...(extraHeaders || {}),
      }),
      body: JSON.stringify(body),
    });

    const jsonSource = typeof response?.clone === 'function' ? response.clone() : response;
    try {
      json = await jsonSource.json();
    } catch {
      json = null;
    }

    if (json == null) {
      const textSource = typeof response?.clone === 'function' ? response.clone() : response;
      try {
        text = await textSource.text();
      } catch {
        text = null;
      }
    } else {
      text = null;
    }

    const shouldRetryRateLimit = response.status === 429;
    const shouldRetryRestart = shouldRetryRealApiLoopbackMidRequest(
      path,
      'POST',
      response.status,
      text
    );

    if ((!shouldRetryRateLimit && !shouldRetryRestart) || attempt === 3) {
      break;
    }

    if (shouldRetryRateLimit) {
      await sleep(getRetryDelayMs(response, json, attempt));
      continue;
    }

    await waitForRealApiRuntimeRecovery();
  }

  if (expectedStatus !== undefined) {
    assert.strictEqual(
      response.status,
      expectedStatus,
      `Unexpected status for POST ${path}: ${response.status}, body=${JSON.stringify(json ?? text ?? null)}`
    );
  }

  return { response, json };
}

function findSalesperson(listPayload, salespersonId) {
  return (listPayload?.data?.salespersons || []).find((item) => item.id === salespersonId) || null;
}

describeIfRealApi('Salespersons Real API', function () {
  this.timeout(120000);

  it('covers manage lifecycle, cache refresh, token reset, disable/enable, and unlinked delete', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('salesperson');
    const phone = `139${String(Date.now()).slice(-8)}`;
    const loginHeaders = { 'X-Forwarded-For': `10.0.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` };

    const created = await apiRequest('/api/manage/salespersons', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Salesperson ${seed}`,
        store: `Store ${seed}`,
        phone,
        password: '123456',
      },
      expectedStatus: 201,
    });
    const salespersonId = created.json?.data?.id;
    const originalAccessToken = created.json?.data?.accessToken;
    assert.ok(salespersonId, 'salesperson id missing');
    assert.ok(originalAccessToken, 'salesperson access token missing');

    const firstList = await apiRequest('/api/manage/salespersons?page=1&limit=50', {
      bearerToken: token,
      expectedStatus: 200,
    });
    assert.ok(findSalesperson(firstList.json, salespersonId), 'created salesperson missing from list');
    assert.strictEqual(firstList.response.headers.get('x-cache'), 'MISS');

    const cachedList = await apiRequest('/api/manage/salespersons?page=1&limit=50', {
      bearerToken: token,
      expectedStatus: 200,
    });
    assert.strictEqual(cachedList.response.headers.get('x-cache'), 'HIT');

    const detail = await apiRequest(`/api/manage/salespersons/${salespersonId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    assert.strictEqual(detail.json?.data?.id, salespersonId);
    assert.strictEqual(detail.json?.data?.phone, phone);

    const updatedPhone = `138${String(Date.now()).slice(-8)}`;
    await apiRequest(`/api/manage/salespersons/${salespersonId}`, {
      bearerToken: token,
      method: 'PATCH',
      body: {
        store: `Updated Store ${seed}`,
        phone: updatedPhone,
      },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const refreshed = await apiRequest('/api/manage/salespersons?page=1&limit=50', {
        bearerToken: token,
        expectedStatus: 200,
      });
      const salesperson = findSalesperson(refreshed.json, salespersonId);
      assert.ok(salesperson, 'updated salesperson missing from list');
      assert.strictEqual(salesperson.store, `Updated Store ${seed}`);
      assert.strictEqual(salesperson.phone, updatedPhone);
      return salesperson;
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'salesperson list cache did not refresh after update',
    });

    const resetToken = await apiRequest(`/api/manage/salespersons/${salespersonId}/reset-token`, {
      bearerToken: token,
      method: 'POST',
      expectedStatus: 200,
    });
    const newAccessToken = resetToken.json?.data?.accessToken;
    assert.ok(newAccessToken, 'new access token missing after reset');
    assert.notStrictEqual(newAccessToken, originalAccessToken);

    await postJsonWithRetry(`/api/sales/${originalAccessToken}/auth`, { password: '123456' }, {
      expectedStatus: 404,
      headers: loginHeaders,
    });

    const newTokenLogin = await postJsonWithRetry(
      `/api/sales/${newAccessToken}/auth`,
      { password: '123456' },
      {
        expectedStatus: 200,
        headers: loginHeaders,
      }
    );
    const jwt = newTokenLogin.json?.data?.token;
    assert.ok(jwt, 'jwt missing after reset-token auth');

    await apiRequest(`/api/manage/salespersons/${salespersonId}`, {
      bearerToken: token,
      method: 'PATCH',
      body: {
        isActive: false,
      },
      expectedStatus: 200,
    });

    await apiRequest(`/api/sales/${newAccessToken}/auth`, {
      authHeader: `Bearer ${jwt}`,
      expectedStatus: 403,
    });

    await apiRequest(`/api/manage/salespersons/${salespersonId}`, {
      bearerToken: token,
      method: 'PATCH',
      body: {
        isActive: true,
      },
      expectedStatus: 200,
    });

    const reenabledProfile = await apiRequest(`/api/sales/${newAccessToken}/auth`, {
      authHeader: `Bearer ${jwt}`,
      expectedStatus: 200,
    });
    assert.strictEqual(reenabledProfile.json?.data?.id, salespersonId);
    assert.strictEqual(reenabledProfile.json?.data?.phone, updatedPhone);

    await apiRequest(`/api/manage/salespersons/${salespersonId}`, {
      bearerToken: token,
      method: 'DELETE',
      expectedStatus: 200,
    });

    await apiRequest(`/api/manage/salespersons/${salespersonId}`, {
      bearerToken: token,
      expectedStatus: 404,
    });
  });

  it('covers sales auth/profile/stats and blocks deleting a salesperson with orders', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('sales-profile');
    const phone = `137${String(Date.now()).slice(-8)}`;
    const loginHeaders = { 'X-Forwarded-For': `10.1.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` };

    const created = await apiRequest('/api/manage/salespersons', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Sales Profile ${seed}`,
        store: `Profile Store ${seed}`,
        phone,
        password: '123456',
      },
      expectedStatus: 201,
    });
    const salespersonId = created.json?.data?.id;
    const accessToken = created.json?.data?.accessToken;
    assert.ok(salespersonId, 'profile salesperson id missing');
    assert.ok(accessToken, 'profile salesperson access token missing');

    const login = await postJsonWithRetry('/api/sales/login', {
      username: phone,
      password: '123456',
    }, {
      expectedStatus: 200,
      headers: loginHeaders,
    });
    const jwt = login.json?.data?.token;
    assert.ok(jwt, 'sales login jwt missing');

    const tokenLogin = await postJsonWithRetry(`/api/sales/${accessToken}/auth`, {
      password: '123456',
    }, {
      expectedStatus: 200,
      headers: loginHeaders,
    });
    assert.strictEqual(tokenLogin.json?.data?.id, salespersonId);

    const authProfile = await apiRequest(`/api/sales/${accessToken}/auth`, {
      authHeader: `Bearer ${jwt}`,
      expectedStatus: 200,
    });
    assert.strictEqual(authProfile.json?.data?.id, salespersonId);
    assert.strictEqual(authProfile.json?.data?.phone, phone);
    assert.strictEqual(authProfile.json?.data?.store, `Profile Store ${seed}`);

    const firstStats = await apiRequest(`/api/sales/${accessToken}/stats`, {
      authHeader: `Bearer ${jwt}`,
      expectedStatus: 200,
    });
    assert.strictEqual(firstStats.json?.data?.totalOrders, 0);
    assert.strictEqual(firstStats.response.headers.get('x-cache'), 'MISS');

    const cachedStats = await apiRequest(`/api/sales/${accessToken}/stats`, {
      authHeader: `Bearer ${jwt}`,
      expectedStatus: 200,
    });
    assert.strictEqual(cachedStats.response.headers.get('x-cache'), 'HIT');

    const {
      productId,
      variantId,
      productName,
    } = await createWorkflowProduct(token, seed, {
      stockQuantity: 3,
      namePrefix: 'Sales Profile Product',
      skuPrefix: 'SALPRO',
    });

    const createdOrder = await apiRequest('/api/manage/orders', {
      bearerToken: token,
      method: 'POST',
      body: {
        productName,
        salespersonId,
        productId,
        variantId,
        quantity: 1,
        fileIds: [],
      },
      expectedStatus: 201,
    });
    const orderId = createdOrder.json?.data?.id;
    assert.ok(orderId, 'sales profile order id missing');

    await apiRequest(`/api/manage/orders/${orderId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'confirmed' },
      expectedStatus: 200,
    });

    const confirmedDetail = await apiRequest(`/api/manage/orders/${orderId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const lineId = confirmedDetail.json?.data?.lines?.[0]?.id;
    assert.ok(lineId, 'sales profile order line missing after confirm');

    await apiRequest(`/api/manage/orders/${orderId}/lines/${lineId}/ship`, {
      bearerToken: token,
      method: 'POST',
      body: { quantity: 1 },
      expectedStatus: 200,
    });

    await apiRequest(`/api/manage/orders/${orderId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'fulfilled' },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const stats = await apiRequest(`/api/sales/${accessToken}/stats`, {
        authHeader: `Bearer ${jwt}`,
        expectedStatus: 200,
      });
      assert.strictEqual(stats.json?.data?.totalOrders, 1);
      assert.strictEqual(stats.json?.data?.completedOrders, 1);
      assert.strictEqual(stats.json?.data?.monthOrders, 1);
      assert.strictEqual(stats.json?.data?.monthlyTrend?.length, 30);
      assert.ok(
        stats.json.data.monthlyTrend.some((item) => Number(item.count || 0) >= 1),
        'monthly trend did not capture new order'
      );
      return stats.json?.data;
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'sales profile stats did not refresh after order changes',
    });

    const blockedDelete = await apiRequest(`/api/manage/salespersons/${salespersonId}`, {
      bearerToken: token,
      method: 'DELETE',
      expectedStatus: 400,
    });
    assert.strictEqual(blockedDelete.json?.success, false);

    const stillExists = await apiRequest(`/api/manage/salespersons/${salespersonId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    assert.strictEqual(stillExists.json?.data?.id, salespersonId);
  });
});

import assert from 'assert';
import {
  BASE_URL,
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  withRealApiTestHeaders,
} from './utils/manage-products-real-api.js';

function createUniqueForwardedIp() {
  return `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
}

describeIfRealApi('Manage Products Real API Authz', function () {
  this.timeout(60000);

  it('rejects missing auth with 401', async () => {
    const response = await fetch(`${BASE_URL}/api/manage/products?page=1&limit=5`, {
      headers: withRealApiTestHeaders({
        'X-Forwarded-For': createUniqueForwardedIp(),
      }),
    });
    assert.strictEqual(response.status, 401);
  });

  it('rejects invalid bearer token with 401', async () => {
    const { response } = await apiRequest('/api/manage/products?page=1&limit=5', {
      authHeader: 'Bearer invalid-token',
      headers: {
        'X-Forwarded-For': createUniqueForwardedIp(),
      },
    });
    assert.strictEqual(response.status, 401);
  });

  it('accepts valid bearer token', async () => {
    const token = await getBearerToken();
    const { json } = await apiRequest('/api/manage/products?page=1&limit=5', {
      bearerToken: token,
      expectedStatus: 200,
    });
    assert.strictEqual(json?.success, true);
    assert.ok(Array.isArray(json?.data));
  });
});

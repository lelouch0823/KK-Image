import assert from 'assert';
import {
  BASE_URL,
  describeIfRealApi,
  getBearerToken,
  apiRequest,
} from './utils/manage-products-real-api.js';

describeIfRealApi('Manage Products Real API Authz', function () {
  this.timeout(60000);

  it('rejects missing auth with 401', async () => {
    const response = await fetch(`${BASE_URL}/api/manage/products?page=1&limit=5`);
    assert.strictEqual(response.status, 401);
  });

  it('rejects invalid bearer token with 401', async () => {
    const { response } = await apiRequest('/api/manage/products?page=1&limit=5', {
      authHeader: 'Bearer invalid-token',
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


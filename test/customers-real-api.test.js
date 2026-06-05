import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
  waitFor,
} from './utils/manage-products-real-api.js';
import {
  ensureSalespersonId,
  createWorkflowProduct,
  getOrderDetail,
} from './utils/order-procurement-real-api.js';

function findCustomer(listPayload, customerId) {
  return (listPayload?.data?.list || listPayload?.data || []).find((item) => item.id === customerId) || null;
}

describeIfRealApi('Customers Real API', function () {
  this.timeout(180000);

  it('covers create, search, pagination, detail, update, cache invalidation, and delete for unlinked customers', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('customer');

    const createdIds = [];
    for (const suffix of ['A', 'B', 'C']) {
      const created = await apiRequest('/api/manage/customers', {
        bearerToken: token,
        method: 'POST',
        body: {
          name: `Customer ${suffix} ${seed}`,
          phone: `188${String(Date.now()).slice(-8)}`,
          company: `Company ${suffix} ${seed}`,
          email: `${suffix.toLowerCase()}-${seed}@example.com`,
          address: `Address ${suffix} ${seed}`,
          tags: [seed, suffix],
          remark: `remark-${suffix}-${seed}`,
        },
        expectedStatus: 200,
      });
      const customerId = created.json?.data?.id;
      assert.ok(customerId, `customer id missing for ${suffix}`);
      createdIds.push(customerId);
    }

    const firstPage = await apiRequest(
      `/api/manage/customers?search=${encodeURIComponent(seed)}&page=1&limit=2`,
      {
        bearerToken: token,
        expectedStatus: 200,
      }
    );
    assert.strictEqual(firstPage.json?.pagination?.total, 3);
    assert.strictEqual(firstPage.json?.pagination?.page, 1);
    assert.strictEqual(firstPage.json?.pagination?.limit, 2);
    assert.strictEqual(firstPage.json?.pagination?.totalPages, 2);
    assert.strictEqual(firstPage.json?.data?.length, 2);

    const secondPage = await apiRequest(
      `/api/manage/customers?search=${encodeURIComponent(seed)}&page=2&limit=2`,
      {
        bearerToken: token,
        expectedStatus: 200,
      }
    );
    assert.strictEqual(secondPage.json?.pagination?.total, 3);
    assert.strictEqual(secondPage.json?.pagination?.page, 2);
    assert.strictEqual(secondPage.json?.data?.length, 1);

    const detail = await apiRequest(`/api/manage/customers/${createdIds[0]}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    assert.strictEqual(detail.json?.data?.id, createdIds[0]);
    assert.strictEqual(detail.json?.data?.name, `Customer A ${seed}`);
    assert.deepStrictEqual(detail.json?.data?.tags, [seed, 'A']);

    const cacheUrl = '/api/manage/customers?page=1&limit=20';

    await apiRequest(`/api/manage/customers/${createdIds[0]}`, {
      bearerToken: token,
      method: 'PUT',
      body: {
        name: `Customer A Updated ${seed}`,
        phone: `177${String(Date.now()).slice(-8)}`,
        company: `Company A Updated ${seed}`,
        tags: [seed, 'updated'],
        remark: `remark-updated-${seed}`,
      },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const refreshed = await apiRequest(cacheUrl, {
        bearerToken: token,
        expectedStatus: 200,
      });
      const updatedCustomer = findCustomer(refreshed.json, createdIds[0]);
      assert.ok(updatedCustomer, 'updated customer missing from refreshed list');
      assert.strictEqual(updatedCustomer.name, `Customer A Updated ${seed}`);
      assert.deepStrictEqual(updatedCustomer.tags, [seed, 'updated']);
      return refreshed;
    }, {
      timeoutMs: 30000,
      intervalMs: 1000,
      onTimeoutMessage: 'customer list cache did not refresh after update',
    });

    await apiRequest(`/api/manage/customers/${createdIds[2]}`, {
      bearerToken: token,
      method: 'DELETE',
      expectedStatus: 200,
    });

    await apiRequest(`/api/manage/customers/${createdIds[2]}`, {
      bearerToken: token,
      expectedStatus: 404,
    });
  });

  it('rejects deleting a customer that is linked to an order', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('customer-guard');

    const createdCustomer = await apiRequest('/api/manage/customers', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Protected Customer ${seed}`,
        phone: `166${String(Date.now()).slice(-8)}`,
        company: `Protected Company ${seed}`,
      },
      expectedStatus: 200,
    });
    const customerId = createdCustomer.json?.data?.id;
    assert.ok(customerId, 'protected customer id missing');

    const salespersonId = await ensureSalespersonId(token, seed, {
      namePrefix: 'Customer Guard Sales',
      store: 'Customer Guard Store',
    });
    const {
      productId,
      variantId,
      productName,
    } = await createWorkflowProduct(token, seed, {
      stockQuantity: 2,
      namePrefix: 'Customer Guard Product',
      skuPrefix: 'CUSTGUARD',
    });

    const createdOrder = await apiRequest('/api/manage/orders', {
      bearerToken: token,
      method: 'POST',
      body: {
        productName,
        salespersonId,
        productId,
        variantId,
        customerId,
        quantity: 1,
        fileIds: [],
      },
      expectedStatus: 201,
    });
    const orderId = createdOrder.json?.data?.id;
    assert.ok(orderId, 'customer-linked order id missing');

    await waitFor(async () => {
      const orderDetail = await getOrderDetail(token, orderId);
      assert.strictEqual(orderDetail?.customerId, customerId);
      return orderDetail;
    }, {
      timeoutMs: 10000,
      intervalMs: 500,
      onTimeoutMessage: 'created order did not retain customer linkage',
    });

    const rejectedDelete = await apiRequest(`/api/manage/customers/${customerId}`, {
      bearerToken: token,
      method: 'DELETE',
      expectedStatus: 400,
    });
    assert.strictEqual(rejectedDelete.json?.success, false);

    const customerStillExists = await apiRequest(`/api/manage/customers/${customerId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    assert.strictEqual(customerStillExists.json?.data?.id, customerId);
  });
});

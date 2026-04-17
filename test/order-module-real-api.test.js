import assert from 'assert';
import {
  describeIfRealApi,
  getBaseUrl,
  getBearerToken,
  apiRequest,
  uniqueSeed,
  waitFor,
  withRealApiTestHeaders,
} from './utils/manage-products-real-api.js';
import {
  ensureSalespersonId,
  createWorkflowProduct,
  getOrderDetail,
} from './utils/order-procurement-real-api.js';

async function textRequest(path, { bearerToken, expectedStatus = 200 } = {}) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    headers: withRealApiTestHeaders(
      bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}
    ),
  });
  const text = await response.text();
  assert.strictEqual(
    response.status,
    expectedStatus,
    `Unexpected status for GET ${path}: ${response.status}, body=${text}`
  );
  return text;
}

function findListedOrder(payload, orderId) {
  return (payload?.data?.orders || []).find((item) => item.id === orderId);
}

describeIfRealApi('Order Module Real API Workflow', function () {
  this.timeout(180000);

  it('covers create, list, detail, update, comment, export, fulfillment, delivery confirmation, and delete', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('order-module');
    const salespersonId = await ensureSalespersonId(token, seed, {
      namePrefix: 'Order Module Sales',
      store: 'Order Module Store',
    });
    const {
      productId,
      variantId,
      productName,
    } = await createWorkflowProduct(token, seed, {
      stockQuantity: 5,
      alertThreshold: 1,
      namePrefix: 'Order Module Product',
      skuPrefix: 'ORDMOD',
      dimensionValue: 'Blue',
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
        remark: `created-${seed}`,
        fileIds: [],
      },
      expectedStatus: 201,
    });
    const orderId = createdOrder.json?.data?.id;
    const orderNo = createdOrder.json?.data?.orderNo;
    assert.ok(orderId, 'order id missing');
    assert.ok(orderNo, 'order no missing');

    const initialList = await apiRequest(`/api/manage/orders?search=${encodeURIComponent(seed)}&status=pending`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const pendingListedOrder = findListedOrder(initialList.json, orderId);
    assert.ok(pendingListedOrder, 'created order missing from pending list');
    assert.strictEqual(pendingListedOrder.status, 'pending');

    const stats = await apiRequest('/api/manage/orders/stats', {
      bearerToken: token,
      expectedStatus: 200,
    });
    assert.ok(Array.isArray(stats.json?.data?.monthTrend), 'monthTrend missing');
    assert.strictEqual(stats.json?.data?.monthTrend?.length, 30);
    assert.strictEqual(typeof stats.json?.data?.todayCount, 'number');

    const initialDetail = await apiRequest(`/api/manage/orders/${orderId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    assert.strictEqual(initialDetail.json?.data?.id, orderId);
    assert.strictEqual(initialDetail.json?.data?.status, 'pending');
    assert.strictEqual(initialDetail.json?.data?.quantity, 1);
    assert.ok(initialDetail.json?.data?.lines?.[0]?.id, 'initial order line missing');

    await apiRequest(`/api/manage/orders/${orderId}`, {
      bearerToken: token,
      method: 'PATCH',
      body: {
        reason: 'ops update before confirm',
        updates: {
          quantity: 2,
          remark: `updated-${seed}`,
          deadline: '2026-12-31',
        },
      },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const detail = await getOrderDetail(token, orderId);
      assert.strictEqual(detail?.quantity, 2);
      assert.strictEqual(detail?.currentData?.remark, `updated-${seed}`);
      assert.strictEqual(detail?.currentData?.deadline, '2026-12-31');
      assert.strictEqual(detail?.lines?.[0]?.orderedQuantity, 2);
      return detail;
    }, {
      timeoutMs: 10000,
      intervalMs: 400,
      onTimeoutMessage: 'patched order detail did not converge',
    });

    const comment = `follow-up-${seed}`;
    await apiRequest(`/api/manage/orders/${orderId}/comment`, {
      bearerToken: token,
      method: 'POST',
      body: { comment },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const detail = await getOrderDetail(token, orderId);
      const comments = (detail?.timeline || [])
        .filter((item) => item?.actionType === 'comment')
        .map((item) => item?.comment || '');
      assert.ok(comments.some((item) => String(item).includes(comment)), 'order comment missing from timeline');
      return detail;
    }, {
      timeoutMs: 10000,
      intervalMs: 400,
      onTimeoutMessage: 'order comment did not appear in detail timeline',
    });

    const exportCsv = await textRequest(`/api/manage/orders/export?search=${encodeURIComponent(seed)}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    assert.match(exportCsv, new RegExp(orderNo));
    assert.match(exportCsv, new RegExp(productName));

    await apiRequest(`/api/manage/orders/${orderId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'confirmed' },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const listed = await apiRequest(`/api/manage/orders?search=${encodeURIComponent(seed)}&status=confirmed`, {
        bearerToken: token,
        expectedStatus: 200,
      });
      const confirmedOrder = findListedOrder(listed.json, orderId);
      assert.ok(confirmedOrder, 'confirmed order missing from filtered list');
      assert.strictEqual(confirmedOrder.status, 'confirmed');
      return confirmedOrder;
    }, {
      timeoutMs: 10000,
      intervalMs: 400,
      onTimeoutMessage: 'confirmed order did not appear in list filter',
    });

    const confirmedDetail = await getOrderDetail(token, orderId);
    const lineId = confirmedDetail?.lines?.[0]?.id;
    assert.ok(lineId, 'confirmed order line missing');

    await apiRequest(`/api/manage/orders/${orderId}/lines/${lineId}/ship`, {
      bearerToken: token,
      method: 'POST',
      body: { quantity: 2 },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const detail = await getOrderDetail(token, orderId);
      assert.strictEqual(detail?.lines?.[0]?.shippedQuantity, 2);
      return detail;
    }, {
      timeoutMs: 10000,
      intervalMs: 400,
      onTimeoutMessage: 'order line shipment did not converge',
    });

    await apiRequest(`/api/manage/orders/${orderId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'fulfilled' },
      expectedStatus: 200,
    });

    await apiRequest(`/api/manage/orders/${orderId}/delivery-confirmation`, {
      bearerToken: token,
      method: 'POST',
      body: { note: `signed-${seed}` },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const detail = await getOrderDetail(token, orderId);
      assert.strictEqual(detail?.status, 'fulfilled');
      assert.strictEqual(detail?.deliveryStatus, 'delivered');
      assert.ok(Number(detail?.deliveryConfirmedAt || 0) > 0, 'deliveryConfirmedAt missing');
      assert.match(String(detail?.deliveryConfirmedBy || ''), /admin/i);
      return detail;
    }, {
      timeoutMs: 10000,
      intervalMs: 400,
      onTimeoutMessage: 'delivery confirmation did not converge in order detail',
    });

    const deliveredList = await apiRequest(
      `/api/manage/orders?search=${encodeURIComponent(seed)}&deliveryStatus=delivered`,
      {
        bearerToken: token,
        expectedStatus: 200,
      }
    );
    const deliveredOrder = findListedOrder(deliveredList.json, orderId);
    assert.ok(deliveredOrder, 'delivered order missing from delivery-status list');
    assert.strictEqual(deliveredOrder.deliveryStatus, 'delivered');

    await apiRequest(`/api/manage/orders/${orderId}`, {
      bearerToken: token,
      method: 'DELETE',
      expectedStatus: 200,
    });

    await apiRequest(`/api/manage/orders/${orderId}`, {
      bearerToken: token,
      expectedStatus: 404,
    });
  });

  it('rejects invalid comment, delivery confirmation, and status transitions without mutating the order', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('order-module-guards');
    const salespersonId = await ensureSalespersonId(token, seed, {
      namePrefix: 'Order Guard Sales',
      store: 'Order Guard Store',
    });
    const {
      productId,
      variantId,
      productName,
    } = await createWorkflowProduct(token, seed, {
      stockQuantity: 3,
      namePrefix: 'Order Guard Product',
      skuPrefix: 'ORDGUARD',
      dimensionValue: 'Gray',
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
    assert.ok(orderId, 'guard order id missing');

    const emptyComment = await apiRequest(`/api/manage/orders/${orderId}/comment`, {
      bearerToken: token,
      method: 'POST',
      body: { comment: '' },
      expectedStatus: 400,
    });
    assert.match(String(emptyComment.json?.error || ''), /invalid|参数|params|有误/i);

    const prematureDeliveryConfirm = await apiRequest(`/api/manage/orders/${orderId}/delivery-confirmation`, {
      bearerToken: token,
      method: 'POST',
      body: { note: 'too early' },
      expectedStatus: 400,
    });
    assert.match(
      String(prematureDeliveryConfirm.json?.error || ''),
      /delivery confirmation requires a fulfilled order/i
    );

    const invalidStatusJump = await apiRequest(`/api/manage/orders/${orderId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'delivered' },
      expectedStatus: 400,
    });
    assert.match(String(invalidStatusJump.json?.error || ''), /invalid status transition/i);

    const detail = await getOrderDetail(token, orderId);
    assert.strictEqual(detail?.status, 'pending');
    assert.strictEqual(detail?.deliveryStatus, 'not_shipped');
    assert.ok(
      !(detail?.timeline || []).some((item) => String(item?.comment || '').includes('too early')),
      'invalid operations should not write success timeline entries'
    );

    await apiRequest(`/api/manage/orders/${orderId}`, {
      bearerToken: token,
      method: 'DELETE',
      expectedStatus: 200,
    });
  });
});

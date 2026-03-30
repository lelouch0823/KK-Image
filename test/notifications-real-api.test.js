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
  createConfirmedOrder,
  createPurchaseOrderFromOrders,
  transitionPurchaseOrderToShipping,
  getPurchaseOrderDetail,
} from './utils/order-procurement-real-api.js';

async function findAdminNotification(token, predicate, { unreadOnly = false } = {}) {
  const query = unreadOnly ? '?limit=20&unread_only=true' : '?limit=20';
  const result = await apiRequest(`/api/manage/notifications${query}`, {
    bearerToken: token,
    expectedStatus: 200,
  });
  const list = result.json?.data?.list || [];
  return {
    list,
    unreadCount: Number(result.json?.data?.unreadCount || 0),
    match: list.find(predicate) || null,
  };
}

describeIfRealApi('Notifications Real API Workflow', function () {
  this.timeout(120000);

  it('materializes admin notifications through outbox and supports read transitions', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('notify');
    const title = `Real API Notification ${seed}`;
    const content = `content-${seed}`;

    const resetUnread = await apiRequest('/api/manage/notifications/all/read', {
      bearerToken: token,
      method: 'POST',
      expectedStatus: 200,
    });
    assert.strictEqual(resetUnread.json?.success, true);

    const created = await apiRequest('/api/manage/notifications', {
      bearerToken: token,
      method: 'POST',
      body: {
        type: 'system',
        title,
        content,
        link: `/notifications/${seed}`,
        metadata: { seed },
      },
      expectedStatus: 200,
    });
    assert.strictEqual(created.json?.success, true);

    const createdNotification = await waitFor(async () => {
      const result = await findAdminNotification(token, (item) => item.title === title, { unreadOnly: true });
      assert.ok(result.match, 'notification has not been materialized yet');
      return result.match;
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'admin notification did not appear in unread list',
    });

    const markedRead = await apiRequest(`/api/manage/notifications/${createdNotification.id}/read`, {
      bearerToken: token,
      method: 'POST',
      expectedStatus: 200,
    });
    assert.strictEqual(markedRead.json?.success, true);

    await waitFor(async () => {
      const result = await findAdminNotification(token, (item) => item.id === createdNotification.id, { unreadOnly: true });
      assert.ok(!result.match, 'notification still appears in unread list after read');
      return true;
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'admin notification was not removed from unread list after read',
    });

    const finalList = await waitFor(async () => {
      const result = await findAdminNotification(token, (item) => item.id === createdNotification.id);
      assert.ok(result.match, 'notification missing from full list after read');
      assert.strictEqual(Number(result.match.is_read), 1);
      return result;
    }, {
      timeoutMs: 20000,
      intervalMs: 500,
      onTimeoutMessage: 'admin notification did not reappear as read in full list',
    });
    assert.strictEqual(finalList.match.title, title);
    assert.strictEqual(finalList.match.content, content);
  });

  it('materializes procurement notifications from business events and supports clearing unread state afterwards', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('notify-procurement');
    const salespersonId = await ensureSalespersonId(token, seed);
    const { productId, variantId, productName } = await createWorkflowProduct(token, seed, {
      stockQuantity: 0,
    });

    const resetUnread = await apiRequest('/api/manage/notifications/all/read', {
      bearerToken: token,
      method: 'POST',
      expectedStatus: 200,
    });
    assert.strictEqual(resetUnread.json?.success, true);

    const orderId = await createConfirmedOrder(token, {
      seed,
      salespersonId,
      productId,
      variantId,
      productName,
      quantity: 2,
    });
    const poId = await createPurchaseOrderFromOrders(token, [orderId], seed);

    await transitionPurchaseOrderToShipping(token, poId);

    const poDetail = await getPurchaseOrderDetail(token, poId);
    const poItemId = poDetail?.items?.[0]?.id;
    assert.ok(poItemId, 'purchase order item missing for procurement notification flow');

    await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-receipt`,
      },
      body: {
        items: [
          {
            purchase_order_item_id: poItemId,
            received_qty: 2,
            note: 'notification business event receipt',
          },
        ],
      },
      expectedStatus: 201,
    });

    const businessNotification = await waitFor(async () => {
      const result = await findAdminNotification(
        token,
        (item) =>
          String(item?.title || '').includes('notification.purchase_receipt_recorded') ||
          String(item?.title || '').includes('notification.order_procurement_progressed'),
        { unreadOnly: true }
      );
      assert.ok(result.match, 'business notification has not been materialized yet');
      assert.ok(result.unreadCount >= 1, 'unread count did not increase for business notification');
      return result.match;
    }, {
      timeoutMs: 20000,
      intervalMs: 500,
      onTimeoutMessage: 'procurement notification did not appear in unread list',
    });

    const clearUnread = await apiRequest('/api/manage/notifications/all/read', {
      bearerToken: token,
      method: 'POST',
      expectedStatus: 200,
    });
    assert.strictEqual(clearUnread.json?.success, true);

    await waitFor(async () => {
      const unreadResult = await findAdminNotification(token, () => true, { unreadOnly: true });
      assert.strictEqual(unreadResult.unreadCount, 0);
      return unreadResult;
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'unread notifications were not cleared after mark-all-read',
    });

    const finalList = await waitFor(async () => {
      const result = await findAdminNotification(token, (item) => item.id === businessNotification.id);
      assert.ok(result.match, 'business notification missing from full list');
      assert.strictEqual(Number(result.match.is_read), 1);
      return result;
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'business notification did not remain in full list as read',
    });

    assert.ok(
      String(finalList.match.title || '').includes('notification.purchase_receipt_recorded') ||
        String(finalList.match.title || '').includes('notification.order_procurement_progressed')
    );
  });
});

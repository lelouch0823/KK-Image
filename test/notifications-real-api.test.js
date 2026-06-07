import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
  waitFor,
  processOutbox,
  itSkipInLoopback,
} from './utils/manage-products-real-api.js';
import {
  ensureSalespersonId,
  createWorkflowProduct,
  createConfirmedOrder,
  createPurchaseOrderFromOrders,
  transitionPurchaseOrderToShipping,
  getOrderDetail,
  getPurchaseOrderDetail,
} from './utils/order-procurement-real-api.js';
import { createAuthenticatedSalesSession, salesApiRequest } from './utils/sales-real-api.js';

async function findAdminNotification(
  token,
  predicate,
  { unreadOnly = false, limit = 20, cacheBust = false } = {}
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (unreadOnly) {
    params.set('unread_only', 'true');
  }
  if (cacheBust) {
    params.set('_t', String(Date.now()));
  }
  const query = `?${params.toString()}`;
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

async function findSalesNotification(
  accessToken,
  authToken,
  predicate,
  { unreadOnly = false, limit = 20, cacheBust = false } = {}
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (unreadOnly) {
    params.set('unread_only', 'true');
  }
  if (cacheBust) {
    params.set('_t', String(Date.now()));
  }
  const query = `?${params.toString()}`;
  const result = await salesApiRequest(
    accessToken,
    authToken,
    `/api/sales/${accessToken}/notifications${query}`,
    {
      expectedStatus: 200,
    }
  );
  const list = result.json?.data?.list || [];
  return {
    list,
    unreadCount: Number(result.json?.data?.unreadCount || 0),
    match: list.find(predicate) || null,
  };
}

describeIfRealApi('Notifications Real API Workflow', function () {
  this.timeout(360000);
  const salesNotificationPoll = {
    timeoutMs: 30000,
    intervalMs: 1500,
  };
  const adminNotificationPoll = {
    timeoutMs: 25000,
    intervalMs: 1000,
  };

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

    await processOutbox();

    const createdNotification = await waitFor(
      async () => {
        const result = await findAdminNotification(token, (item) => item.title === title, {
          unreadOnly: true,
        });
        assert.ok(result.match, 'notification has not been materialized yet');
        return result.match;
      },
      {
        timeoutMs: 15000,
        intervalMs: 500,
        onTimeoutMessage: 'admin notification did not appear in unread list',
      }
    );

    const markedRead = await apiRequest(
      `/api/manage/notifications/${createdNotification.id}/read`,
      {
        bearerToken: token,
        method: 'POST',
        expectedStatus: 200,
      }
    );
    assert.strictEqual(markedRead.json?.success, true);

    await processOutbox();

    await waitFor(
      async () => {
        const result = await findAdminNotification(
          token,
          (item) => item.id === createdNotification.id,
          { unreadOnly: true }
        );
        assert.ok(!result.match, 'notification still appears in unread list after read');
        return true;
      },
      {
        timeoutMs: 15000,
        intervalMs: 500,
        onTimeoutMessage: 'admin notification was not removed from unread list after read',
      }
    );

    const finalList = await waitFor(
      async () => {
        const result = await findAdminNotification(
          token,
          (item) => item.id === createdNotification.id
        );
        assert.ok(result.match, 'notification missing from full list after read');
        assert.strictEqual(Number(result.match.is_read), 1);
        return result;
      },
      {
        timeoutMs: 20000,
        intervalMs: 500,
        onTimeoutMessage: 'admin notification did not reappear as read in full list',
      }
    );
    assert.strictEqual(finalList.match.title, title);
    assert.strictEqual(finalList.match.content, content);
  });

  // loopback 模式下级联重启导致恢复超时，跳过此测试
  itSkipInLoopback(
    'materializes procurement notifications from business events and supports clearing unread state afterwards',
    async () => {
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

      await processOutbox();

      const businessNotification = await waitFor(
        async () => {
          const result = await findAdminNotification(
            token,
            (item) =>
              String(item?.title || '').includes('notification.purchase_receipt_recorded') ||
              String(item?.title || '').includes('notification.order_procurement_progressed'),
            { unreadOnly: true }
          );
          assert.ok(result.match, 'business notification has not been materialized yet');
          assert.ok(
            result.unreadCount >= 1,
            'unread count did not increase for business notification'
          );
          return result.match;
        },
        {
          timeoutMs: 20000,
          intervalMs: 500,
          onTimeoutMessage: 'procurement notification did not appear in unread list',
        }
      );

      const clearUnread = await apiRequest('/api/manage/notifications/all/read', {
        bearerToken: token,
        method: 'POST',
        expectedStatus: 200,
      });
      assert.strictEqual(clearUnread.json?.success, true);

      await processOutbox();

      await waitFor(
        async () => {
          const unreadResult = await findAdminNotification(
            token,
            (item) => item.id === businessNotification.id,
            { unreadOnly: true, limit: 50, cacheBust: true }
          );
          assert.ok(
            !unreadResult.match,
            'business notification still appears in unread list after mark-all-read'
          );
          return unreadResult;
        },
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage:
            'target business notification was not cleared from unread list after mark-all-read',
        }
      );

      const finalList = await waitFor(
        async () => {
          const result = await findAdminNotification(
            token,
            (item) => item.id === businessNotification.id
          );
          assert.ok(result.match, 'business notification missing from full list');
          assert.strictEqual(Number(result.match.is_read), 1);
          return result;
        },
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'business notification did not remain in full list as read',
        }
      );

      assert.ok(
        String(finalList.match.title || '').includes('notification.purchase_receipt_recorded') ||
          String(finalList.match.title || '').includes('notification.order_procurement_progressed')
      );
    }
  );

  it('materializes sales notifications for admin-side order lifecycle events and supports sales read transitions', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('notify-sales-admin');
    const { salespersonId, accessToken, jwt } = await createAuthenticatedSalesSession(token, seed, {
      namePrefix: 'Notify Sales Admin',
      store: 'Notify Admin Store',
    });

    const clearSalesUnread = await salesApiRequest(
      accessToken,
      jwt,
      `/api/sales/${accessToken}/notifications/all/read`,
      {
        method: 'POST',
        body: {},
        expectedStatus: 200,
      }
    );
    assert.strictEqual(clearSalesUnread.json?.success, true);

    const createdOrder = await apiRequest('/api/manage/orders', {
      bearerToken: token,
      method: 'POST',
      body: {
        productName: `Sales Notification ${seed}`,
        salespersonId,
        quantity: 1,
        remark: 'admin notification regression',
      },
      expectedStatus: 201,
    });
    const orderId = createdOrder.json?.data?.id;
    assert.ok(orderId, 'order id missing for admin-side sales notification flow');

    await processOutbox();

    const createdNotification = await waitFor(
      async () => {
        const result = await findSalesNotification(
          accessToken,
          jwt,
          (item) =>
            item.metadata?.eventType === 'order_created_by_admin' &&
            item.metadata?.payload?.order_id === orderId,
          { unreadOnly: true, limit: 50 }
        );
        assert.ok(
          result.match,
          'order_created_by_admin sales notification has not been materialized yet'
        );
        return result.match;
      },
      {
        ...salesNotificationPoll,
        onTimeoutMessage: 'sales notification for admin-created order did not appear',
      }
    );

    const markedCreatedRead = await salesApiRequest(
      accessToken,
      jwt,
      `/api/sales/${accessToken}/notifications/${createdNotification.id}/read`,
      {
        method: 'POST',
        body: {},
        expectedStatus: 200,
      }
    );
    assert.strictEqual(markedCreatedRead.json?.success, true);

    await processOutbox();

    await waitFor(
      async () => {
        const unreadResult = await findSalesNotification(
          accessToken,
          jwt,
          (item) => item.id === createdNotification.id,
          { unreadOnly: true, limit: 50, cacheBust: true }
        );
        assert.ok(
          !unreadResult.match,
          'sales created notification still appears in unread list after read'
        );
        return unreadResult;
      },
      {
        ...salesNotificationPoll,
        onTimeoutMessage: 'sales created notification was not removed from unread list after read',
      }
    );

    await apiRequest(`/api/manage/orders/${orderId}`, {
      bearerToken: token,
      method: 'PATCH',
      body: {
        updates: { remark: `admin-updated-${seed}` },
        reason: 'sales notification admin update regression',
      },
      expectedStatus: 200,
    });

    await apiRequest(`/api/manage/orders/${orderId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: {
        status: 'confirmed',
        note: 'sales notification admin status regression',
      },
      expectedStatus: 200,
    });

    const adminComment = `admin comment ${seed}`;
    await apiRequest(`/api/manage/orders/${orderId}/comment`, {
      bearerToken: token,
      method: 'POST',
      body: {
        comment: adminComment,
      },
      expectedStatus: 200,
    });

    await processOutbox();

    const lifecycleNotifications = await waitFor(
      async () => {
        const result = await findSalesNotification(accessToken, jwt, () => true, {
          unreadOnly: true,
          limit: 100,
          cacheBust: true,
        });
        const updatedNotification = result.list.find(
          (item) =>
            item.metadata?.eventType === 'order_updated_by_admin' &&
            item.metadata?.payload?.order_id === orderId
        );
        const statusNotification = result.list.find(
          (item) =>
            item.metadata?.eventType === 'order_status_changed_by_admin' &&
            item.metadata?.payload?.order_id === orderId &&
            item.metadata?.payload?.status === 'confirmed'
        );
        const commentNotification = result.list.find(
          (item) =>
            item.metadata?.eventType === 'order_comment_created_by_admin' &&
            item.metadata?.payload?.order_id === orderId &&
            item.metadata?.payload?.comment === adminComment
        );

        assert.ok(
          updatedNotification,
          'order_updated_by_admin sales notification has not been materialized yet'
        );
        assert.ok(
          statusNotification,
          'order_status_changed_by_admin sales notification has not been materialized yet'
        );
        assert.ok(
          commentNotification,
          'order_comment_created_by_admin sales notification has not been materialized yet'
        );

        return {
          updatedNotification,
          statusNotification,
          commentNotification,
        };
      },
      {
        ...salesNotificationPoll,
        onTimeoutMessage: 'sales lifecycle notifications for admin-side updates did not all appear',
      }
    );

    const markAllRead = await salesApiRequest(
      accessToken,
      jwt,
      `/api/sales/${accessToken}/notifications/all/read`,
      {
        method: 'POST',
        body: {},
        expectedStatus: 200,
      }
    );
    assert.strictEqual(markAllRead.json?.success, true);

    await processOutbox();

    await waitFor(
      async () => {
        const unreadResult = await findSalesNotification(
          accessToken,
          jwt,
          (item) =>
            item.id === lifecycleNotifications.updatedNotification.id ||
            item.id === lifecycleNotifications.statusNotification.id ||
            item.id === lifecycleNotifications.commentNotification.id,
          { unreadOnly: true, limit: 50, cacheBust: true }
        );
        assert.ok(
          !unreadResult.match,
          'admin lifecycle sales notifications still appear in unread list after mark-all-read'
        );
        return unreadResult;
      },
      {
        ...salesNotificationPoll,
        onTimeoutMessage:
          'admin lifecycle sales notifications were not cleared from unread list after mark-all-read',
      }
    );
  });

  it('materializes admin notifications for sales-side order lifecycle events', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('notify-admin-sales');
    const { accessToken, jwt } = await createAuthenticatedSalesSession(token, seed, {
      namePrefix: 'Notify Admin Sales',
      store: 'Notify Sales Store',
    });

    const clearAdminUnread = await apiRequest('/api/manage/notifications/all/read', {
      bearerToken: token,
      method: 'POST',
      expectedStatus: 200,
    });
    assert.strictEqual(clearAdminUnread.json?.success, true);

    const createdOrder = await salesApiRequest(
      accessToken,
      jwt,
      `/api/sales/${accessToken}/orders`,
      {
        method: 'POST',
        body: {
          name: `Sales-side Order ${seed}`,
          size: 'L',
          color: 'Black',
          material: 'Cotton',
          remark: 'sales-side admin notification regression',
          fileIds: [],
          quantity: 1,
        },
        expectedStatus: 201,
      }
    );
    const orderId = createdOrder.json?.data?.id;
    assert.ok(orderId, 'sales-created order id missing for admin notification flow');

    await processOutbox();

    const createdNotification = await waitFor(
      async () => {
        const result = await findAdminNotification(
          token,
          (item) =>
            item.metadata?.eventType === 'order_created_by_sales' &&
            item.metadata?.payload?.order_id === orderId,
          { unreadOnly: true, limit: 50 }
        );
        assert.ok(
          result.match,
          'order_created_by_sales admin notification has not been materialized yet'
        );
        return result.match;
      },
      {
        ...adminNotificationPoll,
        onTimeoutMessage: 'admin notification for sales-created order did not appear',
      }
    );

    await salesApiRequest(accessToken, jwt, `/api/sales/${accessToken}/orders/${orderId}`, {
      method: 'PATCH',
      body: {
        updates: { remark: `sales-updated-${seed}` },
        reason: 'admin notification sales update regression',
      },
      expectedStatus: 200,
    });

    const salesComment = `sales comment ${seed}`;
    await salesApiRequest(accessToken, jwt, `/api/sales/${accessToken}/orders/${orderId}/comment`, {
      method: 'POST',
      body: {
        comment: salesComment,
      },
      expectedStatus: 200,
    });

    await salesApiRequest(accessToken, jwt, `/api/sales/${accessToken}/orders/${orderId}`, {
      method: 'DELETE',
      expectedStatus: 200,
    });

    await processOutbox();

    const lifecycleNotifications = await waitFor(
      async () => {
        const result = await findAdminNotification(token, () => true, {
          unreadOnly: true,
          limit: 100,
          cacheBust: true,
        });
        const updatedNotification = result.list.find(
          (item) =>
            item.metadata?.eventType === 'order_updated_by_sales' &&
            item.metadata?.payload?.order_id === orderId
        );
        const commentNotification = result.list.find(
          (item) =>
            item.metadata?.eventType === 'order_comment_created_by_sales' &&
            item.metadata?.payload?.order_id === orderId &&
            item.metadata?.payload?.comment === salesComment
        );
        const statusNotification = result.list.find(
          (item) =>
            item.metadata?.eventType === 'order_status_changed_by_sales' &&
            item.metadata?.payload?.order_id === orderId &&
            item.metadata?.payload?.status === 'void'
        );

        assert.ok(
          updatedNotification,
          'order_updated_by_sales admin notification has not been materialized yet'
        );
        assert.ok(
          commentNotification,
          'order_comment_created_by_sales admin notification has not been materialized yet'
        );
        assert.ok(
          statusNotification,
          'order_status_changed_by_sales admin notification has not been materialized yet'
        );

        return {
          updatedNotification,
          commentNotification,
          statusNotification,
        };
      },
      {
        ...adminNotificationPoll,
        onTimeoutMessage: 'admin notifications for sales-side lifecycle updates did not all appear',
      }
    );

    const clearAdminAfter = await apiRequest('/api/manage/notifications/all/read', {
      bearerToken: token,
      method: 'POST',
      expectedStatus: 200,
    });
    assert.strictEqual(clearAdminAfter.json?.success, true);

    await processOutbox();

    await waitFor(
      async () => {
        const unreadResult = await findAdminNotification(
          token,
          (item) =>
            item.id === createdNotification.id ||
            item.id === lifecycleNotifications.updatedNotification.id ||
            item.id === lifecycleNotifications.commentNotification.id ||
            item.id === lifecycleNotifications.statusNotification.id,
          { unreadOnly: true, limit: 50, cacheBust: true }
        );
        assert.ok(
          !unreadResult.match,
          'sales lifecycle admin notifications still appear in unread list after mark-all-read'
        );
        return unreadResult;
      },
      {
        ...adminNotificationPoll,
        onTimeoutMessage:
          'sales lifecycle admin notifications were not cleared from unread list after mark-all-read',
      }
    );
  });

  it('materializes deadline reminder notifications for both admin and sales through cron reminders', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('notify-reminder');
    const { salespersonId, accessToken, jwt } = await createAuthenticatedSalesSession(token, seed, {
      namePrefix: 'Notify Reminder Sales',
      store: 'Notify Reminder Store',
    });
    const deadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const clearAdminUnread = await apiRequest('/api/manage/notifications/all/read', {
      bearerToken: token,
      method: 'POST',
      expectedStatus: 200,
    });
    assert.strictEqual(clearAdminUnread.json?.success, true);

    const clearSalesUnread = await salesApiRequest(
      accessToken,
      jwt,
      `/api/sales/${accessToken}/notifications/all/read`,
      {
        method: 'POST',
        body: {},
        expectedStatus: 200,
      }
    );
    assert.strictEqual(clearSalesUnread.json?.success, true);

    const createdOrder = await apiRequest('/api/manage/orders', {
      bearerToken: token,
      method: 'POST',
      body: {
        productName: `Reminder Order ${seed}`,
        salespersonId,
        quantity: 1,
        status: 'confirmed',
        deadline,
        remark: 'deadline reminder regression',
      },
      expectedStatus: 201,
    });
    const orderId = createdOrder.json?.data?.id;
    assert.ok(orderId, 'order id missing for deadline reminder flow');

    const cronRun = await apiRequest('/api/cron/reminders', {
      method: 'POST',
      authHeader: 'Bearer dev-secret',
      expectedStatus: 200,
    });
    assert.strictEqual(cronRun.json?.success, true);

    const adminReminder = await waitFor(
      async () => {
        const result = await findAdminNotification(
          token,
          (item) =>
            item.metadata?.eventType === 'order_deadline_reminder_due' &&
            item.metadata?.payload?.order_id === orderId,
          { unreadOnly: true, limit: 50 }
        );
        assert.ok(
          result.match,
          'admin deadline reminder notification has not been materialized yet'
        );
        return result.match;
      },
      {
        timeoutMs: 20000,
        intervalMs: 500,
        onTimeoutMessage: 'admin deadline reminder notification did not appear',
      }
    );

    const salesReminder = await waitFor(
      async () => {
        const result = await findSalesNotification(
          accessToken,
          jwt,
          (item) =>
            item.metadata?.eventType === 'order_deadline_reminder_due' &&
            item.metadata?.payload?.order_id === orderId,
          { unreadOnly: true, limit: 50 }
        );
        assert.ok(
          result.match,
          'sales deadline reminder notification has not been materialized yet'
        );
        return result.match;
      },
      {
        ...salesNotificationPoll,
        onTimeoutMessage: 'sales deadline reminder notification did not appear',
      }
    );

    assert.ok(String(adminReminder.content || '').includes(deadline));
    assert.ok(String(salesReminder.content || '').includes(deadline));
  });

  // loopback 模式下级联重启导致恢复超时，跳过此测试
  itSkipInLoopback(
    'materializes reversal notifications from procurement rollback events and supports clearing unread state afterwards',
    async () => {
      const token = await getBearerToken();
      const seed = uniqueSeed('notify-reversal');
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
      assert.ok(poItemId, 'purchase order item missing for procurement reversal notification flow');

      const receipt = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
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
              note: 'notification reversal baseline receipt',
            },
          ],
        },
        expectedStatus: 201,
      });
      const receiptId = receipt.json?.data?.receipts?.[0]?.id;
      assert.ok(receiptId, 'receipt id missing for procurement reversal notification flow');

      const reversal = await apiRequest(
        `/api/manage/purchase-orders/${poId}/receipts/${receiptId}/reversal`,
        {
          bearerToken: token,
          method: 'POST',
          headers: {
            'Idempotency-Key': `${seed}-reversal`,
          },
          body: {
            reason: 'notification reversal regression',
          },
          expectedStatus: 201,
        }
      );
      const reversalId = reversal.json?.data?.reversal_id;
      assert.ok(reversalId, 'reversal id missing for procurement reversal notification flow');

      // 所有写操作完成后，一次性处理 outbox 事件
      await processOutbox({ maxRounds: 8 });

      const reversalNotifications = await waitFor(
        async () => {
          const result = await findAdminNotification(token, () => true, {
            unreadOnly: true,
            limit: 50,
          });
          const purchaseReceiptReversed = result.list.find(
            (item) =>
              item.metadata?.eventType === 'purchase_receipt_reversed' &&
              item.metadata?.payload?.purchase_order_id === poId &&
              item.metadata?.payload?.reversal_id === reversalId
          );
          const orderProcurementReversed = result.list.find(
            (item) =>
              item.metadata?.eventType === 'order_procurement_reversed' &&
              item.metadata?.payload?.purchase_order_id === poId &&
              item.metadata?.payload?.reversal_id === reversalId
          );

          assert.ok(
            purchaseReceiptReversed,
            'purchase_receipt_reversed notification has not been materialized yet'
          );
          assert.ok(
            orderProcurementReversed,
            'order_procurement_reversed notification has not been materialized yet'
          );
          assert.ok(
            result.unreadCount >= 2,
            'unread count did not increase for reversal notifications'
          );

          return {
            purchaseReceiptReversed,
            orderProcurementReversed,
          };
        },
        {
          timeoutMs: 20000,
          intervalMs: 500,
          onTimeoutMessage: 'reversal notifications did not appear in unread list',
        }
      );

      assert.ok(
        String(reversalNotifications.purchaseReceiptReversed.title || '').includes(
          'notification.purchase_receipt_reversed'
        )
      );
      assert.ok(
        String(reversalNotifications.purchaseReceiptReversed.content || '').includes(
          `"purchaseOrderId":"${poId}"`
        )
      );
      assert.ok(
        String(reversalNotifications.purchaseReceiptReversed.content || '').includes('"qty":2')
      );

      assert.ok(
        String(reversalNotifications.orderProcurementReversed.title || '').includes(
          'notification.order_procurement_reversed'
        )
      );
      assert.ok(
        String(reversalNotifications.orderProcurementReversed.content || '').includes(
          `"purchaseOrderId":"${poId}"`
        )
      );
      assert.ok(
        String(reversalNotifications.orderProcurementReversed.content || '').includes('"qty":2')
      );
      assert.ok(
        String(reversalNotifications.orderProcurementReversed.content || '').includes(
          '"status":"ordered"'
        )
      );

      const clearUnread = await apiRequest('/api/manage/notifications/all/read', {
        bearerToken: token,
        method: 'POST',
        expectedStatus: 200,
      });
      assert.strictEqual(clearUnread.json?.success, true);

      await waitFor(
        async () => {
          const unreadResult = await findAdminNotification(
            token,
            (item) =>
              item.id === reversalNotifications.purchaseReceiptReversed.id ||
              item.id === reversalNotifications.orderProcurementReversed.id,
            { unreadOnly: true, limit: 50, cacheBust: true }
          );
          assert.ok(
            !unreadResult.match,
            'reversal notifications still appear in unread list after mark-all-read'
          );
          return unreadResult;
        },
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage:
            'target reversal notifications were not cleared from unread list after mark-all-read',
        }
      );

      const finalList = await waitFor(
        async () => {
          const result = await apiRequest('/api/manage/notifications?limit=50', {
            bearerToken: token,
            expectedStatus: 200,
          });
          const list = result.json?.data?.list || [];
          const purchaseReceiptReversed = list.find(
            (item) => item.id === reversalNotifications.purchaseReceiptReversed.id
          );
          const orderProcurementReversed = list.find(
            (item) => item.id === reversalNotifications.orderProcurementReversed.id
          );

          assert.ok(
            purchaseReceiptReversed,
            'purchase_receipt_reversed notification missing from full list after read'
          );
          assert.ok(
            orderProcurementReversed,
            'order_procurement_reversed notification missing from full list after read'
          );
          assert.strictEqual(Number(purchaseReceiptReversed.is_read), 1);
          assert.strictEqual(Number(orderProcurementReversed.is_read), 1);
          return {
            purchaseReceiptReversed,
            orderProcurementReversed,
          };
        },
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'reversal notifications did not remain in full list as read',
        }
      );

      assert.ok(
        String(finalList.purchaseReceiptReversed.title || '').includes(
          'notification.purchase_receipt_reversed'
        )
      );
      assert.ok(
        String(finalList.orderProcurementReversed.title || '').includes(
          'notification.order_procurement_reversed'
        )
      );
    }
  );

  // loopback 模式下级联重启导致恢复超时，跳过此测试
  itSkipInLoopback(
    'materializes sales notifications for delivery confirmation and one-step return creation',
    async () => {
      const token = await getBearerToken();
      const seed = uniqueSeed('notify-delivery-return');
      const { salespersonId, accessToken, jwt } = await createAuthenticatedSalesSession(
        token,
        seed,
        {
          namePrefix: 'Notify Delivery Return',
          store: 'Notify Delivery Return Store',
        }
      );

      const clearSalesUnread = await salesApiRequest(
        accessToken,
        jwt,
        `/api/sales/${accessToken}/notifications/all/read`,
        {
          method: 'POST',
          body: {},
          expectedStatus: 200,
        }
      );
      assert.strictEqual(clearSalesUnread.json?.success, true);

      const { productId, variantId, productName } = await createWorkflowProduct(token, seed, {
        stockQuantity: 0,
      });
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
      assert.ok(poItemId, 'purchase order item missing for delivery/return notification flow');

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
              note: 'delivery return notification flow receipt',
            },
          ],
        },
        expectedStatus: 201,
      });

      // receipt 后需要等 order 行收到 quantity，这依赖 outbox consumer 刷新 read model
      await processOutbox({ maxRounds: 4 });

      const orderAfterReceipt = await waitFor(
        async () => {
          const order = await getOrderDetail(token, orderId);
          const line = order?.lines?.[0];
          assert.ok(line?.id, 'order line missing for delivery/return notification flow');
          assert.strictEqual(line?.receivedQuantity, 2);
          return { order, line };
        },
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage:
            'delivery/return notification order detail did not converge after receipt',
        }
      );

      await apiRequest(`/api/manage/orders/${orderId}/lines/${orderAfterReceipt.line.id}/ship`, {
        bearerToken: token,
        method: 'POST',
        body: { quantity: 2 },
        expectedStatus: 200,
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
        body: { note: 'delivery notification regression flow' },
        expectedStatus: 200,
      });

      await apiRequest(`/api/manage/orders/${orderId}/lines/${orderAfterReceipt.line.id}/return`, {
        bearerToken: token,
        method: 'POST',
        body: { quantity: 1, reason: 'damage', note: 'return notification regression flow' },
        expectedStatus: 200,
      });

      // 所有写操作完成后，一次性处理 outbox 事件
      await processOutbox({ maxRounds: 8 });

      await waitFor(
        async () => {
          const result = await findSalesNotification(accessToken, jwt, () => true, {
            unreadOnly: true,
            limit: 100,
            cacheBust: true,
          });
          const deliveryNotification = result.list.find(
            (item) =>
              item.metadata?.eventType === 'order_delivery_confirmed' &&
              item.metadata?.payload?.order_id === orderId
          );
          const returnNotification = result.list.find(
            (item) =>
              item.metadata?.eventType === 'order_return_created' &&
              item.metadata?.payload?.order_id === orderId
          );
          const duplicateReturnNotifications = result.list.filter(
            (item) =>
              (item.metadata?.eventType === 'order_return_created' ||
                item.metadata?.eventType === 'order_return_restocked') &&
              item.metadata?.payload?.order_id === orderId
          );

          assert.ok(
            deliveryNotification,
            'order_delivery_confirmed sales notification has not been materialized yet'
          );
          assert.ok(
            returnNotification,
            'order_return_created sales notification has not been materialized yet'
          );
          assert.strictEqual(
            duplicateReturnNotifications.length,
            1,
            'one-step return flow should materialize exactly one sales-visible return notification'
          );
          return { deliveryNotification, returnNotification };
        },
        {
          ...salesNotificationPoll,
          onTimeoutMessage: 'delivery/return sales notifications did not appear',
        }
      );
    }
  );
});

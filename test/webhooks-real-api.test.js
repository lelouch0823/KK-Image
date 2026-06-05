import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  uniqueSeed,
  apiRequest,
  multipartRequest,
  waitFor,
  processOutbox,
  itSkipInLoopback,
} from './utils/manage-products-real-api.js';
import {
  runWebhookSmokeFlow,
  createManageWebhook,
  deleteManageWebhook,
  startWebhookReceiver,
  cleanupTestManageWebhooks,
} from './utils/webhook-real-api.js';
import { runWebhookTests } from './webhook-test.js';
import {
  ensureSalespersonId,
  createWorkflowProduct,
  createConfirmedOrder,
  createPurchaseOrderFromOrders,
  transitionPurchaseOrderToShipping,
  getOrderDetail,
  getPurchaseOrderDetail,
} from './utils/order-procurement-real-api.js';

describeIfRealApi('Webhook Real API', function () {
  this.timeout(360000);

  it('creates a webhook, triggers test delivery, and observes webhook.test locally', async () => {
    const token = await getBearerToken();
    const result = await runWebhookSmokeFlow({
      token,
      seed: uniqueSeed('webhook-vitest'),
      port: 3001,
    });

    assert.ok(result.webhook?.id, 'webhook id missing');
    assert.strictEqual(result.testResult?.status, 200);
    assert.strictEqual(
      result.delivered?.body?.event_type || result.delivered?.body?.event,
      'webhook.test'
    );
  });

  it('keeps the legacy CLI wrapper working by reusing the shared helper', async () => {
    const token = await getBearerToken();
    const result = await runWebhookTests({
      token,
      seed: uniqueSeed('webhook-cli'),
      port: 3002,
    });

    assert.ok(result.received.length > 0, 'legacy wrapper did not receive any webhook');
    assert.strictEqual(
      result.received[0]?.body?.event_type || result.received[0]?.body?.event,
      'webhook.test'
    );
  });

  // loopback 模式下级联重启导致恢复超时，跳过此测试
  itSkipInLoopback('delivers supported procurement events with configured headers/signatures', async () => {
    const token = await getBearerToken();
    await cleanupTestManageWebhooks(token);
    const seed = uniqueSeed('webhook-business');
    const salespersonId = await ensureSalespersonId(token, seed);
    const { productId, variantId, productName } = await createWorkflowProduct(token, seed, {
      stockQuantity: 0,
    });
    const receiver = await startWebhookReceiver({ port: 3004 });
    let webhookId = null;

    try {
      const webhook = await createManageWebhook(token, {
        url: receiver.url,
        events: ['purchase_receipt_recorded'],
        secret: `whsec-${seed}`,
        headers: {
          'X-Line-Seed': seed,
        },
      });
      webhookId = webhook?.id;
      assert.ok(webhookId, 'business webhook id missing');

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
      assert.ok(poItemId, 'purchase order item missing for webhook business flow');

      receiver.reset();

      await createReceiptAndShipLine({
        token,
        poId,
        poItemId,
        orderId,
        seed,
      });

      await processOutbox();

      const delivered = await receiver.waitForDelivery(
        (item) => item.body?.event_type === 'purchase_receipt_recorded',
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'purchase_receipt_recorded webhook did not arrive',
        }
      );

      assert.strictEqual(delivered.headers['x-line-seed'], seed);
      assert.ok(delivered.headers['x-webhook-signature'], 'webhook signature missing');
      assert.strictEqual(delivered.body?.event_type, 'purchase_receipt_recorded');
    } finally {
      if (webhookId) {
        try {
          await deleteManageWebhook(token, webhookId);
        } catch {
          // best-effort cleanup
        }
      }
      await receiver.close();
    }
  });

  it('exposes only webhook-capable supported events and delivers file_uploaded events through the same outbox pipeline', async () => {
    const token = await getBearerToken();
    await cleanupTestManageWebhooks(token);
    const seed = uniqueSeed('webhook-file');
    const receiver = await startWebhookReceiver({ port: 3005 });
    let webhookId = null;

    try {
      const listBefore = await apiRequest('/api/manage/webhooks', {
        bearerToken: token,
        expectedStatus: 200,
      });
      const supportedEvents = listBefore.json?.supportedEvents || [];
      assert.ok(supportedEvents.includes('file_uploaded'), 'file_uploaded should be advertised as webhook-capable');
      assert.ok(supportedEvents.includes('purchase_receipt_recorded'), 'purchase_receipt_recorded missing from supported events');
      assert.ok(!supportedEvents.includes('product_archived'), 'cache-only product_archived should not be advertised');
      assert.ok(!supportedEvents.includes('order_line_fulfillment_updated'), 'cache-only line event should not be advertised');

      const rejected = await apiRequest('/api/manage/webhooks', {
        bearerToken: token,
        method: 'POST',
        body: {
          url: receiver.url,
          events: ['product_archived'],
          secret: `whsec-invalid-${seed}`,
        },
        expectedStatus: 400,
      });
      assert.match(String(rejected.json?.error || ''), /invalid webhook events: product_archived/i);

      const webhook = await createManageWebhook(token, {
        url: receiver.url,
        events: ['file_uploaded'],
        secret: `whsec-file-${seed}`,
        headers: {
          'X-Test-Seed': seed,
        },
      });
      webhookId = webhook?.id;
      assert.ok(webhookId, 'file upload webhook id missing');

      const folder = await apiRequest('/api/manage/folders', {
        bearerToken: token,
        method: 'POST',
        body: {
          name: `Webhook File ${seed}`,
          description: 'file upload webhook regression',
        },
        expectedStatus: 201,
      });
      const folderId = folder.json?.data?.id;
      assert.ok(folderId, 'folder id missing for file upload webhook flow');

      const uploaded = await multipartRequest(`/api/manage/folders/${folderId}/upload`, {
        bearerToken: token,
        fields: {
          file: {
            value: 'webhook-file-payload',
            filename: `webhook-file-${seed}.txt`,
            contentType: 'text/plain',
          },
        },
        expectedStatus: 200,
      });
      const uploadedFileId = uploaded.json?.data?.id;
      assert.ok(uploadedFileId, 'uploaded file id missing for webhook file flow');

      await processOutbox();

      const delivered = await receiver.waitForDelivery(
        (item) =>
          item.body?.event_type === 'file_uploaded'
          && item.body?.aggregate?.id === uploadedFileId,
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'file_uploaded webhook did not arrive',
        }
      );

      assert.strictEqual(delivered.headers['x-test-seed'], seed);
      assert.ok(delivered.headers['x-webhook-signature'], 'file_uploaded webhook signature missing');
      assert.strictEqual(delivered.body?.event_type, 'file_uploaded');
      assert.strictEqual(delivered.body?.aggregate?.type, 'file');
      assert.strictEqual(delivered.body?.aggregate?.id, uploadedFileId);
      assert.strictEqual(delivered.body?.payload?.file?.id, uploadedFileId);
      assert.strictEqual(delivered.body?.payload?.file?.filename, `webhook-file-${seed}.txt`);
    } finally {
      if (webhookId) {
        try {
          await deleteManageWebhook(token, webhookId);
        } catch {
          // best-effort cleanup
        }
      }
      await receiver.close();
    }
  });

  // loopback 模式下级联重启导致恢复超时，跳过此测试
  itSkipInLoopback('retries a failed webhook delivery through the outbox poller and eventually publishes the job', async () => {
    const token = await getBearerToken();
    await cleanupTestManageWebhooks(token);
    const seed = uniqueSeed('webhook-retry');
    const salespersonId = await ensureSalespersonId(token, seed);
    const { productId, variantId, productName } = await createWorkflowProduct(token, seed, {
      stockQuantity: 0,
    });
    let targetPurchaseOrderId = null;
    let targetAttemptCount = 0;
    const receiver = await startWebhookReceiver({
      port: 3006,
      responseResolver: ({ body }) => {
        const isTargetEvent = body?.event_type === 'purchase_receipt_recorded'
          && targetPurchaseOrderId
          && body?.payload?.purchase_order_id === targetPurchaseOrderId;
        if (!isTargetEvent) return 200;
        targetAttemptCount += 1;
        return targetAttemptCount === 1 ? 500 : 200;
      },
    });
    let webhookId = null;

    try {
      const webhook = await createManageWebhook(token, {
        url: receiver.url,
        events: ['purchase_receipt_recorded'],
        secret: `whsec-retry-${seed}`,
        headers: {
          'X-Retry-Seed': seed,
        },
      });
      webhookId = webhook?.id;
      assert.ok(webhookId, 'retry webhook id missing');

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
      targetPurchaseOrderId = poId;

      const poDetail = await getPurchaseOrderDetail(token, poId);
      const poItemId = poDetail?.items?.[0]?.id;
      assert.ok(poItemId, 'purchase order item missing for webhook retry flow');

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
              note: 'webhook retry receipt',
            },
          ],
        },
        expectedStatus: 201,
      });

      await processOutbox();

      const firstDelivery = await receiver.waitForDelivery(
        (item) =>
          item.body?.event_type === 'purchase_receipt_recorded'
          && item.body?.payload?.purchase_order_id === poId,
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'initial retryable webhook attempt did not arrive',
        }
      );

      const deliveryKey = firstDelivery?.headers?.['x-webhook-delivery-key'] || '';
      const outboxEventId = String(deliveryKey).split(':')[0];
      assert.ok(outboxEventId, 'delivery key did not expose outbox event id');

      await waitFor(async () => {
        const detail = await apiRequest(`/api/manage/outbox/${outboxEventId}`, {
          bearerToken: token,
          expectedStatus: 200,
        });
        const webhookJob = (detail.json?.data?.consumerJobs || []).find((job) => job.consumer_name === 'webhook');
        const attempts = detail.json?.data?.webhookAttempts || [];
        assert.strictEqual(webhookJob?.status, 'failed');
        assert.ok(attempts.some((attempt) => attempt.classification === 'retryable'));
        return detail.json?.data;
      }, {
        timeoutMs: 15000,
        intervalMs: 500,
        onTimeoutMessage: 'webhook outbox job was not marked failed after first 500 delivery',
      });

      const finalDetail = await waitFor(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5200));
        const cronRun = await apiRequest('/api/cron/outbox', {
          method: 'POST',
          authHeader: 'Bearer dev-secret',
          expectedStatus: 200,
        });
        assert.strictEqual(cronRun.json?.success, true);

        const detail = await apiRequest(`/api/manage/outbox/${outboxEventId}`, {
          bearerToken: token,
          expectedStatus: 200,
        });
        const webhookJob = (detail.json?.data?.consumerJobs || []).find((job) => job.consumer_name === 'webhook');
        const attempts = detail.json?.data?.webhookAttempts || [];
        assert.strictEqual(webhookJob?.status, 'published');
        assert.ok(attempts.some((attempt) => attempt.classification === 'retryable'));
        assert.ok(attempts.some((attempt) => attempt.classification === 'delivered'));
        return detail.json?.data;
      }, {
        timeoutMs: 40000,
        intervalMs: 1000,
        onTimeoutMessage: 'webhook outbox job did not recover to published after retry',
      });

      const matchingDeliveries = receiver.received.filter((item) => {
        const itemDeliveryKey = String(item.headers?.['x-webhook-delivery-key'] || '');
        return item.body?.event_type === 'purchase_receipt_recorded'
          && item.body?.payload?.purchase_order_id === poId
          && itemDeliveryKey.startsWith(`${outboxEventId}:`);
      });
      assert.ok(matchingDeliveries.length >= 2, 'target event did not reach receiver on retry');
      assert.ok(targetAttemptCount >= 2, 'target retry injection did not observe at least two deliveries');
      assert.strictEqual(matchingDeliveries[0]?.responseStatus, 500);
      assert.strictEqual(matchingDeliveries.at(-1)?.responseStatus, 200);
      assert.ok(finalDetail.webhookAttempts.length >= 2);
    } finally {
      if (webhookId) {
        try {
          await deleteManageWebhook(token, webhookId);
        } catch {
          // best-effort cleanup
        }
      }
      await receiver.close();
    }
  });

  // loopback 模式下级联重启导致恢复超时，跳过此测试
  itSkipInLoopback('records terminal 4xx webhook failures without leaving the outbox job retryable', async () => {
    const token = await getBearerToken();
    await cleanupTestManageWebhooks(token);
    const seed = uniqueSeed('webhook-terminal');
    const salespersonId = await ensureSalespersonId(token, seed);
    const { productId, variantId, productName } = await createWorkflowProduct(token, seed, {
      stockQuantity: 0,
    });
    let targetPurchaseOrderId = null;
    const receiver = await startWebhookReceiver({
      port: 3007,
      responseResolver: ({ body }) => {
        const isTargetEvent = body?.event_type === 'purchase_receipt_recorded'
          && targetPurchaseOrderId
          && body?.payload?.purchase_order_id === targetPurchaseOrderId;
        return isTargetEvent ? 410 : 200;
      },
    });
    let webhookId = null;

    try {
      const webhook = await createManageWebhook(token, {
        url: receiver.url,
        events: ['purchase_receipt_recorded'],
        secret: `whsec-terminal-${seed}`,
        headers: {
          'X-Terminal-Seed': seed,
        },
      });
      webhookId = webhook?.id;
      assert.ok(webhookId, 'terminal webhook id missing');

      const orderId = await createConfirmedOrder(token, {
        seed,
        salespersonId,
        productId,
        variantId,
        productName,
        quantity: 1,
      });
      const poId = await createPurchaseOrderFromOrders(token, [orderId], seed);

      await transitionPurchaseOrderToShipping(token, poId);
      targetPurchaseOrderId = poId;

      const poDetail = await getPurchaseOrderDetail(token, poId);
      const poItemId = poDetail?.items?.[0]?.id;
      assert.ok(poItemId, 'purchase order item missing for terminal webhook flow');

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
              received_qty: 1,
              note: 'webhook terminal receipt',
            },
          ],
        },
        expectedStatus: 201,
      });

      await processOutbox();

      const firstDelivery = await receiver.waitForDelivery(
        (item) =>
          item.body?.event_type === 'purchase_receipt_recorded'
          && item.body?.payload?.purchase_order_id === poId,
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'terminal webhook attempt did not arrive',
        }
      );

      const deliveryKey = String(firstDelivery?.headers?.['x-webhook-delivery-key'] || '');
      const outboxEventId = deliveryKey.split(':')[0];
      assert.ok(outboxEventId, 'terminal delivery key did not expose outbox event id');
      assert.strictEqual(firstDelivery.responseStatus, 410);

      const finalDetail = await waitFor(async () => {
        const detail = await apiRequest(`/api/manage/outbox/${outboxEventId}`, {
          bearerToken: token,
          expectedStatus: 200,
        });
        const webhookJob = (detail.json?.data?.consumerJobs || []).find((job) => job.consumer_name === 'webhook');
        const matchingAttempt = (detail.json?.data?.webhookAttempts || []).find(
          (attempt) => attempt.delivery_key === deliveryKey
        );
        assert.strictEqual(webhookJob?.status, 'published');
        assert.strictEqual(matchingAttempt?.classification, 'terminal');
        assert.strictEqual(Number(matchingAttempt?.status_code || 0), 410);
        return detail.json?.data;
      }, {
        timeoutMs: 15000,
        intervalMs: 500,
        onTimeoutMessage: 'terminal webhook failure did not settle as published',
      });

      await new Promise((resolve) => setTimeout(resolve, 5200));
      const cronRun = await apiRequest('/api/cron/outbox', {
        method: 'POST',
        authHeader: 'Bearer dev-secret',
        expectedStatus: 200,
      });
      assert.strictEqual(cronRun.json?.success, true);
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const matchingDeliveries = receiver.received.filter((item) => {
        const itemDeliveryKey = String(item.headers?.['x-webhook-delivery-key'] || '');
        return item.body?.event_type === 'purchase_receipt_recorded'
          && item.body?.payload?.purchase_order_id === poId
          && itemDeliveryKey === deliveryKey;
      });
      assert.strictEqual(matchingDeliveries.length, 1, 'terminal webhook should not be retried');
      assert.ok(finalDetail.webhookAttempts.some((attempt) => attempt.delivery_key === deliveryKey));
    } finally {
      if (webhookId) {
        try {
          await deleteManageWebhook(token, webhookId);
        } catch {
          // best-effort cleanup
        }
      }
      await receiver.close();
    }
  });

  // loopback 模式下级联重启导致恢复超时，跳过此测试
  itSkipInLoopback('delivers reversal events through webhook subscriptions and persists published outbox detail for each delivery', async () => {
    const token = await getBearerToken();
    await cleanupTestManageWebhooks(token);
    const seed = uniqueSeed('webhook-reversal');
    const salespersonId = await ensureSalespersonId(token, seed);
    const { productId, variantId, productName } = await createWorkflowProduct(token, seed, {
      stockQuantity: 0,
    });
    const receiver = await startWebhookReceiver({ port: 3008 });
    let webhookId = null;

    try {
      const listBefore = await apiRequest('/api/manage/webhooks', {
        bearerToken: token,
        expectedStatus: 200,
      });
      const supportedEvents = listBefore.json?.supportedEvents || [];
      assert.ok(supportedEvents.includes('purchase_receipt_reversed'), 'purchase_receipt_reversed missing from supported events');
      assert.ok(supportedEvents.includes('inventory_receipt_reversed'), 'inventory_receipt_reversed missing from supported events');
      assert.ok(supportedEvents.includes('order_procurement_reversed'), 'order_procurement_reversed missing from supported events');

      const webhook = await createManageWebhook(token, {
        url: receiver.url,
        events: [
          'purchase_receipt_reversed',
          'inventory_receipt_reversed',
          'order_procurement_reversed',
        ],
        secret: `whsec-reversal-${seed}`,
        headers: {
          'X-Reversal-Seed': seed,
        },
      });
      webhookId = webhook?.id;
      assert.ok(webhookId, 'reversal webhook id missing');

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
      assert.ok(poItemId, 'purchase order item missing for reversal webhook flow');

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
              note: 'webhook reversal baseline receipt',
            },
          ],
        },
        expectedStatus: 201,
      });
      const receiptId = receipt.json?.data?.receipts?.[0]?.id;
      assert.ok(receiptId, 'receipt id missing for reversal webhook flow');

      const reversal = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts/${receiptId}/reversal`, {
        bearerToken: token,
        method: 'POST',
        headers: {
          'Idempotency-Key': `${seed}-reversal`,
        },
        body: {
          reason: 'webhook reversal regression',
        },
        expectedStatus: 201,
      });
      const reversalId = reversal.json?.data?.reversal_id;
      assert.ok(reversalId, 'reversal id missing for webhook reversal flow');

      await processOutbox({ maxRounds: 8 });

      const purchaseReceiptReversed = await receiver.waitForDelivery(
        (item) =>
          item.body?.event_type === 'purchase_receipt_reversed'
          && item.body?.payload?.purchase_order_id === poId
          && item.body?.payload?.original_receipt_id === receiptId
          && item.body?.payload?.reversal_id === reversalId,
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'purchase_receipt_reversed webhook did not arrive',
        }
      );
      const inventoryReceiptReversed = await receiver.waitForDelivery(
        (item) =>
          item.body?.event_type === 'inventory_receipt_reversed'
          && item.body?.payload?.original_receipt_id === receiptId
          && item.body?.payload?.reversal_id === reversalId,
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'inventory_receipt_reversed webhook did not arrive',
        }
      );
      const orderProcurementReversed = await receiver.waitForDelivery(
        (item) =>
          item.body?.event_type === 'order_procurement_reversed'
          && item.body?.payload?.purchase_order_id === poId
          && item.body?.payload?.original_receipt_id === receiptId
          && item.body?.payload?.reversal_id === reversalId,
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'order_procurement_reversed webhook did not arrive',
        }
      );

      for (const delivered of [
        purchaseReceiptReversed,
        inventoryReceiptReversed,
        orderProcurementReversed,
      ]) {
        assert.strictEqual(delivered.headers['x-reversal-seed'], seed);
        assert.ok(delivered.headers['x-webhook-signature'], `${delivered.body?.event_type} webhook signature missing`);
      }

      assert.strictEqual(purchaseReceiptReversed.body?.payload?.reversal_qty, 2);
      assert.strictEqual(inventoryReceiptReversed.body?.payload?.quantity_delta, -2);
      assert.strictEqual(orderProcurementReversed.body?.payload?.reversal_qty, 2);
      assert.strictEqual(orderProcurementReversed.body?.payload?.order_procurement_status_after, 'ordered');

      const publishedDetails = await Promise.all([
        waitForPublishedWebhookOutboxEvent(token, purchaseReceiptReversed, 'purchase_receipt_reversed'),
        waitForPublishedWebhookOutboxEvent(token, inventoryReceiptReversed, 'inventory_receipt_reversed'),
        waitForPublishedWebhookOutboxEvent(token, orderProcurementReversed, 'order_procurement_reversed'),
      ]);
      assert.strictEqual(new Set(publishedDetails.map((item) => item.id)).size, 3);
    } finally {
      if (webhookId) {
        try {
          await deleteManageWebhook(token, webhookId);
        } catch {
          // best-effort cleanup
        }
      }
      await receiver.close();
    }
  });
});

async function createReceiptAndShipLine({ token, poId, poItemId, orderId, seed }) {
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
          note: 'webhook business receipt',
        },
      ],
    },
    expectedStatus: 201,
  });

  const order = await waitFor(async () => {
    const detail = await getOrderDetail(token, orderId);
    const line = detail?.lines?.[0];
    assert.ok(line?.id, 'order line missing for webhook business flow');
    assert.strictEqual(line?.receivedQuantity, 2);
    return detail;
  }, {
    timeoutMs: 15000,
    intervalMs: 500,
    onTimeoutMessage: 'webhook business receipt did not converge',
  });

  await apiRequest(`/api/manage/orders/${orderId}/lines/${order.lines[0].id}/ship`, {
    bearerToken: token,
    method: 'POST',
    body: { quantity: 1 },
    expectedStatus: 200,
  });
}

async function waitForPublishedWebhookOutboxEvent(token, delivery, expectedEventType) {
  const deliveryKey = String(delivery?.headers?.['x-webhook-delivery-key'] || '');
  const outboxEventId = deliveryKey.split(':')[0];
  assert.ok(outboxEventId, `${expectedEventType} delivery key did not expose outbox event id`);

  return waitFor(async () => {
    const detail = await apiRequest(`/api/manage/outbox/${outboxEventId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const data = detail.json?.data;
    const webhookJob = (data?.consumerJobs || []).find((job) => job.consumer_name === 'webhook');
    const webhookAttempt = (data?.webhookAttempts || []).find(
      (attempt) => attempt.delivery_key === deliveryKey
    );

    assert.strictEqual(data?.event_type, expectedEventType);
    assert.strictEqual(webhookJob?.status, 'published');
    assert.strictEqual(webhookAttempt?.classification, 'delivered');
    return data;
  }, {
    timeoutMs: 15000,
    intervalMs: 500,
    onTimeoutMessage: `${expectedEventType} outbox detail did not settle as published`,
  });
}

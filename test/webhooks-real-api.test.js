import assert from 'assert';
import { describeIfRealApi, getBearerToken, uniqueSeed, apiRequest, waitFor } from './utils/manage-products-real-api.js';
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
  this.timeout(120000);

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

  it('delivers supported procurement events with configured headers/signatures and ignores cache-only line events', async () => {
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
        events: ['purchase_receipt_recorded', 'order_line_fulfillment_updated'],
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

      await new Promise((resolve) => setTimeout(resolve, 1500));
      assert.ok(
        !receiver.received.some((item) => item.body?.event_type === 'order_line_fulfillment_updated'),
        'cache-only line fulfillment event should not be delivered to webhook subscribers'
      );
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

  it('retries a failed webhook delivery through the outbox poller and eventually publishes the job', async () => {
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

  it('records terminal 4xx webhook failures without leaving the outbox job retryable', async () => {
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

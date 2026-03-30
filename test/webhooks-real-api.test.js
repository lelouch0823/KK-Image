import assert from 'assert';
import { describeIfRealApi, getBearerToken, uniqueSeed, apiRequest, waitFor } from './utils/manage-products-real-api.js';
import { runWebhookSmokeFlow, createManageWebhook, deleteManageWebhook, startWebhookReceiver } from './utils/webhook-real-api.js';
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

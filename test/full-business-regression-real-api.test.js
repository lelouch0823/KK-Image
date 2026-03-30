import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  multipartRequest,
  uniqueSeed,
  waitFor,
} from './utils/manage-products-real-api.js';
import {
  createManageWebhook,
  deleteManageWebhook,
  startWebhookReceiver,
} from './utils/webhook-real-api.js';

async function ensureSalespersonId(token, seed) {
  const listed = await apiRequest('/api/manage/salespersons?page=1&limit=1', {
    bearerToken: token,
    expectedStatus: 200,
  });
  const existing = listed.json?.data?.salespersons?.[0];
  if (existing?.id) return existing.id;

  const created = await apiRequest('/api/manage/salespersons', {
    bearerToken: token,
    method: 'POST',
    body: {
      name: `Full Chain Sales ${seed}`,
      store: 'Full Chain Store',
      phone: `13${String(Date.now()).slice(-9)}`,
      password: '123456',
    },
    expectedStatus: 201,
  });
  return created.json?.data?.id;
}

async function findAdminNotification(token, predicate) {
  const result = await apiRequest('/api/manage/notifications?limit=20', {
    bearerToken: token,
    expectedStatus: 200,
  });
  const list = result.json?.data?.list || [];
  return list.find(predicate) || null;
}

describeIfRealApi('Full Business Regression Real API', function () {
  this.timeout(240000);

  it('runs file -> product -> order -> procurement -> notification in one workflow', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('full-chain');
    const salespersonId = await ensureSalespersonId(token, seed);
    const webhookReceiver = await startWebhookReceiver({ port: 3003 });
    let webhookId = null;

    try {
      const webhook = await createManageWebhook(token, {
        url: webhookReceiver.url,
        events: [
          'purchase_receipt_recorded',
          'order_procurement_progressed',
          'order_line_fulfillment_updated',
        ],
        headers: {
          'X-Full-Chain-Seed': seed,
        },
      });
      webhookId = webhook?.id;
      assert.ok(webhookId, 'full-chain webhook id missing');

      const sourceFolder = await apiRequest('/api/manage/folders', {
        bearerToken: token,
        method: 'POST',
        body: {
          name: `Full Chain Source ${seed}`,
          description: 'source folder for uploads',
        },
        expectedStatus: 201,
      });
      const sourceFolderId = sourceFolder.json?.data?.id;
      assert.ok(sourceFolderId, 'source folder id missing');

      const targetFolder = await apiRequest('/api/manage/folders', {
        bearerToken: token,
        method: 'POST',
        body: {
          name: `Full Chain Target ${seed}`,
          description: 'target folder for file moves',
        },
        expectedStatus: 201,
      });
      const targetFolderId = targetFolder.json?.data?.id;
      assert.ok(targetFolderId, 'target folder id missing');

      const uploaded = await multipartRequest(`/api/manage/folders/${sourceFolderId}/upload`, {
        bearerToken: token,
        fields: {
          file: {
            value: 'fake-image-data',
            filename: `full-chain-${seed}.jpg`,
            contentType: 'image/jpeg',
          },
        },
        expectedStatus: 200,
      });
      const uploadedFileId = uploaded.json?.data?.id;
      assert.ok(uploadedFileId, 'uploaded file id missing');

      const createdFile = await apiRequest('/api/v1/files', {
        bearerToken: token,
        method: 'POST',
        body: {
          name: `Full Chain File ${seed}.txt`,
          folderId: null,
        },
        expectedStatus: 201,
      });
      const standaloneFileId = createdFile.json?.data?.id;
      assert.ok(standaloneFileId, 'standalone file id missing');

      await apiRequest('/api/v1/files/batch/move', {
        bearerToken: token,
        method: 'POST',
        body: {
          ids: [standaloneFileId],
          targetFolderId,
        },
        expectedStatus: 200,
      });

      await waitFor(
        async () => {
          const movedFiles = await apiRequest(`/api/manage/folders/${targetFolderId}`, {
            bearerToken: token,
            expectedStatus: 200,
          });
          assert.ok(
            (movedFiles.json?.data?.files || []).some((item) => item.id === standaloneFileId),
            'moved file missing from target folder'
          );
          return movedFiles.json?.data?.files;
        },
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'moved file did not appear in target folder listing',
        }
      );

      await apiRequest('/api/v1/files/batch/delete', {
        bearerToken: token,
        method: 'POST',
        body: {
          ids: [standaloneFileId],
        },
        expectedStatus: 200,
      });

      await waitFor(
        async () => {
          const listAfterDelete = await apiRequest(`/api/manage/folders/${targetFolderId}`, {
            bearerToken: token,
            expectedStatus: 200,
          });
          assert.ok(
            !(listAfterDelete.json?.data?.files || []).some((item) => item.id === standaloneFileId),
            'deleted file still appears in folder listing'
          );
          return listAfterDelete.json?.data?.files;
        },
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'deleted file still appears after cache projection window',
        }
      );

      const createdProduct = await apiRequest('/api/manage/products', {
        bearerToken: token,
        method: 'POST',
        body: {
          name: `Full Chain Product ${seed}`,
          spu: `FULL-${seed}`,
          currency: 'CNY',
          brand: 'KK',
          category: 'Workflow',
          dimensions: [{ name: 'Color', values: ['Black'] }],
          variants: [
            {
              sku: `FULL-BLACK-${seed}`,
              price: 199,
              cost_price: 88,
              stock_quantity: 0,
              alert_threshold: 1,
              status: 'active',
              options_values: { Color: 'Black' },
            },
          ],
        },
        expectedStatus: 201,
      });
      const productId = createdProduct.json?.data?.id;
      assert.ok(productId, 'product id missing');

      const productDetail = await apiRequest(`/api/manage/products/${productId}`, {
        bearerToken: token,
        expectedStatus: 200,
      });
      const variantId = productDetail.json?.data?.variants?.[0]?.id;
      assert.ok(variantId, 'variant id missing');

      const createdOrder = await apiRequest('/api/manage/orders', {
        bearerToken: token,
        method: 'POST',
        body: {
          productName: `Full Chain Product ${seed}`,
          salespersonId,
          productId,
          variantId,
          quantity: 5,
          fileIds: [uploadedFileId],
        },
        expectedStatus: 201,
      });
      const orderId = createdOrder.json?.data?.id;
      assert.ok(orderId, 'order id missing');

      await apiRequest(`/api/manage/orders/${orderId}/status`, {
        bearerToken: token,
        method: 'PATCH',
        body: { status: 'confirmed' },
        expectedStatus: 200,
      });

      const createdPo = await apiRequest('/api/manage/purchase-orders/from-orders', {
        bearerToken: token,
        method: 'POST',
        body: {
          order_ids: [orderId],
          remark: `Full chain procurement ${seed}`,
          allocation_method: 'by_quantity',
        },
        expectedStatus: 201,
      });
      const poId = createdPo.json?.data?.id;
      assert.ok(poId, 'purchase order id missing');

      await apiRequest(`/api/manage/purchase-orders/${poId}/status`, {
        bearerToken: token,
        method: 'PATCH',
        body: { status: 'ordered' },
        expectedStatus: 200,
      });
      await apiRequest(`/api/manage/purchase-orders/${poId}/status`, {
        bearerToken: token,
        method: 'PATCH',
        body: { status: 'shipping' },
        expectedStatus: 200,
      });

      const poBeforeReceipt = await apiRequest(`/api/manage/purchase-orders/${poId}`, {
        bearerToken: token,
        expectedStatus: 200,
      });
      const poItemId = poBeforeReceipt.json?.data?.items?.[0]?.id;
      assert.ok(poItemId, 'purchase order item id missing');

      await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
        bearerToken: token,
        method: 'POST',
        body: {
          items: [
            {
              purchase_order_item_id: poItemId,
              received_qty: 2,
              note: 'partial full-chain receipt',
            },
          ],
        },
        expectedStatus: 201,
      });

      await waitFor(
        async () => {
          const poDetail = await apiRequest(`/api/manage/purchase-orders/${poId}`, {
            bearerToken: token,
            expectedStatus: 200,
          });
          const poItem = poDetail.json?.data?.items?.[0];
          assert.strictEqual(Number(poItem?.received_qty || 0), 2);
          return poItem;
        },
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'partial receipt projection did not converge',
        }
      );

      await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
        bearerToken: token,
        method: 'POST',
        body: {
          items: [
            {
              purchase_order_item_id: poItemId,
              received_qty: 3,
              note: 'final full-chain receipt',
            },
          ],
        },
        expectedStatus: 201,
      });

      await waitFor(
        async () => {
          const variantDetail = await apiRequest(`/api/manage/products/${productId}`, {
            bearerToken: token,
            expectedStatus: 200,
          });
          const variant = (variantDetail.json?.data?.variants || []).find(
            (item) => item.id === variantId
          );
          assert.ok(variant, 'variant missing after receipts');
          assert.strictEqual(Number(variant.stock_quantity || 0), 5);
          return variant;
        },
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'product stock did not converge after final receipt',
        }
      );

      await waitFor(
        async () => {
          const orderDetail = await apiRequest(`/api/manage/orders/${orderId}`, {
            bearerToken: token,
            expectedStatus: 200,
          });
          const order = orderDetail.json?.data;
          assert.ok(order, 'order detail missing');
          assert.strictEqual(order.procurementStatus, 'arrived');
          return order;
        },
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'order procurement status did not converge to arrived',
        }
      );

      await waitFor(
        async () => {
          const notification = await findAdminNotification(
            token,
            (item) =>
              String(item?.title || '').includes('notification.purchase_receipt_recorded') ||
              String(item?.title || '').includes('notification.order_procurement_progressed')
          );
          assert.ok(notification, 'procurement notification missing');
          return notification;
        },
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'procurement notification did not materialize',
        }
      );

      const orderAfterProcurement = await waitFor(
        async () => {
          const orderDetail = await apiRequest(`/api/manage/orders/${orderId}`, {
            bearerToken: token,
            expectedStatus: 200,
          });
          const line = orderDetail.json?.data?.lines?.[0];
          assert.ok(line, 'order line missing after procurement');
          assert.strictEqual(line.receivedQuantity, 5);
          return orderDetail.json?.data;
        },
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'order lines did not converge after procurement completion',
        }
      );
      const lineId = orderAfterProcurement?.lines?.[0]?.id;
      assert.ok(lineId, 'order line id missing');

      await apiRequest(`/api/manage/orders/${orderId}/lines/${lineId}/reserve`, {
        bearerToken: token,
        method: 'POST',
        body: { quantity: 2 },
        expectedStatus: 200,
      });

      await waitFor(
        async () => {
          const orderDetail = await apiRequest(`/api/manage/orders/${orderId}`, {
            bearerToken: token,
            expectedStatus: 200,
          });
          const line = orderDetail.json?.data?.lines?.[0];
          assert.strictEqual(line?.reservedQuantity, 2);
          return line;
        },
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'line reserve projection did not converge',
        }
      );

      await apiRequest(`/api/manage/orders/${orderId}/lines/${lineId}/ship`, {
        bearerToken: token,
        method: 'POST',
        body: { quantity: 2 },
        expectedStatus: 200,
      });

      await waitFor(
        async () => {
          const orderDetail = await apiRequest(`/api/manage/orders/${orderId}`, {
            bearerToken: token,
            expectedStatus: 200,
          });
          const line = orderDetail.json?.data?.lines?.[0];
          assert.strictEqual(line?.reservedQuantity, 0);
          assert.strictEqual(line?.shippedQuantity, 2);
          assert.strictEqual(line?.displayStatus, 'partially_shipped');
          return line;
        },
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'line ship projection did not converge',
        }
      );

      await waitFor(
        async () => {
          const variantDetail = await apiRequest(`/api/manage/products/${productId}`, {
            bearerToken: token,
            expectedStatus: 200,
          });
          const variant = (variantDetail.json?.data?.variants || []).find(
            (item) => item.id === variantId
          );
          assert.ok(variant, 'variant missing after ship command');
          assert.strictEqual(Number(variant.stock_quantity || 0), 3);
          return variant;
        },
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'stock did not converge after line ship command',
        }
      );

      await webhookReceiver.waitForDelivery(
        (item) =>
          item.body?.event_type === 'order_line_fulfillment_updated' ||
          item.body?.event_type === 'purchase_receipt_recorded' ||
          item.body?.event_type === 'order_procurement_progressed',
        {
          timeoutMs: 15000,
          intervalMs: 500,
          onTimeoutMessage: 'full-chain webhook delivery did not arrive',
        }
      );
    } finally {
      if (webhookId) {
        try {
          await deleteManageWebhook(token, webhookId);
        } catch {
          // best-effort cleanup
        }
      }
      await webhookReceiver.close();
    }
  });
});

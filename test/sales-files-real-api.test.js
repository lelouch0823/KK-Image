import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
  waitFor,
} from './utils/manage-products-real-api.js';
import { createWorkflowProduct } from './utils/order-procurement-real-api.js';
import {
  createAuthenticatedSalesSession,
  salesApiRequest,
  salesMultipartRequest,
} from './utils/sales-real-api.js';
import {
  cleanupTestManageWebhooks,
  createManageWebhook,
  deleteManageWebhook,
  startWebhookReceiver,
} from './utils/webhook-real-api.js';

describeIfRealApi('Sales Files Real API', function () {
  this.timeout(180000);

  it('covers root upload, own-order upload visibility, foreign-order denial, and file_uploaded outbox/webhook delivery', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('sales-files');
    const receiver = await startWebhookReceiver({ port: 3012 });
    let webhookId = null;

    await cleanupTestManageWebhooks(token, { eventTypes: ['file_uploaded'] });

    try {
      const webhook = await createManageWebhook(token, {
        url: receiver.url,
        events: ['file_uploaded'],
        secret: `whsec-sales-files-${seed}`,
        headers: {
          'X-Test-Seed': seed,
        },
      });
      webhookId = webhook?.id;
      assert.ok(webhookId, 'sales files webhook id missing');

      const ownerSession = await createAuthenticatedSalesSession(token, `${seed}-owner`, {
        namePrefix: 'Sales File Owner',
        store: 'Sales File Owner Store',
      });
      const outsiderSession = await createAuthenticatedSalesSession(token, `${seed}-outsider`, {
        namePrefix: 'Sales File Outsider',
        store: 'Sales File Outsider Store',
      });

      const {
        productId,
        variantId,
        productName,
      } = await createWorkflowProduct(token, seed, {
        stockQuantity: 2,
        namePrefix: 'Sales File Product',
        skuPrefix: 'SALFILE',
      });

      const ownerOrder = await apiRequest('/api/manage/orders', {
        bearerToken: token,
        method: 'POST',
        body: {
          productName,
          salespersonId: ownerSession.salespersonId,
          productId,
          variantId,
          quantity: 1,
          fileIds: [],
        },
        expectedStatus: 201,
      });
      const ownerOrderId = ownerOrder.json?.data?.id;
      assert.ok(ownerOrderId, 'owner order id missing');

      const outsiderOrder = await apiRequest('/api/manage/orders', {
        bearerToken: token,
        method: 'POST',
        body: {
          productName,
          salespersonId: outsiderSession.salespersonId,
          productId,
          variantId,
          quantity: 1,
          fileIds: [],
        },
        expectedStatus: 201,
      });
      const outsiderOrderId = outsiderOrder.json?.data?.id;
      assert.ok(outsiderOrderId, 'outsider order id missing');

      const rootUpload = await salesMultipartRequest(`/api/sales/${ownerSession.accessToken}/upload`, {
        authToken: ownerSession.jwt,
        fields: {
          file: {
            value: 'sales-root-upload',
            filename: `sales-root-${seed}.txt`,
            contentType: 'text/plain',
          },
        },
        expectedStatus: 200,
      });
      const rootFileId = rootUpload.json?.data?.id;
      assert.ok(rootFileId, 'sales root upload file id missing');

      const rootDelivery = await receiver.waitForDelivery(
        (item) => item.body?.event_type === 'file_uploaded' && item.body?.aggregate?.id === rootFileId,
        {
          timeoutMs: 20000,
          intervalMs: 500,
          onTimeoutMessage: 'sales root upload file_uploaded webhook did not arrive',
        }
      );
      assert.strictEqual(rootDelivery.headers['x-test-seed'], seed);
      assert.strictEqual(rootDelivery.body?.payload?.file?.id, rootFileId);
      assert.strictEqual(rootDelivery.body?.payload?.file?.filename, `sales-root-${seed}.txt`);

      receiver.reset();
      const orderUpload = await salesMultipartRequest(
        `/api/sales/${ownerSession.accessToken}/upload?orderId=${encodeURIComponent(ownerOrderId)}`,
        {
          authToken: ownerSession.jwt,
          fields: {
            file: {
              value: 'sales-order-upload',
              filename: `sales-order-${seed}.txt`,
              contentType: 'text/plain',
            },
          },
          expectedStatus: 200,
        }
      );
      const orderFileId = orderUpload.json?.data?.id;
      assert.ok(orderFileId, 'sales order upload file id missing');

      const foreignReject = await salesMultipartRequest(
        `/api/sales/${ownerSession.accessToken}/upload?orderId=${encodeURIComponent(outsiderOrderId)}`,
        {
          authToken: ownerSession.jwt,
          fields: {
            file: {
              value: 'sales-foreign-upload',
              filename: `sales-foreign-${seed}.txt`,
              contentType: 'text/plain',
            },
          },
          expectedStatus: 403,
        }
      );
      assert.strictEqual(foreignReject.json?.success, false);

      await waitFor(async () => {
        const outbox = await apiRequest('/api/manage/outbox?eventType=file_uploaded', {
          bearerToken: token,
          expectedStatus: 200,
        });
        const event = (outbox.json?.data || []).find((item) => item.aggregate_id === orderFileId);
        assert.ok(event, 'sales file_uploaded outbox event missing');
        const webhookJob = (event.consumerJobs || []).find((job) => job.consumer_name === 'webhook');
        assert.ok(webhookJob, 'sales file_uploaded webhook consumer job missing');
        assert.ok(['pending', 'published'].includes(webhookJob.status), 'unexpected webhook job status');
        return event;
      }, {
        timeoutMs: 20000,
        intervalMs: 500,
        onTimeoutMessage: 'sales file_uploaded outbox event did not materialize',
      });

      await waitFor(async () => {
        const detail = await apiRequest(`/api/manage/orders/${ownerOrderId}`, {
          bearerToken: token,
          expectedStatus: 200,
        });
        const file = (detail.json?.data?.files || []).find((item) => item.id === orderFileId);
        assert.ok(file, 'sales-uploaded file missing from manage order detail');
        assert.strictEqual(file.filename, `sales-order-${seed}.txt`);
        return file;
      }, {
        timeoutMs: 15000,
        intervalMs: 500,
        onTimeoutMessage: 'sales order upload did not appear in manage order detail',
      });

      const salesDetail = await salesApiRequest(
        ownerSession.accessToken,
        ownerSession.jwt,
        `/api/sales/${ownerSession.accessToken}/orders/${ownerOrderId}`,
        { expectedStatus: 200 }
      );
      const salesFile = (salesDetail.json?.data?.files || []).find((item) => item.id === orderFileId);
      assert.ok(salesFile, 'sales-uploaded file missing from sales order detail');
      assert.strictEqual(salesFile.filename, `sales-order-${seed}.txt`);
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

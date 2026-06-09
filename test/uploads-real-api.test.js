import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  uniqueSeed,
  apiRequest,
  multipartRequest,
  waitFor,
  processOutbox,
} from './utils/manage-products-real-api.js';
import {
  cleanupTestManageWebhooks,
  createManageWebhook,
  deleteManageWebhook,
  startWebhookReceiver,
} from './utils/webhook-real-api.js';
import { createAuthenticatedSalesSession, salesMultipartRequest } from './utils/sales-real-api.js';

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

describeIfRealApi('Uploads Real API', function () {
  this.timeout(180000);

  it('emits manage and sales file upload webhooks and records space upload outbox cache fan-out', async () => {
    const token = await getBearerToken();
    await cleanupTestManageWebhooks(token, { eventTypes: ['file_uploaded'] });
    const seed = uniqueSeed('upload-chain');
    const receiver = await startWebhookReceiver({ port: 3011 });
    let webhookId = null;

    try {
      const webhook = await createManageWebhook(token, {
        url: receiver.url,
        events: ['file_uploaded'],
        secret: `whsec-upload-${seed}`,
        headers: {
          'X-Test-Seed': seed,
        },
      });
      webhookId = webhook?.id;
      assert.ok(webhookId, 'upload webhook id missing');

      const createdSpace = await apiRequest('/api/manage/spaces', {
        bearerToken: token,
        method: 'POST',
        body: {
          name: `Upload Space ${seed}`,
          description: 'upload outbox regression',
          template: 'gallery',
          templateData: {},
        },
        expectedStatus: 201,
      });
      const spaceId = createdSpace.json?.data?.id;
      assert.ok(spaceId, 'space id missing for upload outbox flow');

      receiver.reset();
      const manageUpload = await multipartRequest(`/api/manage/upload?spaceId=${spaceId}`, {
        bearerToken: token,
        fields: {
          file: {
            value: 'manage-upload-body',
            filename: `manage-upload-${seed}.txt`,
            contentType: 'text/plain',
          },
        },
        expectedStatus: 200,
      });
      const manageFileId = manageUpload.json?.data?.id;
      assert.ok(manageFileId, 'manage upload file id missing');

      await processOutbox();

      const manageDelivery = await receiver.waitForDelivery(
        (item) =>
          item.body?.event_type === 'file_uploaded' && item.body?.aggregate?.id === manageFileId,
        {
          timeoutMs: 20000,
          intervalMs: 500,
          onTimeoutMessage: 'manage upload file_uploaded webhook did not arrive',
        }
      );
      assert.strictEqual(manageDelivery.headers['x-test-seed'], seed);
      assert.strictEqual(manageDelivery.body?.payload?.file?.id, manageFileId);
      assert.strictEqual(manageDelivery.body?.payload?.file?.filename, `manage-upload-${seed}.txt`);

      const spaceOutboxEvent = await waitFor(
        async () => {
          const listed = await apiRequest('/api/manage/outbox?eventType=space_file_added', {
            bearerToken: token,
            expectedStatus: 200,
          });
          const events = listed.json?.data || [];
          const matched = events.find((event) => {
            if (event.aggregate_id !== spaceId) return false;
            const payload = parseJson(event.payload_json);
            return Array.isArray(payload.file_ids) && payload.file_ids.includes(manageFileId);
          });
          assert.ok(matched, 'space_file_added outbox event missing for manage upload');
          const cacheJob = (matched.consumerJobs || []).find(
            (job) => job.consumer_name === 'cache'
          );
          assert.ok(cacheJob, 'space_file_added cache consumer job missing');
          assert.strictEqual(cacheJob.status, 'published');
          return matched;
        },
        {
          timeoutMs: 20000,
          intervalMs: 500,
          onTimeoutMessage: 'space_file_added outbox event did not settle as published',
        }
      );

      const spacePayload = parseJson(spaceOutboxEvent.payload_json);
      assert.deepStrictEqual(spacePayload.file_ids, [manageFileId]);
      assert.strictEqual(spacePayload.space_id, spaceId);

      const salesSession = await createAuthenticatedSalesSession(token, `${seed}-sales`);
      receiver.reset();
      const salesUpload = await salesMultipartRequest(
        `/api/sales/${salesSession.accessToken}/upload`,
        {
          authToken: salesSession.jwt,
          fields: {
            file: {
              value: 'sales-upload-body',
              filename: `sales-upload-${seed}.txt`,
              contentType: 'text/plain',
            },
          },
          expectedStatus: 200,
        }
      );
      const salesFileId = salesUpload.json?.data?.id;
      assert.ok(salesFileId, 'sales upload file id missing');

      await processOutbox();

      const salesDelivery = await receiver.waitForDelivery(
        (item) =>
          item.body?.event_type === 'file_uploaded' && item.body?.aggregate?.id === salesFileId,
        {
          timeoutMs: 20000,
          intervalMs: 500,
          onTimeoutMessage: 'sales upload file_uploaded webhook did not arrive',
        }
      );
      assert.strictEqual(salesDelivery.headers['x-test-seed'], seed);
      assert.strictEqual(salesDelivery.body?.payload?.file?.id, salesFileId);
      assert.strictEqual(salesDelivery.body?.payload?.file?.filename, `sales-upload-${seed}.txt`);
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

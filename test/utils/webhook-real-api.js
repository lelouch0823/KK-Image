import assert from 'assert';
import http from 'node:http';
import { apiRequest, getBearerToken, waitFor, uniqueSeed } from './manage-products-real-api.js';

function normalizePort(port) {
  return Number(port || process.env.WEBHOOK_TEST_PORT || 3001);
}

export async function startWebhookReceiver({ port, path = '/webhook' } = {}) {
  const received = [];
  const targetPort = normalizePort(port);

  const server = await new Promise((resolve) => {
    const instance = http.createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== path) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          received.push({
            headers: req.headers,
            body: JSON.parse(body),
            timestamp: new Date().toISOString(),
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: String(error?.message || error) }));
        }
      });
    });

    instance.listen(targetPort, '127.0.0.1', () => resolve(instance));
  });

  return {
    url: `http://127.0.0.1:${targetPort}${path}`,
    received,
    reset() {
      received.length = 0;
    },
    async waitForDelivery(predicate, options = {}) {
      return waitFor(() => {
        const match = received.find(predicate);
        assert.ok(match, options.onTimeoutMessage || 'expected webhook delivery did not arrive');
        return match;
      }, options);
    },
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

export async function createManageWebhook(
  token,
  {
    url,
    events = ['purchase_receipt_recorded'],
    secret = 'test-secret-key',
    headers = {},
    enabled = true,
  } = {}
) {
  const result = await apiRequest('/api/manage/webhooks', {
    bearerToken: token,
    method: 'POST',
    body: {
      url,
      events,
      secret,
      headers,
      enabled,
    },
    expectedStatus: 201,
  });

  return result.json?.data;
}

export async function listManageWebhooks(token) {
  const result = await apiRequest('/api/manage/webhooks', {
    bearerToken: token,
    expectedStatus: 200,
  });

  return result.json?.data || [];
}

export async function testManageWebhook(token, webhookId) {
  const result = await apiRequest(`/api/manage/webhooks/${webhookId}/test`, {
    bearerToken: token,
    method: 'POST',
    body: {},
    expectedStatus: 200,
  });

  assert.strictEqual(
    result.json?.success,
    true,
    `manage webhook test failed: ${JSON.stringify(result.json)}`
  );
  return result.json?.data;
}

export async function deleteManageWebhook(token, webhookId) {
  if (!webhookId) return null;
  const result = await apiRequest(`/api/manage/webhooks/${webhookId}`, {
    bearerToken: token,
    method: 'DELETE',
    expectedStatus: 200,
  });
  return result.json;
}

export async function runWebhookSmokeFlow({
  token,
  port,
  seed = uniqueSeed('webhook-real'),
  events = ['purchase_receipt_recorded'],
} = {}) {
  const bearerToken = token || (await getBearerToken());
  const receiver = await startWebhookReceiver({ port });
  let webhookId = null;

  try {
    const webhook = await createManageWebhook(bearerToken, {
      url: receiver.url,
      events,
      headers: {
        'X-Test-Seed': seed,
      },
    });
    webhookId = webhook?.id;
    assert.ok(webhookId, 'webhook id missing');

    const listed = await listManageWebhooks(bearerToken);
    assert.ok(
      listed.some((item) => item.id === webhookId),
      'created webhook missing from list'
    );

    const testResult = await testManageWebhook(bearerToken, webhookId);
    const delivered = await receiver.waitForDelivery(
      (item) => (item.body?.event_type || item.body?.event) === 'webhook.test',
      {
        timeoutMs: 15000,
        intervalMs: 500,
        onTimeoutMessage: 'webhook.test delivery did not arrive',
      }
    );

    return {
      seed,
      webhook,
      listedCount: listed.length,
      testResult,
      delivered,
      received: [...receiver.received],
    };
  } finally {
    if (webhookId) {
      try {
        await deleteManageWebhook(bearerToken, webhookId);
      } catch {
        // best-effort cleanup
      }
    }
    await receiver.close();
  }
}

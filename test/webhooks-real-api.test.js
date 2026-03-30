import assert from 'assert';
import { describeIfRealApi, getBearerToken, uniqueSeed } from './utils/manage-products-real-api.js';
import { runWebhookSmokeFlow } from './utils/webhook-real-api.js';
import { runWebhookTests } from './webhook-test.js';

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
});

import assert from 'assert';
import { getBearerToken, uniqueSeed } from './utils/manage-products-real-api.js';
import { runWebhookSmokeFlow } from './utils/webhook-real-api.js';

async function runWebhookTests(options = {}) {
  const token = options.token || (await getBearerToken());
  const result = await runWebhookSmokeFlow({
    token,
    seed: options.seed || uniqueSeed('webhook-cli'),
    port: options.port,
  });

  assert.ok(
    result.received.some((item) => (item.body?.event_type || item.body?.event) === 'webhook.test'),
    'Expected webhook.test event was not delivered'
  );

  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Starting Webhook functionality tests...\n');
  runWebhookTests()
    .then((result) => {
      console.log(`✅ Webhook created and delivered successfully (${result.webhook.id})`);
      console.log(`✅ Received ${result.received.length} webhook(s) locally`);
      console.log('🎉 All webhook tests completed successfully!');
    })
    .catch((error) => {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    });
}

export { runWebhookTests };

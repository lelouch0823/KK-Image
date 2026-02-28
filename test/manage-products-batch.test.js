import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
} from './utils/manage-products-real-api.js';

describeIfRealApi('Manage Products Real API Batch', function () {
  this.timeout(120000);

  it('imports products in replace mode with summary counters', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('batch');

    const { json } = await apiRequest('/api/manage/products/batch', {
      bearerToken: token,
      method: 'POST',
      body: {
        import_mode: 'replace',
        items: [
          {
            name: `Batch Product A ${seed}`,
            spu: `BATCH-A-${seed}`,
            currency: 'CNY',
            variants: [
              {
                sku: `BATCH-A-SKU-${seed}`,
                price: 10,
                cost_price: 6,
                stock_quantity: 2,
                alert_threshold: 1,
                status: 'active',
                options_values: { k: 'v' },
              },
            ],
          },
          {
            name: `Batch Product B ${seed}`,
            spu: `BATCH-B-${seed}`,
            currency: 'USD',
            variants: [
              {
                sku: `BATCH-B-SKU-${seed}`,
                price: 12,
                cost_price: 7,
                stock_quantity: 3,
                alert_threshold: 1,
                status: 'active',
                options_values: { k: 'v2' },
              },
            ],
          },
        ],
      },
      expectedStatus: 200,
    });

    assert.strictEqual(typeof json?.success, 'boolean');
    assert.ok(json?.summary);
    assert.ok(typeof json.summary.createdProducts === 'number');
    assert.ok(typeof json.summary.createdVariants === 'number');
    assert.ok(typeof json.summary.archivedVariants === 'number');
    assert.ok(typeof json.summary.reactivatedVariants === 'number');
  });
});


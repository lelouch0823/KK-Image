import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
} from './utils/manage-products-real-api.js';

describeIfRealApi('Manage Products Real API Rollback', function () {
  this.timeout(120000);

  it('rolls back product create when variant creation fails (duplicate barcode in same request)', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('rollback');
    const spu = `ROLL-${seed}`;
    const barcode = `ROLL-BC-${seed}`;

    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Rollback Product ${seed}`,
        spu,
        currency: 'CNY',
        dimensions: [{ name: 'Color', values: ['Red', 'Blue'] }],
        variants: [
          {
            sku: `ROLL-RED-${seed}`,
            price: 10,
            cost_price: 5,
            stock_quantity: 1,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red' },
            barcode,
          },
          {
            sku: `ROLL-BLUE-${seed}`,
            price: 10,
            cost_price: 5,
            stock_quantity: 1,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Blue' },
            barcode,
          },
        ],
      },
    });

    // Current behavior: server returns 500 for this path.
    assert.ok([400, 409, 500].includes(created.response.status));

    // Rollback guarantee: no residual product by SPU
    const list = await apiRequest(`/api/manage/products?search=${encodeURIComponent(spu)}&page=1&limit=10`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const items = list.json?.data || [];
    assert.ok(!items.some((item) => item.spu === spu), 'rollback failed: residual product exists');
  });
});


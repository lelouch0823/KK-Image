import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
} from './utils/manage-products-real-api.js';

describeIfRealApi('Manage Products Real API Query Consistency', function () {
  this.timeout(120000);

  it('keeps list/detail/variants picker consistent on active vs archived variants', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('consistency');
    const spu = `CONS-${seed}`;

    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Consistency Product ${seed}`,
        spu,
        currency: 'CNY',
        dimensions: [{ name: 'Color', values: ['Red', 'Blue'] }],
        variants: [
          {
            sku: `CONS-RED-${seed}`,
            price: 10,
            cost_price: 5,
            stock_quantity: 2,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red' },
          },
          {
            sku: `CONS-BLUE-${seed}`,
            price: 12,
            cost_price: 6,
            stock_quantity: 2,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Blue' },
          },
        ],
      },
      expectedStatus: 201,
    });
    const productId = created.json?.data?.id;
    assert.ok(productId);

    const detailBefore = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variantsBefore = detailBefore.json?.data?.variants || [];
    const blue = variantsBefore.find((v) => v.sku === `CONS-BLUE-${seed}`);
    const red = variantsBefore.find((v) => v.sku === `CONS-RED-${seed}`);
    assert.ok(blue && red);

    // Remove blue from payload => archived
    await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      method: 'PATCH',
      body: {
        variants: [
          {
            id: red.id,
            sku: red.sku,
            price: Number(red.price || 10),
            cost_price: Number(red.cost_price || 5),
            stock_quantity: Number(red.stock_quantity || 2),
            alert_threshold: Number(red.alert_threshold || 1),
            status: 'active',
            options_values: red.options_values,
          },
        ],
      },
      expectedStatus: 200,
    });

    const detailAfter = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variantsAfter = detailAfter.json?.data?.variants || [];
    const blueAfter = variantsAfter.find((v) => v.id === blue.id);
    assert.ok(blueAfter);
    assert.strictEqual(blueAfter.status, 'archived');

    const picker = await apiRequest(`/api/manage/products/variants?search=${encodeURIComponent(spu)}&page=1&limit=20`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const pickerItems = picker.json?.data || [];
    assert.ok(pickerItems.every((item) => item.variant_id !== blue.id), 'archived variant leaked into picker');
    assert.ok(pickerItems.some((item) => item.variant_id === red.id), 'active variant missing from picker');
  });
});

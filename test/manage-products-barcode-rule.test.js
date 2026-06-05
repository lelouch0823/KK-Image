import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
} from './utils/manage-products-real-api.js';

describeIfRealApi('Manage Products Real API Barcode Rule', function () {
  this.timeout(180000);

  it('allows reusing barcode after previous variant is archived', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('barcode');
    const spu = `SPU-${seed}`;
    const barcode = `BC-${seed}`;

    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Product ${seed}`,
        spu,
        currency: 'CNY',
        dimensions: [{ name: 'Color', values: ['Red', 'Blue'] }],
        variants: [
          {
            sku: `SKU-${seed}-RED`,
            price: 100,
            cost_price: 60,
            stock_quantity: 5,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red' },
            barcode,
          },
          {
            sku: `SKU-${seed}-BLUE`,
            price: 110,
            cost_price: 70,
            stock_quantity: 5,
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

    const detail1 = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variants1 = detail1.json?.data?.variants || [];
    const red = variants1.find((v) => v.sku === `SKU-${seed}-RED`);
    const blue = variants1.find((v) => v.sku === `SKU-${seed}-BLUE`);
    assert.ok(red?.id && blue?.id);

    // Remove Red variant (should archive) and create Black variant with same barcode.
    const patched = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      method: 'PATCH',
      body: {
        variants: [
          {
            id: blue.id,
            sku: blue.sku,
            price: Number(blue.price || 110),
            cost_price: Number(blue.cost_price || 70),
            stock_quantity: Number(blue.stock_quantity || 5),
            alert_threshold: Number(blue.alert_threshold || 1),
            status: 'active',
            options_values: blue.options_values,
          },
          {
            sku: `SKU-${seed}-BLACK`,
            price: 120,
            cost_price: 75,
            stock_quantity: 4,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Black' },
            barcode,
          },
        ],
      },
      expectedStatus: 200,
    });
    assert.strictEqual(patched.json?.success, true);

    const detail2 = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variants2 = detail2.json?.data?.variants || [];
    const redAfter = variants2.find((v) => v.id === red.id);
    const black = variants2.find((v) => v.sku === `SKU-${seed}-BLACK`);
    assert.ok(redAfter);
    assert.strictEqual(redAfter.status, 'archived');
    assert.ok(black);
    assert.strictEqual(black.barcode, barcode);
    assert.strictEqual(black.status, 'active');
  });
});

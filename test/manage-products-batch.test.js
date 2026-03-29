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

  it('updates existing products and reactivates archived variants in replace mode', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('batch-reactivate');
    const spu = `BATCH-R-${seed}`;

    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Batch Reactivate ${seed}`,
        spu,
        currency: 'CNY',
        dimensions: [{ name: 'Color', values: ['Red', 'Blue'] }],
        variants: [
          {
            sku: `BATCH-R-RED-${seed}`,
            price: 10,
            cost_price: 6,
            stock_quantity: 2,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red' },
          },
          {
            sku: `BATCH-R-BLUE-${seed}`,
            price: 11,
            cost_price: 7,
            stock_quantity: 3,
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
    const blueVariant = (detailBefore.json?.data?.variants || []).find((item) => item.sku === `BATCH-R-BLUE-${seed}`);
    const redVariant = (detailBefore.json?.data?.variants || []).find((item) => item.sku === `BATCH-R-RED-${seed}`);
    assert.ok(blueVariant?.id && redVariant?.id);

    await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      method: 'PATCH',
      body: {
        variants: [
          {
            id: redVariant.id,
            sku: redVariant.sku,
            price: 10,
            cost_price: 6,
            stock_quantity: 2,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red' },
          },
        ],
      },
      expectedStatus: 200,
    });

    const batch = await apiRequest('/api/manage/products/batch', {
      bearerToken: token,
      method: 'POST',
      body: {
        import_mode: 'replace',
        items: [
          {
            name: `Batch Reactivate ${seed} Updated`,
            spu,
            currency: 'CNY',
            dimensions: [{ name: 'Color', values: ['Red', 'Blue'] }],
            variants: [
              {
                sku: `BATCH-R-RED-${seed}`,
                price: 12,
                cost_price: 6,
                stock_quantity: 4,
                alert_threshold: 1,
                status: 'active',
                options_values: { Color: 'Red' },
              },
              {
                sku: `BATCH-R-BLUE-${seed}`,
                price: 14,
                cost_price: 8,
                stock_quantity: 5,
                alert_threshold: 1,
                status: 'active',
                options_values: { Color: 'Blue' },
              },
            ],
          },
        ],
      },
      expectedStatus: 200,
    });

    assert.strictEqual(batch.json?.success, true);
    assert.strictEqual(Number(batch.json?.summary?.updatedProducts || 0), 1);
    assert.ok(Number(batch.json?.summary?.reactivatedVariants || 0) >= 1);

    const detailAfter = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variantsAfter = detailAfter.json?.data?.variants || [];
    const blueAfter = variantsAfter.find((item) => item.sku === `BATCH-R-BLUE-${seed}`);
    const redAfter = variantsAfter.find((item) => item.sku === `BATCH-R-RED-${seed}`);
    assert.strictEqual(detailAfter.json?.data?.name, `Batch Reactivate ${seed} Updated`);
    assert.strictEqual(redAfter?.status, 'active');
    assert.strictEqual(blueAfter?.status, 'active');
    assert.strictEqual(Number(blueAfter?.stock_quantity || 0), 5);
  });

  it('does not leave residual products when a batch item fails validation', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('batch-fail');
    const spu = `BATCH-FAIL-${seed}`;
    const barcode = `BATCH-FAIL-BC-${seed}`;

    const batch = await apiRequest('/api/manage/products/batch', {
      bearerToken: token,
      method: 'POST',
      body: {
        import_mode: 'replace',
        items: [
          {
            name: `Batch Fail ${seed}`,
            spu,
            currency: 'CNY',
            variants: [
              {
                sku: `BATCH-FAIL-RED-${seed}`,
                price: 10,
                cost_price: 6,
                stock_quantity: 2,
                alert_threshold: 1,
                status: 'active',
                options_values: { Color: 'Red' },
                barcode,
              },
              {
                sku: `BATCH-FAIL-BLUE-${seed}`,
                price: 11,
                cost_price: 7,
                stock_quantity: 3,
                alert_threshold: 1,
                status: 'active',
                options_values: { Color: 'Blue' },
                barcode,
              },
            ],
          },
        ],
      },
      expectedStatus: 200,
    });

    assert.strictEqual(batch.json?.success, false);
    assert.strictEqual(Number(batch.json?.summary?.failedProducts || 0), 1);
    assert.ok((batch.json?.errors || []).some((item) => String(item).includes(spu)));

    const list = await apiRequest(`/api/manage/products?search=${encodeURIComponent(spu)}&page=1&limit=10`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const items = list.json?.data || [];
    assert.ok(!items.some((item) => item.spu === spu), 'batch failure left residual product');
  });

  it('preserves existing fields in safe_merge mode and returns conflicts', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('batch-safe-merge');
    const spu = `BATCH-SAFE-${seed}`;

    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Batch Safe Original ${seed}`,
        spu,
        brand: 'OriginalBrand',
        currency: 'CNY',
        dimensions: [{ name: 'Color', values: ['Red'] }],
        variants: [
          {
            sku: `BATCH-SAFE-RED-${seed}`,
            price: 21,
            cost_price: 11,
            stock_quantity: 2,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red' },
          },
        ],
      },
      expectedStatus: 201,
    });
    const productId = created.json?.data?.id;
    assert.ok(productId);

    const batch = await apiRequest('/api/manage/products/batch', {
      bearerToken: token,
      method: 'POST',
      body: {
        import_mode: 'safe_merge',
        items: [
          {
            name: `Batch Safe Incoming ${seed}`,
            spu,
            brand: 'IncomingBrand',
            currency: 'CNY',
            dimensions: [{ name: 'Color', values: ['Red'] }],
            variants: [
              {
                sku: `BATCH-SAFE-RED-${seed}`,
                price: 31,
                cost_price: 15,
                stock_quantity: 9,
                alert_threshold: 2,
                status: 'active',
                options_values: { Color: 'Red' },
              },
            ],
          },
        ],
      },
      expectedStatus: 200,
    });

    assert.strictEqual(batch.json?.success, true);
    assert.strictEqual(batch.json?.importMode, 'safe_merge');
    assert.ok(Number(batch.json?.summary?.conflicts || 0) >= 4);
    assert.ok((batch.json?.conflicts || []).some((item) => item.field === 'name'));
    assert.ok((batch.json?.conflicts || []).some((item) => item.field === 'price'));

    const detail = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variant = detail.json?.data?.variants?.find((item) => item.sku === `BATCH-SAFE-RED-${seed}`);
    assert.strictEqual(detail.json?.data?.name, `Batch Safe Original ${seed}`);
    assert.strictEqual(detail.json?.data?.brand, 'OriginalBrand');
    assert.strictEqual(variant?.price, 21);
    assert.strictEqual(Number(variant?.stock_quantity || 0), 2);
    assert.strictEqual(Number(variant?.alert_threshold || 0), 1);
  });
});

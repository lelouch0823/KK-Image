import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
} from './utils/manage-products-real-api.js';

function buildCartesianVariants(seed, dimA, dimB, dimC) {
  const variants = [];
  for (const a of dimA) {
    for (const b of dimB) {
      for (const c of dimC) {
        variants.push({
          sku: `SCALE-${seed}-${a}-${b}-${c}`,
          price: 20,
          cost_price: 10,
          stock_quantity: 3,
          alert_threshold: 1,
          status: 'active',
          options_values: { A: a, B: b, C: c },
        });
      }
    }
  }
  return variants;
}

describeIfRealApi('Manage Products Real API Concurrency & Scale', function () {
  this.timeout(180000);

  it('handles concurrent PATCH without duplicate active variants', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('conc');
    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Concurrency Product ${seed}`,
        spu: `CONC-${seed}`,
        currency: 'CNY',
        dimensions: [{ name: 'Color', values: ['Red'] }],
        variants: [
          {
            sku: `CONC-RED-${seed}`,
            price: 10,
            cost_price: 5,
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

    const detail = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variant = (detail.json?.data?.variants || [])[0];
    assert.ok(variant?.id);

    const payloadA = {
      variants: [
        {
          id: variant.id,
          sku: variant.sku,
          price: 31,
          cost_price: 11,
          stock_quantity: 3,
          alert_threshold: 1,
          status: 'active',
          options_values: variant.options_values,
        },
      ],
    };
    const payloadB = {
      variants: [
        {
          id: variant.id,
          sku: variant.sku,
          price: 35,
          cost_price: 12,
          stock_quantity: 4,
          alert_threshold: 1,
          status: 'active',
          options_values: variant.options_values,
        },
      ],
    };

    const [resA, resB] = await Promise.all([
      apiRequest(`/api/manage/products/${productId}`, {
        bearerToken: token,
        method: 'PATCH',
        body: payloadA,
      }),
      apiRequest(`/api/manage/products/${productId}`, {
        bearerToken: token,
        method: 'PATCH',
        body: payloadB,
      }),
    ]);
    assert.ok([200, 400, 409, 500].includes(resA.response.status));
    assert.ok([200, 400, 409, 500].includes(resB.response.status));

    const detailAfter = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variants = detailAfter.json?.data?.variants || [];
    const active = variants.filter((v) => v.status === 'active');
    assert.strictEqual(active.length, 1, 'concurrent updates produced duplicate active variants');
  });

  it('creates medium-size cartesian variants (4x4x4) successfully', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('scale');
    const dim = ['1', '2', '3', '4'];
    const variants = buildCartesianVariants(seed, dim, dim, dim); // 64 variants

    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Scale Product ${seed}`,
        spu: `SCALE-${seed}`,
        currency: 'CNY',
        dimensions: [
          { name: 'A', values: dim },
          { name: 'B', values: dim },
          { name: 'C', values: dim },
        ],
        variants,
      },
      expectedStatus: 201,
    });
    const productId = created.json?.data?.id;
    assert.ok(productId);

    const detail = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const persisted = detail.json?.data?.variants || [];
    assert.ok(persisted.length >= 64, `expected at least 64 variants, got ${persisted.length}`);
  });
});

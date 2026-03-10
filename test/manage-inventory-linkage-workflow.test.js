import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
} from './utils/manage-products-real-api.js';

async function ensureSalespersonId(token, seed) {
  const listed = await apiRequest('/api/manage/salespersons?page=1&limit=1', {
    bearerToken: token,
    expectedStatus: 200,
  });
  const existing = listed.json?.data?.salespersons?.[0];
  if (existing?.id) return existing.id;

  const created = await apiRequest('/api/manage/salespersons', {
    bearerToken: token,
    method: 'POST',
    body: {
      name: `Workflow Sales ${seed}`,
      store: 'Workflow Store',
      phone: `13${String(Date.now()).slice(-9)}`,
      password: '123456',
    },
    expectedStatus: 201,
  });
  return created.json?.data?.id;
}

function findVariant(detail, variantId) {
  return (detail?.data?.variants || []).find((variant) => variant.id === variantId);
}

function findSuggestion(payload, variantId) {
  return (payload?.data || []).find((item) => item.variant_id === variantId);
}

function findOverviewItem(payload, variantId) {
  return (payload?.data?.items || []).find((item) => item.variantId === variantId || item.id === variantId);
}

describeIfRealApi('Manage Inventory Linkage Real API Workflow', function () {
  this.timeout(180000);

  it('keeps reservation, availability, procurement suggestion, and arrival linkage in sync end-to-end', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('inv-flow');
    const salespersonId = await ensureSalespersonId(token, seed);

    const createdProduct = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Inventory Flow Product ${seed}`,
        spu: `INV-${seed}`,
        currency: 'CNY',
        brand: 'KK',
        category: 'Workflow',
        dimensions: [{ name: 'Color', values: ['Red'] }],
        variants: [
          {
            sku: `INV-RED-${seed}`,
            price: 99,
            cost_price: 55,
            stock_quantity: 10,
            alert_threshold: 2,
            status: 'active',
            options_values: { Color: 'Red' },
          },
        ],
      },
      expectedStatus: 201,
    });
    const productId = createdProduct.json?.data?.id;
    assert.ok(productId, 'product id missing');

    const initialDetail = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variantId = initialDetail.json?.data?.variants?.[0]?.id;
    assert.ok(variantId, 'variant id missing');

    const createOrder = async (qty) => {
      const created = await apiRequest('/api/manage/orders', {
        bearerToken: token,
        method: 'POST',
        body: {
          productName: `Inventory Flow Product ${seed}`,
          salespersonId,
          productId,
          variantId,
          quantity: qty,
          fileIds: [],
        },
        expectedStatus: 201,
      });
      return created.json?.data?.id;
    };

    const order1 = await createOrder(4);
    const order2 = await createOrder(8);
    assert.ok(order1 && order2, 'order ids missing');

    await apiRequest(`/api/manage/orders/${order1}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'confirmed' },
      expectedStatus: 200,
    });
    await apiRequest(`/api/manage/orders/${order2}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'confirmed' },
      expectedStatus: 200,
    });

    const confirmedDetail = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const confirmedVariant = findVariant(confirmedDetail.json, variantId);
    assert.ok(confirmedVariant, 'confirmed variant missing');
    assert.strictEqual(Number(confirmedVariant.stock_quantity || 0), 10);
    assert.strictEqual(Number(confirmedVariant.available_quantity || 0), 0);

    const confirmedSuggestions = await apiRequest('/api/manage/purchase-orders/suggestions', {
      bearerToken: token,
      expectedStatus: 200,
    });
    const confirmedSuggestion = findSuggestion(confirmedSuggestions.json, variantId);
    assert.ok(confirmedSuggestion, 'confirmed suggestion missing');
    assert.strictEqual(Number(confirmedSuggestion.total_demand || 0), 12);
    assert.strictEqual(Number(confirmedSuggestion.available_quantity || 0), 0);
    assert.strictEqual(Number(confirmedSuggestion.shortage || 0), 12);

    const confirmedOverview = await apiRequest('/api/manage/goods-overview?sort=shortage', {
      bearerToken: token,
      expectedStatus: 200,
    });
    const confirmedOverviewItem = findOverviewItem(confirmedOverview.json, variantId);
    assert.ok(confirmedOverviewItem, 'confirmed overview item missing');
    assert.strictEqual(Number(confirmedOverviewItem.availableQuantity || 0), 0);
    assert.strictEqual(Number(confirmedOverviewItem.shortage || 0), 12);

    await apiRequest(`/api/manage/orders/${order1}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'delivered', force: true, note: 'workflow delivery transition' },
      expectedStatus: 200,
    });

    const deliveredSuggestions = await apiRequest('/api/manage/purchase-orders/suggestions', {
      bearerToken: token,
      expectedStatus: 200,
    });
    const deliveredSuggestion = findSuggestion(deliveredSuggestions.json, variantId);
    assert.ok(deliveredSuggestion, 'delivered suggestion missing');
    assert.strictEqual(Number(deliveredSuggestion.total_demand || 0), 8);
    assert.strictEqual(Number(deliveredSuggestion.stock_quantity || 0), 6);
    assert.strictEqual(Number(deliveredSuggestion.available_quantity || 0), 0);
    assert.strictEqual(Number(deliveredSuggestion.shortage || 0), 8);

    const createdPo = await apiRequest('/api/manage/purchase-orders', {
      bearerToken: token,
      method: 'POST',
      body: { remark: `Inventory linkage PO ${seed}`, allocation_method: 'by_quantity' },
      expectedStatus: 201,
    });
    const poId = createdPo.json?.data?.id;
    assert.ok(poId, 'purchase order id missing');

    await apiRequest(`/api/manage/purchase-orders/${poId}/items`, {
      bearerToken: token,
      method: 'POST',
      body: {
        items: [
          {
            product_id: productId,
            variant_id: variantId,
            quantity: 5,
            unit_cost: 55,
          },
        ],
      },
      expectedStatus: 201,
    });

    await apiRequest(`/api/manage/purchase-orders/${poId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'ordered' },
      expectedStatus: 200,
    });
    await apiRequest(`/api/manage/purchase-orders/${poId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'shipping' },
      expectedStatus: 200,
    });
    await apiRequest(`/api/manage/purchase-orders/${poId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'arrived' },
      expectedStatus: 200,
    });

    const finalDetail = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const finalVariant = findVariant(finalDetail.json, variantId);
    assert.ok(finalVariant, 'final variant missing');
    assert.strictEqual(Number(finalVariant.stock_quantity || 0), 11);
    assert.strictEqual(Number(finalVariant.available_quantity || 0), 3);

    const finalSuggestions = await apiRequest('/api/manage/purchase-orders/suggestions', {
      bearerToken: token,
      expectedStatus: 200,
    });
    const finalSuggestion = findSuggestion(finalSuggestions.json, variantId);
    assert.ok(finalSuggestion, 'final suggestion missing');
    assert.strictEqual(Number(finalSuggestion.total_demand || 0), 8);
    assert.strictEqual(Number(finalSuggestion.stock_quantity || 0), 11);
    assert.strictEqual(Number(finalSuggestion.available_quantity || 0), 3);
    assert.strictEqual(Number(finalSuggestion.shortage || 0), 5);

    const finalOverview = await apiRequest('/api/manage/goods-overview?sort=shortage', {
      bearerToken: token,
      expectedStatus: 200,
    });
    const finalOverviewItem = findOverviewItem(finalOverview.json, variantId);
    assert.ok(finalOverviewItem, 'final overview item missing');
    assert.strictEqual(Number(finalOverviewItem.stockQuantity || 0), 11);
    assert.strictEqual(Number(finalOverviewItem.availableQuantity || 0), 3);
    assert.strictEqual(Number(finalOverviewItem.shortage || 0), 5);
  });
});

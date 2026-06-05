import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
} from './utils/manage-products-real-api.js';

describeIfRealApi('Manage Products Real API Replenishment Signal', function () {
  this.timeout(180000);

  it('tracks variant replenishment quantity by purchase-order status lifecycle', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('replenish');

    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Replenishment Product ${seed}`,
        spu: `RPL-${seed}`,
        currency: 'CNY',
        dimensions: [{ name: 'Color', values: ['Red'] }],
        variants: [
          {
            sku: `RPL-RED-${seed}`,
            price: 99,
            cost_price: 55,
            stock_quantity: 5,
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

    const detail0 = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variant = (detail0.json?.data?.variants || [])[0];
    assert.ok(variant?.id, 'variant id missing');
    assert.strictEqual(Number(variant.replenishment_quantity || 0), 0);
    assert.strictEqual(Number(variant.replenishment_po_count || 0), 0);

    const po = await apiRequest('/api/manage/purchase-orders', {
      bearerToken: token,
      method: 'POST',
      body: {
        remark: `Replenishment PO ${seed}`,
        allocation_method: 'by_quantity',
      },
      expectedStatus: 201,
    });
    const poId = po.json?.data?.id;
    assert.ok(poId, 'purchase order id missing');

    await apiRequest(`/api/manage/purchase-orders/${poId}/items`, {
      bearerToken: token,
      method: 'POST',
      body: {
        items: [
          {
            product_id: productId,
            variant_id: variant.id,
            quantity: 7,
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

    const detailOrdered = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variantOrdered = (detailOrdered.json?.data?.variants || []).find((v) => v.id === variant.id);
    assert.ok(variantOrdered);
    assert.strictEqual(Number(variantOrdered.replenishment_quantity || 0), 7);
    assert.strictEqual(Number(variantOrdered.replenishment_po_count || 0), 1);

    await apiRequest(`/api/manage/purchase-orders/${poId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'shipping' },
      expectedStatus: 200,
    });

    const detailShipping = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variantShipping = (detailShipping.json?.data?.variants || []).find((v) => v.id === variant.id);
    assert.ok(variantShipping);
    assert.strictEqual(Number(variantShipping.replenishment_quantity || 0), 7);
    assert.strictEqual(Number(variantShipping.replenishment_po_count || 0), 1);

    const poDetail = await apiRequest(`/api/manage/purchase-orders/${poId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const poItemId = poDetail.json?.data?.items?.[0]?.id;
    assert.ok(poItemId, 'purchase order item id missing');

    await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-receipt`,
      },
      body: {
        items: [
          {
            purchase_order_item_id: poItemId,
            received_qty: 7,
            note: 'replenishment lifecycle receipt',
          },
        ],
      },
      expectedStatus: 201,
    });

    await apiRequest(`/api/manage/purchase-orders/${poId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'arrived' },
      expectedStatus: 200,
    });

    const detailArrived = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variantArrived = (detailArrived.json?.data?.variants || []).find((v) => v.id === variant.id);
    assert.ok(variantArrived);
    assert.strictEqual(Number(variantArrived.replenishment_quantity || 0), 0);
    assert.strictEqual(Number(variantArrived.replenishment_po_count || 0), 0);
  });
});

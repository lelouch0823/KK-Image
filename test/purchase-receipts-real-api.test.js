import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
  waitFor,
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
      name: `Receipt Sales ${seed}`,
      store: 'Receipt Flow Store',
      phone: `13${String(Date.now()).slice(-9)}`,
      password: '123456',
    },
    expectedStatus: 201,
  });
  return created.json?.data?.id;
}

async function createWorkflowProduct(token, seed, { stockQuantity = 0 } = {}) {
  const createdProduct = await apiRequest('/api/manage/products', {
    bearerToken: token,
    method: 'POST',
    body: {
      name: `Receipt Flow Product ${seed}`,
      spu: `RCP-${seed}`,
      currency: 'CNY',
      brand: 'KK',
      category: 'Workflow',
      dimensions: [{ name: 'Color', values: ['Gray'] }],
      variants: [
        {
          sku: `RCP-GRAY-${seed}`,
          price: 99,
          cost_price: 55,
          stock_quantity: stockQuantity,
          alert_threshold: 1,
          status: 'active',
          options_values: { Color: 'Gray' },
        },
      ],
    },
    expectedStatus: 201,
  });
  const productId = createdProduct.json?.data?.id;
  assert.ok(productId, 'product id missing');

  const detail = await apiRequest(`/api/manage/products/${productId}`, {
    bearerToken: token,
    expectedStatus: 200,
  });
  const variantId = detail.json?.data?.variants?.[0]?.id;
  assert.ok(variantId, 'variant id missing');

  return { productId, variantId };
}

async function createConfirmedOrder(token, {
  seed,
  salespersonId,
  productId,
  variantId,
  quantity,
}) {
  const created = await apiRequest('/api/manage/orders', {
    bearerToken: token,
    method: 'POST',
    body: {
      productName: `Receipt Flow Product ${seed}`,
      salespersonId,
      productId,
      variantId,
      quantity,
      fileIds: [],
    },
    expectedStatus: 201,
  });
  const orderId = created.json?.data?.id;
  assert.ok(orderId, 'order id missing');

  await apiRequest(`/api/manage/orders/${orderId}/status`, {
    bearerToken: token,
    method: 'PATCH',
    body: { status: 'confirmed' },
    expectedStatus: 200,
  });

  return orderId;
}

async function createPurchaseOrderFromOrders(token, orderIds, seed) {
  const created = await apiRequest('/api/manage/purchase-orders/from-orders', {
    bearerToken: token,
    method: 'POST',
    body: {
      order_ids: orderIds,
      remark: `Receipt workflow ${seed}`,
      allocation_method: 'by_quantity',
    },
    expectedStatus: 201,
  });
  const poId = created.json?.data?.id;
  assert.ok(poId, 'purchase order id missing');
  return poId;
}

async function getOrderDetail(token, orderId) {
  const detail = await apiRequest(`/api/manage/orders/${orderId}`, {
    bearerToken: token,
    expectedStatus: 200,
  });
  return detail.json?.data;
}

async function getPurchaseOrderDetail(token, poId) {
  const detail = await apiRequest(`/api/manage/purchase-orders/${poId}`, {
    bearerToken: token,
    expectedStatus: 200,
  });
  return detail.json?.data;
}

async function getVariantDetail(token, productId, variantId) {
  const detail = await apiRequest(`/api/manage/products/${productId}`, {
    bearerToken: token,
    expectedStatus: 200,
  });
  const variant = (detail.json?.data?.variants || []).find((item) => item.id === variantId);
  assert.ok(variant, 'variant missing');
  return variant;
}

describeIfRealApi('Purchase Receipts Real API Workflow', function () {
  this.timeout(180000);

  it('supports partially received -> received progression across two receipt commands and keeps idempotency stable', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('receipt-partial');
    const salespersonId = await ensureSalespersonId(token, seed);
    const { productId, variantId } = await createWorkflowProduct(token, seed, { stockQuantity: 0 });
    const orderId = await createConfirmedOrder(token, {
      seed,
      salespersonId,
      productId,
      variantId,
      quantity: 5,
    });
    const poId = await createPurchaseOrderFromOrders(token, [orderId], seed);

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

    const poBeforeReceipt = await getPurchaseOrderDetail(token, poId);
    const poItemId = poBeforeReceipt?.items?.[0]?.id;
    assert.ok(poItemId, 'purchase order item id missing');

    const firstReceipt = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-receipt-1`,
      },
      body: {
        items: [
          {
            purchase_order_item_id: poItemId,
            received_qty: 2,
            note: 'first partial receipt',
          },
        ],
      },
      expectedStatus: 201,
    });
    const firstReceiptId = firstReceipt.json?.data?.receipts?.[0]?.id;
    assert.ok(firstReceiptId, 'first receipt id missing');

    const replayedFirstReceipt = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-receipt-1`,
      },
      body: {
        items: [
          {
            purchase_order_item_id: poItemId,
            received_qty: 2,
            note: 'first partial receipt',
          },
        ],
      },
      expectedStatus: 201,
    });
    assert.strictEqual(
      replayedFirstReceipt.json?.data?.receipts?.[0]?.id,
      firstReceiptId,
      'receipt replay should return the original receipt id'
    );

    await waitFor(async () => {
      const order = await getOrderDetail(token, orderId);
      assert.strictEqual(order?.procurementStatus, 'partially_arrived');
      assert.strictEqual(order?.lines?.[0]?.receivedQuantity, 2);

      const po = await getPurchaseOrderDetail(token, poId);
      assert.strictEqual(Number(po?.items?.[0]?.received_qty || 0), 2);
      assert.strictEqual(po?.items?.[0]?.display_status, 'partially_received');

      const variant = await getVariantDetail(token, productId, variantId);
      assert.strictEqual(Number(variant.stock_quantity || 0), 2);
      return { order, po, variant };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'partial receipt projection did not converge',
    });

    const secondReceipt = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-receipt-2`,
      },
      body: {
        items: [
          {
            purchase_order_item_id: poItemId,
            received_qty: 3,
            note: 'second partial receipt',
          },
        ],
      },
      expectedStatus: 201,
    });
    assert.ok(secondReceipt.json?.data?.receipts?.[0]?.id, 'second receipt id missing');

    await waitFor(async () => {
      const order = await getOrderDetail(token, orderId);
      assert.strictEqual(order?.procurementStatus, 'arrived');
      assert.strictEqual(order?.lines?.[0]?.receivedQuantity, 5);

      const po = await getPurchaseOrderDetail(token, poId);
      assert.strictEqual(Number(po?.items?.[0]?.received_qty || 0), 5);
      assert.strictEqual(po?.items?.[0]?.display_status, 'received');

      const variant = await getVariantDetail(token, productId, variantId);
      assert.strictEqual(Number(variant.stock_quantity || 0), 5);
      return { order, po, variant };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'full receipt projection did not converge',
    });

    await apiRequest(`/api/manage/purchase-orders/${poId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'arrived' },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const variant = await getVariantDetail(token, productId, variantId);
      assert.strictEqual(Number(variant.stock_quantity || 0), 5);
      return variant;
    }, {
      timeoutMs: 10000,
      intervalMs: 500,
      onTimeoutMessage: 'purchase-order arrived should not increment stock after receipts',
    });
  });

  it('reverses a recorded receipt and rolls order + inventory projections back through the real API', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('receipt-reversal');
    const salespersonId = await ensureSalespersonId(token, seed);
    const { productId, variantId } = await createWorkflowProduct(token, seed, { stockQuantity: 0 });
    const orderId = await createConfirmedOrder(token, {
      seed,
      salespersonId,
      productId,
      variantId,
      quantity: 4,
    });
    const poId = await createPurchaseOrderFromOrders(token, [orderId], seed);

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

    const poBeforeReceipt = await getPurchaseOrderDetail(token, poId);
    const poItemId = poBeforeReceipt?.items?.[0]?.id;
    assert.ok(poItemId, 'purchase order item id missing');

    const receipt = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-receipt-full`,
      },
      body: {
        items: [
          {
            purchase_order_item_id: poItemId,
            received_qty: 4,
            note: 'receipt to reverse',
          },
        ],
      },
      expectedStatus: 201,
    });
    const receiptId = receipt.json?.data?.receipts?.[0]?.id;
    assert.ok(receiptId, 'receipt id missing');

    await waitFor(async () => {
      const order = await getOrderDetail(token, orderId);
      const variant = await getVariantDetail(token, productId, variantId);
      assert.strictEqual(order?.procurementStatus, 'arrived');
      assert.strictEqual(order?.lines?.[0]?.receivedQuantity, 4);
      assert.strictEqual(Number(variant.stock_quantity || 0), 4);
      return { order, variant };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'receipt baseline did not converge before reversal',
    });

    const reversal = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts/${receiptId}/reversal`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-reversal-1`,
      },
      body: { reason: 'real api rollback verification' },
      expectedStatus: 201,
    });
    const reversalId = reversal.json?.data?.reversal_id;
    assert.ok(reversalId, 'reversal id missing');

    const replayedReversal = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts/${receiptId}/reversal`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-reversal-1`,
      },
      body: { reason: 'real api rollback verification' },
      expectedStatus: 201,
    });
    assert.strictEqual(replayedReversal.json?.data?.reversal_id, reversalId);

    await waitFor(async () => {
      const order = await getOrderDetail(token, orderId);
      assert.strictEqual(order?.procurementStatus, 'ordered');
      assert.strictEqual(order?.lines?.[0]?.receivedQuantity, 0);

      const po = await getPurchaseOrderDetail(token, poId);
      assert.strictEqual(Number(po?.items?.[0]?.received_qty || 0), 0);
      assert.strictEqual(po?.items?.[0]?.display_status, 'open');

      const variant = await getVariantDetail(token, productId, variantId);
      assert.strictEqual(Number(variant.stock_quantity || 0), 0);
      return { order, po, variant };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'receipt reversal projection did not converge',
    });
  });

  it('rejects over-receipt beyond remaining quantity and keeps partial projections unchanged', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('receipt-guard');
    const salespersonId = await ensureSalespersonId(token, seed);
    const { productId, variantId } = await createWorkflowProduct(token, seed, { stockQuantity: 0 });
    const orderId = await createConfirmedOrder(token, {
      seed,
      salespersonId,
      productId,
      variantId,
      quantity: 3,
    });
    const poId = await createPurchaseOrderFromOrders(token, [orderId], seed);

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

    const poBeforeReceipt = await getPurchaseOrderDetail(token, poId);
    const poItemId = poBeforeReceipt?.items?.[0]?.id;
    assert.ok(poItemId, 'purchase order item id missing');

    await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      body: {
        items: [
          {
            purchase_order_item_id: poItemId,
            received_qty: 2,
            note: 'baseline receipt',
          },
        ],
      },
      expectedStatus: 201,
    });

    await waitFor(async () => {
      const order = await getOrderDetail(token, orderId);
      const po = await getPurchaseOrderDetail(token, poId);
      const variant = await getVariantDetail(token, productId, variantId);
      assert.strictEqual(order?.procurementStatus, 'partially_arrived');
      assert.strictEqual(Number(po?.items?.[0]?.received_qty || 0), 2);
      assert.strictEqual(Number(variant.stock_quantity || 0), 2);
      return { order, po, variant };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'baseline partial receipt did not converge before over-receipt guard',
    });

    const rejected = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      body: {
        items: [
          {
            purchase_order_item_id: poItemId,
            received_qty: 2,
            note: 'should be rejected',
          },
        ],
      },
      expectedStatus: 400,
    });
    assert.match(String(rejected.json?.error || ''), /剩余可收数量|超过/i);

    const orderAfterReject = await getOrderDetail(token, orderId);
    const poAfterReject = await getPurchaseOrderDetail(token, poId);
    const variantAfterReject = await getVariantDetail(token, productId, variantId);
    assert.strictEqual(orderAfterReject?.procurementStatus, 'partially_arrived');
    assert.strictEqual(Number(poAfterReject?.items?.[0]?.received_qty || 0), 2);
    assert.strictEqual(poAfterReject?.items?.[0]?.display_status, 'partially_received');
    assert.strictEqual(Number(variantAfterReject.stock_quantity || 0), 2);
  });

  it('rejects a second reversal under a different idempotency key and preserves the rolled-back state', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('reversal-guard');
    const salespersonId = await ensureSalespersonId(token, seed);
    const { productId, variantId } = await createWorkflowProduct(token, seed, { stockQuantity: 0 });
    const orderId = await createConfirmedOrder(token, {
      seed,
      salespersonId,
      productId,
      variantId,
      quantity: 2,
    });
    const poId = await createPurchaseOrderFromOrders(token, [orderId], seed);

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

    const poBeforeReceipt = await getPurchaseOrderDetail(token, poId);
    const poItemId = poBeforeReceipt?.items?.[0]?.id;
    assert.ok(poItemId, 'purchase order item id missing');

    const receipt = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      body: {
        items: [
          {
            purchase_order_item_id: poItemId,
            received_qty: 2,
            note: 'receipt before duplicate reversal',
          },
        ],
      },
      expectedStatus: 201,
    });
    const receiptId = receipt.json?.data?.receipts?.[0]?.id;
    assert.ok(receiptId, 'receipt id missing');

    await apiRequest(`/api/manage/purchase-orders/${poId}/receipts/${receiptId}/reversal`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-reversal-first`,
      },
      body: { reason: 'first reversal' },
      expectedStatus: 201,
    });

    await waitFor(async () => {
      const order = await getOrderDetail(token, orderId);
      const po = await getPurchaseOrderDetail(token, poId);
      const variant = await getVariantDetail(token, productId, variantId);
      assert.strictEqual(order?.procurementStatus, 'ordered');
      assert.strictEqual(Number(po?.items?.[0]?.received_qty || 0), 0);
      assert.strictEqual(Number(variant.stock_quantity || 0), 0);
      return { order, po, variant };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'baseline reversal did not converge before duplicate reversal guard',
    });

    const duplicateReject = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts/${receiptId}/reversal`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-reversal-second`,
      },
      body: { reason: 'second reversal should fail' },
      expectedStatus: 400,
    });
    assert.match(String(duplicateReject.json?.error || ''), /已冲销|重复冲销/i);

    const orderAfterReject = await getOrderDetail(token, orderId);
    const poAfterReject = await getPurchaseOrderDetail(token, poId);
    const variantAfterReject = await getVariantDetail(token, productId, variantId);
    assert.strictEqual(orderAfterReject?.procurementStatus, 'ordered');
    assert.strictEqual(Number(poAfterReject?.items?.[0]?.received_qty || 0), 0);
    assert.strictEqual(poAfterReject?.items?.[0]?.display_status, 'open');
    assert.strictEqual(Number(variantAfterReject.stock_quantity || 0), 0);
  });
});

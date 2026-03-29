import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  getBaseUrl,
  uniqueSeed,
  waitFor,
  sleep,
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

async function createDraftPurchaseOrder(token, seed) {
  const created = await apiRequest('/api/manage/purchase-orders', {
    bearerToken: token,
    method: 'POST',
    body: {
      remark: `Draft receipt workflow ${seed}`,
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

async function rawJsonRequest(path, {
  method = 'GET',
  bearerToken,
  headers = {},
  body,
} = {}) {
  let response = null;
  let json = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch(`${getBaseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    try {
      json = await response.json();
    } catch {
      json = null;
    }

    if (response.status !== 429) {
      break;
    }

    const retryAfter = Number(response.headers.get('retry-after') || json?.retryAfter || 0);
    await sleep(retryAfter > 0 ? retryAfter * 1000 : 300 * (attempt + 1));
  }

  return {
    status: response.status,
    json,
  };
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

  it('rejects reusing the same receipt idempotency key with a different payload and preserves the original receipt state', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('receipt-idem-mismatch');
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

    const idemKey = `${seed}-receipt-key`;
    const initialReceipt = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': idemKey,
      },
      body: {
        items: [
          {
            purchase_order_item_id: poItemId,
            received_qty: 1,
            note: 'original payload',
          },
        ],
      },
      expectedStatus: 201,
    });
    const originalReceiptId = initialReceipt.json?.data?.receipts?.[0]?.id;
    assert.ok(originalReceiptId, 'original receipt id missing');

    const mismatchReject = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': idemKey,
      },
      body: {
        items: [
          {
            purchase_order_item_id: poItemId,
            received_qty: 2,
            note: 'changed payload',
          },
        ],
      },
      expectedStatus: 400,
    });
    assert.match(String(mismatchReject.json?.error || ''), /幂等键|不同的收货请求/i);

    const replay = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': idemKey,
      },
      body: {
        items: [
          {
            purchase_order_item_id: poItemId,
            received_qty: 1,
            note: 'original payload',
          },
        ],
      },
      expectedStatus: 201,
    });
    assert.strictEqual(replay.json?.data?.receipts?.[0]?.id, originalReceiptId);

    await waitFor(async () => {
      const order = await getOrderDetail(token, orderId);
      const po = await getPurchaseOrderDetail(token, poId);
      const variant = await getVariantDetail(token, productId, variantId);
      assert.strictEqual(order?.procurementStatus, 'partially_arrived');
      assert.strictEqual(order?.lines?.[0]?.receivedQuantity, 1);
      assert.strictEqual(Number(po?.items?.[0]?.received_qty || 0), 1);
      assert.strictEqual(po?.items?.[0]?.display_status, 'partially_received');
      assert.strictEqual(Number(variant.stock_quantity || 0), 1);
      return { order, po, variant };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'idempotency mismatch should keep the original receipt state intact',
    });
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

  it('updates only the targeted linked order when one purchase order contains multiple order-backed items for the same variant', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('multi-order');
    const salespersonId = await ensureSalespersonId(token, seed);
    const { productId, variantId } = await createWorkflowProduct(token, seed, { stockQuantity: 0 });
    const orderId1 = await createConfirmedOrder(token, {
      seed,
      salespersonId,
      productId,
      variantId,
      quantity: 2,
    });
    const orderId2 = await createConfirmedOrder(token, {
      seed,
      salespersonId,
      productId,
      variantId,
      quantity: 3,
    });
    const poId = await createPurchaseOrderFromOrders(token, [orderId1, orderId2], seed);

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
    const firstItem = (poBeforeReceipt?.items || []).find((item) => item.pre_order_id === orderId1);
    const secondItem = (poBeforeReceipt?.items || []).find((item) => item.pre_order_id === orderId2);
    assert.ok(firstItem?.id, 'first linked purchase order item missing');
    assert.ok(secondItem?.id, 'second linked purchase order item missing');

    await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-first-order-receipt`,
      },
      body: {
        items: [
          {
            purchase_order_item_id: firstItem.id,
            received_qty: 2,
            note: 'first linked order receipt',
          },
        ],
      },
      expectedStatus: 201,
    });

    await waitFor(async () => {
      const order1 = await getOrderDetail(token, orderId1);
      const order2 = await getOrderDetail(token, orderId2);
      const po = await getPurchaseOrderDetail(token, poId);
      const variant = await getVariantDetail(token, productId, variantId);
      const poItem1 = (po?.items || []).find((item) => item.id === firstItem.id);
      const poItem2 = (po?.items || []).find((item) => item.id === secondItem.id);

      assert.strictEqual(order1?.procurementStatus, 'arrived');
      assert.strictEqual(order1?.lines?.[0]?.receivedQuantity, 2);
      assert.strictEqual(order2?.procurementStatus, 'ordered');
      assert.strictEqual(order2?.lines?.[0]?.receivedQuantity, 0);
      assert.strictEqual(Number(poItem1?.received_qty || 0), 2);
      assert.strictEqual(poItem1?.display_status, 'received');
      assert.strictEqual(Number(poItem2?.received_qty || 0), 0);
      assert.strictEqual(poItem2?.display_status, 'open');
      assert.strictEqual(Number(variant.stock_quantity || 0), 2);
      return { order1, order2, po, variant };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'first linked order receipt did not converge independently',
    });

    await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-second-order-receipt`,
      },
      body: {
        items: [
          {
            purchase_order_item_id: secondItem.id,
            received_qty: 3,
            note: 'second linked order receipt',
          },
        ],
      },
      expectedStatus: 201,
    });

    await waitFor(async () => {
      const order1 = await getOrderDetail(token, orderId1);
      const order2 = await getOrderDetail(token, orderId2);
      const po = await getPurchaseOrderDetail(token, poId);
      const variant = await getVariantDetail(token, productId, variantId);
      const poItem1 = (po?.items || []).find((item) => item.id === firstItem.id);
      const poItem2 = (po?.items || []).find((item) => item.id === secondItem.id);

      assert.strictEqual(order1?.procurementStatus, 'arrived');
      assert.strictEqual(order2?.procurementStatus, 'arrived');
      assert.strictEqual(order2?.lines?.[0]?.receivedQuantity, 3);
      assert.strictEqual(Number(poItem1?.received_qty || 0), 2);
      assert.strictEqual(Number(poItem2?.received_qty || 0), 3);
      assert.strictEqual(poItem2?.display_status, 'received');
      assert.strictEqual(Number(variant.stock_quantity || 0), 5);
      return { order1, order2, po, variant };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'second linked order receipt did not converge independently',
    });
  });

  it('applies one batch receipt command across multiple variants in the same purchase order', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('multi-item');
    const productA = await createWorkflowProduct(token, `${seed}-a`, { stockQuantity: 0 });
    const productB = await createWorkflowProduct(token, `${seed}-b`, { stockQuantity: 0 });
    const poId = await createDraftPurchaseOrder(token, seed);

    await apiRequest(`/api/manage/purchase-orders/${poId}/items`, {
      bearerToken: token,
      method: 'POST',
      body: {
        items: [
          {
            product_id: productA.productId,
            variant_id: productA.variantId,
            quantity: 2,
            unit_cost: 55,
          },
          {
            product_id: productB.productId,
            variant_id: productB.variantId,
            quantity: 4,
            unit_cost: 66,
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

    const poBeforeReceipt = await getPurchaseOrderDetail(token, poId);
    const itemA = (poBeforeReceipt?.items || []).find((item) => item.variant_id === productA.variantId);
    const itemB = (poBeforeReceipt?.items || []).find((item) => item.variant_id === productB.variantId);
    assert.ok(itemA?.id, 'first variant purchase item missing');
    assert.ok(itemB?.id, 'second variant purchase item missing');

    const batchReceipt = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-batch-receipt`,
      },
      body: {
        items: [
          {
            purchase_order_item_id: itemA.id,
            received_qty: 2,
            note: 'batch receipt item a',
          },
          {
            purchase_order_item_id: itemB.id,
            received_qty: 4,
            note: 'batch receipt item b',
          },
        ],
      },
      expectedStatus: 201,
    });
    const receiptIds = (batchReceipt.json?.data?.receipts || []).map((item) => item.id).filter(Boolean);
    assert.strictEqual(receiptIds.length, 2, 'batch receipt should create two receipt rows');

    const replayedBatch = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-batch-receipt`,
      },
      body: {
        items: [
          {
            purchase_order_item_id: itemA.id,
            received_qty: 2,
            note: 'batch receipt item a',
          },
          {
            purchase_order_item_id: itemB.id,
            received_qty: 4,
            note: 'batch receipt item b',
          },
        ],
      },
      expectedStatus: 201,
    });
    const replayedReceiptIds = (replayedBatch.json?.data?.receipts || []).map((item) => item.id).filter(Boolean);
    assert.deepStrictEqual(replayedReceiptIds, receiptIds, 'batch receipt replay should return the same receipt ids');

    await waitFor(async () => {
      const po = await getPurchaseOrderDetail(token, poId);
      const poItemA = (po?.items || []).find((item) => item.id === itemA.id);
      const poItemB = (po?.items || []).find((item) => item.id === itemB.id);
      const variantA = await getVariantDetail(token, productA.productId, productA.variantId);
      const variantB = await getVariantDetail(token, productB.productId, productB.variantId);

      assert.strictEqual(Number(poItemA?.received_qty || 0), 2);
      assert.strictEqual(poItemA?.display_status, 'received');
      assert.strictEqual(Number(poItemB?.received_qty || 0), 4);
      assert.strictEqual(poItemB?.display_status, 'received');
      assert.strictEqual(Number(variantA.stock_quantity || 0), 2);
      assert.strictEqual(Number(variantB.stock_quantity || 0), 4);
      return { po, variantA, variantB };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'batch receipt across multiple variants did not converge',
    });
  });

  it('reverses only the targeted receipt inside a multi-item purchase order and leaves sibling inventory untouched', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('multi-item-reversal');
    const productA = await createWorkflowProduct(token, `${seed}-a`, { stockQuantity: 0 });
    const productB = await createWorkflowProduct(token, `${seed}-b`, { stockQuantity: 0 });
    const poId = await createDraftPurchaseOrder(token, seed);

    await apiRequest(`/api/manage/purchase-orders/${poId}/items`, {
      bearerToken: token,
      method: 'POST',
      body: {
        items: [
          {
            product_id: productA.productId,
            variant_id: productA.variantId,
            quantity: 2,
            unit_cost: 55,
          },
          {
            product_id: productB.productId,
            variant_id: productB.variantId,
            quantity: 4,
            unit_cost: 66,
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

    const poBeforeReceipt = await getPurchaseOrderDetail(token, poId);
    const itemA = (poBeforeReceipt?.items || []).find((item) => item.variant_id === productA.variantId);
    const itemB = (poBeforeReceipt?.items || []).find((item) => item.variant_id === productB.variantId);
    assert.ok(itemA?.id, 'first variant purchase item missing');
    assert.ok(itemB?.id, 'second variant purchase item missing');

    const batchReceipt = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-batch-receipt`,
      },
      body: {
        items: [
          {
            purchase_order_item_id: itemA.id,
            received_qty: 2,
            note: 'batch receipt item a',
          },
          {
            purchase_order_item_id: itemB.id,
            received_qty: 4,
            note: 'batch receipt item b',
          },
        ],
      },
      expectedStatus: 201,
    });
    const receiptA = (batchReceipt.json?.data?.receipts || []).find((item) => item.purchase_order_item_id === itemA.id);
    assert.ok(receiptA?.id, 'targeted receipt id missing');

    await waitFor(async () => {
      const po = await getPurchaseOrderDetail(token, poId);
      const variantA = await getVariantDetail(token, productA.productId, productA.variantId);
      const variantB = await getVariantDetail(token, productB.productId, productB.variantId);
      const poItemA = (po?.items || []).find((item) => item.id === itemA.id);
      const poItemB = (po?.items || []).find((item) => item.id === itemB.id);
      assert.strictEqual(Number(poItemA?.received_qty || 0), 2);
      assert.strictEqual(Number(poItemB?.received_qty || 0), 4);
      assert.strictEqual(Number(variantA.stock_quantity || 0), 2);
      assert.strictEqual(Number(variantB.stock_quantity || 0), 4);
      return { po, variantA, variantB };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'multi-item receipt baseline did not converge before targeted reversal',
    });

    await apiRequest(`/api/manage/purchase-orders/${poId}/receipts/${receiptA.id}/reversal`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-reversal-item-a`,
      },
      body: { reason: 'reverse only first receipt' },
      expectedStatus: 201,
    });

    await waitFor(async () => {
      const po = await getPurchaseOrderDetail(token, poId);
      const variantA = await getVariantDetail(token, productA.productId, productA.variantId);
      const variantB = await getVariantDetail(token, productB.productId, productB.variantId);
      const poItemA = (po?.items || []).find((item) => item.id === itemA.id);
      const poItemB = (po?.items || []).find((item) => item.id === itemB.id);

      assert.strictEqual(Number(poItemA?.received_qty || 0), 0);
      assert.strictEqual(poItemA?.display_status, 'open');
      assert.strictEqual(Number(poItemB?.received_qty || 0), 4);
      assert.strictEqual(poItemB?.display_status, 'received');
      assert.strictEqual(Number(variantA.stock_quantity || 0), 0);
      assert.strictEqual(Number(variantB.stock_quantity || 0), 4);
      return { po, variantA, variantB };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'targeted reversal should leave sibling receipt state intact',
    });
  });

  it('does not over-apply concurrent receipt commands against the same purchase item', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('concurrent-receipt');
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

    const requestBody = {
      items: [
        {
          purchase_order_item_id: poItemId,
          received_qty: 2,
          note: 'concurrent receipt race',
        },
      ],
    };

    const [first, second] = await Promise.all([
      rawJsonRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
        bearerToken: token,
        method: 'POST',
        headers: { 'Idempotency-Key': `${seed}-concurrent-a` },
        body: requestBody,
      }),
      rawJsonRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
        bearerToken: token,
        method: 'POST',
        headers: { 'Idempotency-Key': `${seed}-concurrent-b` },
        body: requestBody,
      }),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    assert.deepStrictEqual(statuses, [201, 400]);

    await waitFor(async () => {
      const order = await getOrderDetail(token, orderId);
      const po = await getPurchaseOrderDetail(token, poId);
      const variant = await getVariantDetail(token, productId, variantId);
      assert.strictEqual(order?.procurementStatus, 'partially_arrived');
      assert.strictEqual(order?.lines?.[0]?.receivedQuantity, 2);
      assert.strictEqual(Number(po?.items?.[0]?.received_qty || 0), 2);
      assert.strictEqual(po?.items?.[0]?.display_status, 'partially_received');
      assert.strictEqual(Number(variant.stock_quantity || 0), 2);
      return { order, po, variant };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'concurrent receipt guard did not converge',
    });
  });

  it('deduplicates concurrent duplicate receipt commands and replays cleanly after commit', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('concurrent-idem');
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

    const requestBody = {
      items: [
        {
          purchase_order_item_id: poItemId,
          received_qty: 2,
          note: 'concurrent idempotent receipt',
        },
      ],
    };

    const idemKey = `${seed}-same-key`;
    const [first, second] = await Promise.all([
      rawJsonRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
        bearerToken: token,
        method: 'POST',
        headers: { 'Idempotency-Key': idemKey },
        body: requestBody,
      }),
      rawJsonRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
        bearerToken: token,
        method: 'POST',
        headers: { 'Idempotency-Key': idemKey },
        body: requestBody,
      }),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    assert.ok(
      JSON.stringify(statuses) === JSON.stringify([201, 201]) || JSON.stringify(statuses) === JSON.stringify([201, 400]),
      `unexpected concurrent idempotent receipt statuses: ${JSON.stringify(statuses)}`
    );

    const receiptIds = [first, second]
      .filter((result) => result.status === 201)
      .map((result) => result.json?.data?.receipts?.[0]?.id)
      .filter(Boolean);
    assert.ok(receiptIds.length >= 1, 'at least one concurrent idempotent receipt should succeed');
    assert.strictEqual(new Set(receiptIds).size, 1, 'concurrent duplicate idempotent receipts should resolve to one receipt id');
    const receiptId = receiptIds[0];

    const replay = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: { 'Idempotency-Key': idemKey },
      body: requestBody,
      expectedStatus: 201,
    });
    assert.strictEqual(replay.json?.data?.receipts?.[0]?.id, receiptId);

    await waitFor(async () => {
      const order = await getOrderDetail(token, orderId);
      const po = await getPurchaseOrderDetail(token, poId);
      const variant = await getVariantDetail(token, productId, variantId);
      assert.strictEqual(order?.procurementStatus, 'arrived');
      assert.strictEqual(order?.lines?.[0]?.receivedQuantity, 2);
      assert.strictEqual(Number(po?.items?.[0]?.received_qty || 0), 2);
      assert.strictEqual(Number(variant.stock_quantity || 0), 2);
      return { order, po, variant };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'concurrent idempotent receipt replay did not converge',
    });
  });
});

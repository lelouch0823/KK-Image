import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
  waitFor,
} from './utils/manage-products-real-api.js';
import {
  ensureSalespersonId,
  createWorkflowProduct,
  createConfirmedOrder,
  createPurchaseOrderFromOrders,
  transitionPurchaseOrderToShipping,
  getOrderDetail,
  getPurchaseOrderDetail,
  getVariantDetail,
} from './utils/order-procurement-real-api.js';

function findSuggestion(payload, variantId) {
  return (payload?.data || []).find((item) => item.variant_id === variantId);
}

describeIfRealApi('Order Line Fulfillment Real API Workflow', function () {
  this.timeout(180000);

  it('reserves, releases, and ships only the targeted same-variant line after its own receipt arrives', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('line-isolation');
    const salespersonId = await ensureSalespersonId(token, seed);
    const { productId, variantId, productName } = await createWorkflowProduct(token, seed, {
      stockQuantity: 0,
    });
    const orderId1 = await createConfirmedOrder(token, {
      seed: `${seed}-a`,
      salespersonId,
      productId,
      variantId,
      productName,
      quantity: 2,
    });
    const orderId2 = await createConfirmedOrder(token, {
      seed: `${seed}-b`,
      salespersonId,
      productId,
      variantId,
      productName,
      quantity: 3,
    });
    const poId = await createPurchaseOrderFromOrders(token, [orderId1, orderId2], seed);

    await transitionPurchaseOrderToShipping(token, poId);

    const poBeforeReceipt = await getPurchaseOrderDetail(token, poId);
    const firstItem = (poBeforeReceipt?.items || []).find((item) => item.pre_order_id === orderId1);
    const secondItem = (poBeforeReceipt?.items || []).find((item) => item.pre_order_id === orderId2);
    assert.ok(firstItem?.id, 'targeted purchase item missing');
    assert.ok(secondItem?.id, 'sibling purchase item missing');

    await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-receipt-order-1`,
      },
      body: {
        items: [
          {
            purchase_order_item_id: firstItem.id,
            received_qty: 2,
            note: 'targeted same-variant receipt',
          },
        ],
      },
      expectedStatus: 201,
    });

    const receivedOrder = await waitFor(async () => {
      const order1 = await getOrderDetail(token, orderId1);
      const order2 = await getOrderDetail(token, orderId2);
      const variant = await getVariantDetail(token, productId, variantId);
      const line1 = order1?.lines?.[0];
      const line2 = order2?.lines?.[0];
      assert.ok(line1?.id, 'targeted order line missing');
      assert.ok(line2?.id, 'sibling order line missing');
      assert.strictEqual(order1?.procurementStatus, 'arrived');
      assert.strictEqual(order2?.procurementStatus, 'ordered');
      assert.strictEqual(line1?.receivedQuantity, 2);
      assert.strictEqual(line2?.receivedQuantity, 0);
      assert.strictEqual(Number(variant.stock_quantity || 0), 2);
      return {
        order1,
        order2,
        line1,
        line2,
        variant,
        siblingDisplayStatus: line2?.displayStatus,
      };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'same-variant targeted receipt did not converge',
    });

    await apiRequest(`/api/manage/orders/${orderId1}/lines/${receivedOrder.line1.id}/reserve`, {
      bearerToken: token,
      method: 'POST',
      body: { quantity: 2 },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const order1 = await getOrderDetail(token, orderId1);
      const order2 = await getOrderDetail(token, orderId2);
      assert.strictEqual(order1?.lines?.[0]?.reservedQuantity, 2);
      assert.strictEqual(order2?.lines?.[0]?.reservedQuantity, 0);
      return { order1, order2 };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'targeted line reserve did not converge independently',
    });

    await apiRequest(`/api/manage/orders/${orderId1}/lines/${receivedOrder.line1.id}/release`, {
      bearerToken: token,
      method: 'POST',
      body: { quantity: 1 },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const order1 = await getOrderDetail(token, orderId1);
      assert.strictEqual(order1?.lines?.[0]?.reservedQuantity, 1);
      return order1;
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'targeted line release did not converge',
    });

    await apiRequest(`/api/manage/orders/${orderId1}/lines/${receivedOrder.line1.id}/ship`, {
      bearerToken: token,
      method: 'POST',
      body: { quantity: 1 },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const order1 = await getOrderDetail(token, orderId1);
      const order2 = await getOrderDetail(token, orderId2);
      const variant = await getVariantDetail(token, productId, variantId);
      const po = await getPurchaseOrderDetail(token, poId);
      const updatedFirstItem = (po?.items || []).find((item) => item.id === firstItem.id);
      const updatedSecondItem = (po?.items || []).find((item) => item.id === secondItem.id);

      assert.strictEqual(order1?.lines?.[0]?.reservedQuantity, 0);
      assert.strictEqual(order1?.lines?.[0]?.shippedQuantity, 1);
      assert.strictEqual(order1?.lines?.[0]?.displayStatus, 'partially_shipped');
      assert.strictEqual(order2?.lines?.[0]?.reservedQuantity, 0);
      assert.strictEqual(order2?.lines?.[0]?.shippedQuantity, 0);
      assert.strictEqual(order2?.lines?.[0]?.displayStatus, receivedOrder.siblingDisplayStatus);
      assert.strictEqual(Number(updatedFirstItem?.received_qty || 0), 2);
      assert.strictEqual(Number(updatedSecondItem?.received_qty || 0), 0);
      assert.strictEqual(Number(variant.stock_quantity || 0), 1);
      return { order1, order2, variant, po };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'targeted line ship did not stay isolated from sibling same-variant order',
    });
  });

  it('rejects reserve, release, and ship commands that exceed the current line state and keeps projections unchanged', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('line-guards');
    const salespersonId = await ensureSalespersonId(token, seed);
    const { productId, variantId, productName } = await createWorkflowProduct(token, seed, {
      stockQuantity: 0,
    });
    const orderId = await createConfirmedOrder(token, {
      seed,
      salespersonId,
      productId,
      variantId,
      productName,
      quantity: 4,
    });
    const poId = await createPurchaseOrderFromOrders(token, [orderId], seed);

    await transitionPurchaseOrderToShipping(token, poId);

    const poBeforeReceipt = await getPurchaseOrderDetail(token, poId);
    const poItemId = poBeforeReceipt?.items?.[0]?.id;
    assert.ok(poItemId, 'purchase order item missing');

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
            received_qty: 2,
            note: 'guard baseline receipt',
          },
        ],
      },
      expectedStatus: 201,
    });

    const orderAfterReceipt = await waitFor(async () => {
      const order = await getOrderDetail(token, orderId);
      const variant = await getVariantDetail(token, productId, variantId);
      const line = order?.lines?.[0];
      assert.ok(line?.id, 'order line missing after receipt');
      assert.strictEqual(line?.receivedQuantity, 2);
      assert.strictEqual(line?.reservedQuantity, 0);
      assert.strictEqual(line?.shippedQuantity, 0);
      assert.strictEqual(Number(variant.stock_quantity || 0), 2);
      return { order, line, variant };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'line guard baseline did not converge after receipt',
    });

    await apiRequest(`/api/manage/orders/${orderId}/lines/${orderAfterReceipt.line.id}/reserve`, {
      bearerToken: token,
      method: 'POST',
      body: { quantity: 2 },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const order = await getOrderDetail(token, orderId);
      assert.strictEqual(order?.lines?.[0]?.reservedQuantity, 2);
      return order;
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'baseline reserve did not converge before guard checks',
    });

    const reserveReject = await apiRequest(`/api/manage/orders/${orderId}/lines/${orderAfterReceipt.line.id}/reserve`, {
      bearerToken: token,
      method: 'POST',
      body: { quantity: 1 },
      expectedStatus: 400,
    });
    assert.match(String(reserveReject.json?.error || ''), /available stock|exceeds/i);

    const releaseReject = await apiRequest(`/api/manage/orders/${orderId}/lines/${orderAfterReceipt.line.id}/release`, {
      bearerToken: token,
      method: 'POST',
      body: { quantity: 3 },
      expectedStatus: 400,
    });
    assert.match(String(releaseReject.json?.error || ''), /reserved quantity|allocation/i);

    const shipReject = await apiRequest(`/api/manage/orders/${orderId}/lines/${orderAfterReceipt.line.id}/ship`, {
      bearerToken: token,
      method: 'POST',
      body: { quantity: 3 },
      expectedStatus: 400,
    });
    assert.match(String(shipReject.json?.error || ''), /on-hand stock|remaining quantity/i);

    const orderAfterRejects = await getOrderDetail(token, orderId);
    const poAfterRejects = await getPurchaseOrderDetail(token, poId);
    const variantAfterRejects = await getVariantDetail(token, productId, variantId);
    assert.strictEqual(orderAfterRejects?.lines?.[0]?.receivedQuantity, 2);
    assert.strictEqual(orderAfterRejects?.lines?.[0]?.reservedQuantity, 2);
    assert.strictEqual(orderAfterRejects?.lines?.[0]?.shippedQuantity, 0);
    assert.strictEqual(Number(poAfterRejects?.items?.[0]?.received_qty || 0), 2);
    assert.strictEqual(Number(variantAfterRejects.stock_quantity || 0), 2);
  });

  it('ships arrived quantity without explicit line reservations and updates downstream demand projections', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('line-direct-ship');
    const salespersonId = await ensureSalespersonId(token, seed);
    const { productId, variantId, productName } = await createWorkflowProduct(token, seed, {
      stockQuantity: 0,
    });
    const orderId = await createConfirmedOrder(token, {
      seed,
      salespersonId,
      productId,
      variantId,
      productName,
      quantity: 4,
    });
    const poId = await createPurchaseOrderFromOrders(token, [orderId], seed);

    await transitionPurchaseOrderToShipping(token, poId);

    const poBeforeReceipt = await getPurchaseOrderDetail(token, poId);
    const poItemId = poBeforeReceipt?.items?.[0]?.id;
    assert.ok(poItemId, 'purchase order item missing');

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
            received_qty: 4,
            note: 'direct ship receipt',
          },
        ],
      },
      expectedStatus: 201,
    });

    const orderAfterReceipt = await waitFor(async () => {
      const order = await getOrderDetail(token, orderId);
      const line = order?.lines?.[0];
      assert.ok(line?.id, 'order line missing');
      assert.strictEqual(order?.procurementStatus, 'arrived');
      assert.strictEqual(line?.receivedQuantity, 4);
      assert.strictEqual(line?.reservedQuantity, 0);
      return { order, line };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'direct ship baseline did not converge after receipt',
    });

    await apiRequest(`/api/manage/orders/${orderId}/lines/${orderAfterReceipt.line.id}/ship`, {
      bearerToken: token,
      method: 'POST',
      body: { quantity: 2 },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const order = await getOrderDetail(token, orderId);
      const variant = await getVariantDetail(token, productId, variantId);
      const suggestions = await apiRequest('/api/manage/purchase-orders/suggestions', {
        bearerToken: token,
        expectedStatus: 200,
      });
      const suggestion = findSuggestion(suggestions.json, variantId);

      assert.strictEqual(order?.lines?.[0]?.reservedQuantity, 0);
      assert.strictEqual(order?.lines?.[0]?.shippedQuantity, 2);
      assert.strictEqual(order?.lines?.[0]?.displayStatus, 'partially_shipped');
      assert.strictEqual(Number(variant.stock_quantity || 0), 2);
      assert.strictEqual(Number(variant.available_quantity || 0), 0);
      assert.ok(suggestion, 'purchase suggestion missing after direct ship');
      assert.strictEqual(Number(suggestion.total_demand || 0), 2);
      assert.strictEqual(Number(suggestion.stock_quantity || 0), 2);
      assert.strictEqual(Number(suggestion.available_quantity || 0), 0);
      assert.strictEqual(Number(suggestion.shortage || 0), 2);
      return { order, variant, suggestion };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'direct ship projection did not converge',
    });
  });

  it('rejects reversing a receipt after shipped stock has already consumed part of the received inventory', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('reversal-after-ship');
    const salespersonId = await ensureSalespersonId(token, seed);
    const { productId, variantId, productName } = await createWorkflowProduct(token, seed, {
      stockQuantity: 0,
    });
    const orderId = await createConfirmedOrder(token, {
      seed,
      salespersonId,
      productId,
      variantId,
      productName,
      quantity: 4,
    });
    const poId = await createPurchaseOrderFromOrders(token, [orderId], seed);

    await transitionPurchaseOrderToShipping(token, poId);

    const poBeforeReceipt = await getPurchaseOrderDetail(token, poId);
    const poItemId = poBeforeReceipt?.items?.[0]?.id;
    assert.ok(poItemId, 'purchase order item missing');

    const receipt = await apiRequest(`/api/manage/purchase-orders/${poId}/receipts`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-receipt`,
      },
      body: {
        items: [
          {
            purchase_order_item_id: poItemId,
            received_qty: 4,
            note: 'receipt before ship then reversal guard',
          },
        ],
      },
      expectedStatus: 201,
    });
    const receiptId = receipt.json?.data?.receipts?.[0]?.id;
    assert.ok(receiptId, 'receipt id missing');

    const orderAfterReceipt = await waitFor(async () => {
      const order = await getOrderDetail(token, orderId);
      const line = order?.lines?.[0];
      assert.ok(line?.id, 'order line missing');
      assert.strictEqual(line?.receivedQuantity, 4);
      return { order, line };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'receipt baseline did not converge before ship/reversal guard',
    });

    await apiRequest(`/api/manage/orders/${orderId}/lines/${orderAfterReceipt.line.id}/ship`, {
      bearerToken: token,
      method: 'POST',
      body: { quantity: 2 },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const variant = await getVariantDetail(token, productId, variantId);
      assert.strictEqual(Number(variant.stock_quantity || 0), 2);
      return variant;
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'stock baseline did not converge before reversal guard',
    });

    const reversalReject = await apiRequest(
      `/api/manage/purchase-orders/${poId}/receipts/${receiptId}/reversal`,
      {
        bearerToken: token,
        method: 'POST',
        headers: {
          'Idempotency-Key': `${seed}-reversal`,
        },
        body: { reason: 'stock already consumed by shipment' },
        expectedStatus: 400,
      }
    );
    assert.match(String(reversalReject.json?.error || ''), /库存不足|无法执行收货冲销/i);

    const finalOrder = await getOrderDetail(token, orderId);
    const finalPo = await getPurchaseOrderDetail(token, poId);
    const finalVariant = await getVariantDetail(token, productId, variantId);
    assert.strictEqual(finalOrder?.procurementStatus, 'arrived');
    assert.strictEqual(finalOrder?.lines?.[0]?.receivedQuantity, 4);
    assert.strictEqual(finalOrder?.lines?.[0]?.shippedQuantity, 2);
    assert.strictEqual(Number(finalPo?.items?.[0]?.received_qty || 0), 4);
    assert.strictEqual(finalPo?.items?.[0]?.display_status, 'received');
    assert.strictEqual(Number(finalVariant.stock_quantity || 0), 2);
  });

  it('keeps receipt and ship workflows usable after the source product has been archived', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('archived-master-data');
    const salespersonId = await ensureSalespersonId(token, seed);
    const { productId, variantId, productName } = await createWorkflowProduct(token, seed, {
      stockQuantity: 0,
    });
    const orderId = await createConfirmedOrder(token, {
      seed,
      salespersonId,
      productId,
      variantId,
      productName,
      quantity: 3,
    });
    const poId = await createPurchaseOrderFromOrders(token, [orderId], seed);

    await transitionPurchaseOrderToShipping(token, poId);

    const poBeforeArchive = await getPurchaseOrderDetail(token, poId);
    const poItemId = poBeforeArchive?.items?.[0]?.id;
    assert.ok(poItemId, 'purchase order item missing before archive');

    await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      method: 'DELETE',
      expectedStatus: 200,
    });

    const archivedProduct = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const archivedVariant = (archivedProduct.json?.data?.variants || []).find((item) => item.id === variantId);
    assert.ok(archivedVariant, 'archived variant missing from product detail');
    assert.strictEqual(archivedVariant.status, 'archived');

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
            received_qty: 3,
            note: 'receipt after product archive',
          },
        ],
      },
      expectedStatus: 201,
    });

    const orderAfterReceipt = await waitFor(async () => {
      const order = await getOrderDetail(token, orderId);
      const line = order?.lines?.[0];
      assert.ok(line?.id, 'archived-product order line missing');
      assert.strictEqual(order?.procurementStatus, 'arrived');
      assert.strictEqual(line?.receivedQuantity, 3);
      return { order, line };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'receipt did not converge after source product archive',
    });

    await apiRequest(`/api/manage/orders/${orderId}/lines/${orderAfterReceipt.line.id}/ship`, {
      bearerToken: token,
      method: 'POST',
      body: { quantity: 1 },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const order = await getOrderDetail(token, orderId);
      const po = await getPurchaseOrderDetail(token, poId);
      const variant = await getVariantDetail(token, productId, variantId);

      assert.strictEqual(order?.lines?.[0]?.shippedQuantity, 1);
      assert.strictEqual(order?.lines?.[0]?.displayStatus, 'partially_shipped');
      assert.strictEqual(Number(po?.items?.[0]?.received_qty || 0), 3);
      assert.strictEqual(po?.items?.[0]?.display_status, 'received');
      assert.strictEqual(variant.status, 'archived');
      assert.strictEqual(Number(variant.stock_quantity || 0), 2);
      return { order, po, variant };
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'ship flow did not remain usable after source product archive',
    });
  });
});

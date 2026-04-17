import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
  waitFor,
} from './utils/manage-products-real-api.js';
import {
  createWorkflowProduct,
  createPurchaseOrderFromOrders,
  transitionPurchaseOrderToShipping,
  getOrderDetail,
  getPurchaseOrderDetail,
} from './utils/order-procurement-real-api.js';
import {
  createAuthenticatedSalesSession,
  salesApiRequest,
} from './utils/sales-real-api.js';

function findSalesListOrder(payload, orderId) {
  return (payload?.data?.orders || []).find((item) => item.id === orderId) || null;
}

function findSalesProduct(payload, productId) {
  return (payload?.data || []).find((item) => item.id === productId) || null;
}

async function findUnreadSalesNotification(accessToken, jwt, predicate, { limit = 50 } = {}) {
  const result = await salesApiRequest(
    accessToken,
    jwt,
    `/api/sales/${accessToken}/notifications?unread_only=true&limit=${limit}`,
    { expectedStatus: 200 }
  );
  return {
    list: result.json?.data?.list || [],
    match: (result.json?.data?.list || []).find(predicate) || null,
  };
}

describeIfRealApi('Sales Order Collaboration Real API', function () {
  this.timeout(180000);

  it('runs sales catalog -> sales order -> admin confirm -> procurement receipt -> delivery confirmation as one real business chain', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('sales-collab');
    const salesSession = await createAuthenticatedSalesSession(token, seed, {
      namePrefix: 'Sales Collaboration',
      store: 'Sales Collaboration Store',
    });

    const clearSalesUnread = await salesApiRequest(
      salesSession.accessToken,
      salesSession.jwt,
      `/api/sales/${salesSession.accessToken}/notifications/all/read`,
      {
        method: 'POST',
        body: {},
        expectedStatus: 200,
      }
    );
    assert.strictEqual(clearSalesUnread.json?.success, true);

    const { productId, variantId, productName } = await createWorkflowProduct(token, seed, {
      stockQuantity: 5,
      price: 129,
      namePrefix: 'Sales Collaboration Product',
      skuPrefix: 'SCOL',
      dimensionValue: 'Navy',
      brand: 'Sales Collaboration Brand',
    });

    const salesProducts = await salesApiRequest(
      salesSession.accessToken,
      salesSession.jwt,
      `/api/sales/${salesSession.accessToken}/products?search=${encodeURIComponent(seed)}`,
      { expectedStatus: 200 }
    );
    const listedProduct = findSalesProduct(salesProducts.json, productId);
    assert.ok(listedProduct, 'sales catalog did not expose sellable bound product');
    assert.strictEqual(listedProduct.name, productName);

    const salesProductDetail = await salesApiRequest(
      salesSession.accessToken,
      salesSession.jwt,
      `/api/sales/${salesSession.accessToken}/products/${productId}`,
      { expectedStatus: 200 }
    );
    const listedVariant = (salesProductDetail.json?.data?.variants || []).find((item) => item.id === variantId);
    assert.ok(listedVariant, 'sales product detail did not expose sellable variant');
    assert.ok(Number(listedVariant.available_quantity || 0) >= 5, 'sales product detail available quantity missing');

    const createdOrder = await salesApiRequest(
      salesSession.accessToken,
      salesSession.jwt,
      `/api/sales/${salesSession.accessToken}/orders`,
      {
        method: 'POST',
        body: {
          name: productName,
          brand: 'Sales Collaboration Brand',
          size: 'L',
          color: 'Navy',
          material: 'Cotton',
          remark: `sales-created-${seed}`,
          fileIds: [],
          quantity: 2,
          productId,
          variantId,
        },
        expectedStatus: 201,
      }
    );
    const orderId = createdOrder.json?.data?.id;
    assert.ok(orderId, 'sales collaboration order id missing');

    await waitFor(async () => {
      const list = await salesApiRequest(
        salesSession.accessToken,
        salesSession.jwt,
        `/api/sales/${salesSession.accessToken}/orders?page=1&limit=20`,
        { expectedStatus: 200 }
      );
      const order = findSalesListOrder(list.json, orderId);
      assert.ok(order, 'sales-created order missing from sales list');
      assert.strictEqual(order.status, 'pending');
      assert.strictEqual(order.productId, productId);
      assert.strictEqual(order.variantId, variantId);
      return order;
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'sales-created order did not appear in sales order list',
    });

    const adminOrderBeforeConfirm = await getOrderDetail(token, orderId);
    assert.strictEqual(adminOrderBeforeConfirm?.salespersonId, salesSession.salespersonId);
    assert.strictEqual(adminOrderBeforeConfirm?.productId, productId);
    assert.strictEqual(adminOrderBeforeConfirm?.variantId, variantId);

    await apiRequest(`/api/manage/orders/${orderId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: {
        status: 'confirmed',
        note: 'sales collaboration confirm',
      },
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const list = await salesApiRequest(
        salesSession.accessToken,
        salesSession.jwt,
        `/api/sales/${salesSession.accessToken}/orders?page=1&limit=20`,
        { expectedStatus: 200 }
      );
      const order = findSalesListOrder(list.json, orderId);
      assert.ok(order, 'confirmed order missing from sales list');
      assert.strictEqual(order.status, 'confirmed');
      assert.strictEqual(order.hasNewFeedback, true);
      return order;
    }, {
      timeoutMs: 20000,
      intervalMs: 500,
      onTimeoutMessage: 'admin confirmation did not fan out to sales order list',
    });

    const salesDetailAfterConfirm = await salesApiRequest(
      salesSession.accessToken,
      salesSession.jwt,
      `/api/sales/${salesSession.accessToken}/orders/${orderId}`,
      { expectedStatus: 200 }
    );
    assert.strictEqual(salesDetailAfterConfirm.json?.data?.status, 'confirmed');
    assert.strictEqual(salesDetailAfterConfirm.json?.data?.productId, productId);
    assert.strictEqual(salesDetailAfterConfirm.json?.data?.variantId, variantId);

    await waitFor(async () => {
      const list = await salesApiRequest(
        salesSession.accessToken,
        salesSession.jwt,
        `/api/sales/${salesSession.accessToken}/orders?page=1&limit=20`,
        { expectedStatus: 200 }
      );
      const order = findSalesListOrder(list.json, orderId);
      assert.ok(order, 'sales order missing after detail read');
      assert.strictEqual(order.hasNewFeedback, false);
      return order;
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'sales detail read did not clear unread feedback in list',
    });

    const poId = await createPurchaseOrderFromOrders(token, [orderId], seed, {
      remark: `sales collaboration procurement ${seed}`,
    });
    await transitionPurchaseOrderToShipping(token, poId);

    const poDetail = await getPurchaseOrderDetail(token, poId);
    const poItemId = poDetail?.items?.[0]?.id;
    assert.ok(poItemId, 'sales collaboration purchase order item id missing');

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
            note: 'sales collaboration receipt',
          },
        ],
      },
      expectedStatus: 201,
    });

    const orderAfterReceipt = await waitFor(async () => {
      const detail = await salesApiRequest(
        salesSession.accessToken,
        salesSession.jwt,
        `/api/sales/${salesSession.accessToken}/orders/${orderId}`,
        { expectedStatus: 200 }
      );
      const line = detail.json?.data?.lines?.[0];
      assert.strictEqual(detail.json?.data?.procurementStatus, 'arrived');
      assert.ok(line?.id, 'sales order line missing after receipt');
      assert.strictEqual(line.receivedQuantity, 2);
      return detail.json?.data;
    }, {
      timeoutMs: 20000,
      intervalMs: 500,
      onTimeoutMessage: 'procurement receipt did not project into sales order detail',
    });

    await apiRequest(`/api/manage/orders/${orderId}/lines/${orderAfterReceipt.lines[0].id}/ship`, {
      bearerToken: token,
      method: 'POST',
      body: { quantity: 2 },
      expectedStatus: 200,
    });

    await apiRequest(`/api/manage/orders/${orderId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'fulfilled' },
      expectedStatus: 200,
    });

    await apiRequest(`/api/manage/orders/${orderId}/delivery-confirmation`, {
      bearerToken: token,
      method: 'POST',
      body: { note: 'sales collaboration delivered' },
      expectedStatus: 200,
    });

    const deliveredDetail = await waitFor(async () => {
      const detail = await salesApiRequest(
        salesSession.accessToken,
        salesSession.jwt,
        `/api/sales/${salesSession.accessToken}/orders/${orderId}`,
        { expectedStatus: 200 }
      );
      assert.strictEqual(detail.json?.data?.fulfillmentStatus, 'fulfilled');
      assert.strictEqual(detail.json?.data?.deliveryStatus, 'delivered');
      assert.ok(Number(detail.json?.data?.deliveryConfirmedAt || 0) > 0, 'deliveryConfirmedAt missing');
      return detail.json?.data;
    }, {
      timeoutMs: 20000,
      intervalMs: 500,
      onTimeoutMessage: 'delivery confirmation did not converge into sales order detail',
    });
    assert.strictEqual(deliveredDetail.lines?.[0]?.shippedQuantity, 2);

    const deliveryNotification = await waitFor(async () => {
      const result = await findUnreadSalesNotification(
        salesSession.accessToken,
        salesSession.jwt,
        (item) =>
          item.metadata?.eventType === 'order_delivery_confirmed'
          && item.metadata?.payload?.order_id === orderId
      );
      assert.ok(result.match, 'sales delivery notification has not been materialized yet');
      return result.match;
    }, {
      timeoutMs: 25000,
      intervalMs: 1000,
      onTimeoutMessage: 'delivery confirmation notification did not reach sales notifications',
    });
    assert.ok(
      String(deliveryNotification.title || '').toLowerCase().includes('delivery')
      || String(deliveryNotification.content || '').toLowerCase().includes('delivery'),
      'delivery notification title/content did not describe delivery confirmation'
    );
  });

  it('rolls sales order procurement detail back after a recorded receipt is reversed', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('sales-collab-reversal');
    const salesSession = await createAuthenticatedSalesSession(token, seed, {
      namePrefix: 'Sales Collaboration Reversal',
      store: 'Sales Collaboration Reversal Store',
    });

    const { productId, variantId, productName } = await createWorkflowProduct(token, seed, {
      stockQuantity: 2,
      price: 149,
      namePrefix: 'Sales Collaboration Reversal Product',
      skuPrefix: 'SCREV',
      dimensionValue: 'Stone',
      brand: 'Sales Collaboration Reversal Brand',
    });

    const createdOrder = await salesApiRequest(
      salesSession.accessToken,
      salesSession.jwt,
      `/api/sales/${salesSession.accessToken}/orders`,
      {
        method: 'POST',
        body: {
          name: productName,
          brand: 'Sales Collaboration Reversal Brand',
          size: 'M',
          color: 'Stone',
          material: 'Canvas',
          remark: `sales-reversal-${seed}`,
          fileIds: [],
          quantity: 2,
          productId,
          variantId,
        },
        expectedStatus: 201,
      }
    );
    const orderId = createdOrder.json?.data?.id;
    assert.ok(orderId, 'sales reversal order id missing');

    await apiRequest(`/api/manage/orders/${orderId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: {
        status: 'confirmed',
        note: 'sales collaboration reversal confirm',
      },
      expectedStatus: 200,
    });

    const poId = await createPurchaseOrderFromOrders(token, [orderId], seed, {
      remark: `sales collaboration reversal procurement ${seed}`,
    });
    await transitionPurchaseOrderToShipping(token, poId);

    const poDetail = await getPurchaseOrderDetail(token, poId);
    const poItemId = poDetail?.items?.[0]?.id;
    assert.ok(poItemId, 'sales collaboration reversal purchase order item id missing');

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
            received_qty: 2,
            note: 'sales collaboration reversal receipt',
          },
        ],
      },
      expectedStatus: 201,
    });
    const receiptId = receipt.json?.data?.receipts?.[0]?.id;
    assert.ok(receiptId, 'sales collaboration reversal receipt id missing');

    await waitFor(async () => {
      const detail = await salesApiRequest(
        salesSession.accessToken,
        salesSession.jwt,
        `/api/sales/${salesSession.accessToken}/orders/${orderId}`,
        { expectedStatus: 200 }
      );
      const line = detail.json?.data?.lines?.[0];
      assert.strictEqual(detail.json?.data?.procurementStatus, 'arrived');
      assert.ok(line?.id, 'sales reversal order line missing after receipt');
      assert.strictEqual(line.receivedQuantity, 2);
      return detail.json?.data;
    }, {
      timeoutMs: 20000,
      intervalMs: 500,
      onTimeoutMessage: 'receipt baseline did not project into sales order detail before reversal',
    });

    await apiRequest(`/api/manage/purchase-orders/${poId}/receipts/${receiptId}/reversal`, {
      bearerToken: token,
      method: 'POST',
      headers: {
        'Idempotency-Key': `${seed}-reversal`,
      },
      body: { reason: 'sales collaboration rollback verification' },
      expectedStatus: 201,
    });

    await waitFor(async () => {
      const detail = await salesApiRequest(
        salesSession.accessToken,
        salesSession.jwt,
        `/api/sales/${salesSession.accessToken}/orders/${orderId}`,
        { expectedStatus: 200 }
      );
      const line = detail.json?.data?.lines?.[0];
      assert.strictEqual(detail.json?.data?.procurementStatus, 'ordered');
      assert.ok(line?.id, 'sales reversal order line missing after reversal');
      assert.strictEqual(line.receivedQuantity, 0);
      return detail.json?.data;
    }, {
      timeoutMs: 20000,
      intervalMs: 500,
      onTimeoutMessage: 'receipt reversal did not roll sales order procurement detail back',
    });
  });
});

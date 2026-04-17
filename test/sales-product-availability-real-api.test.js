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
  getPurchaseOrderDetail,
} from './utils/order-procurement-real-api.js';
import { createAuthenticatedSalesSession, salesApiRequest } from './utils/sales-real-api.js';

function findSalesProduct(payload, productId) {
  return (payload?.data || []).find((item) => item.id === productId) || null;
}

async function withDirectRealApiTransport(run) {
  const originalTransport = process.env.REAL_API_TRANSPORT;
  process.env.REAL_API_TRANSPORT = 'direct';
  try {
    return await run();
  } finally {
    if (originalTransport === undefined) {
      delete process.env.REAL_API_TRANSPORT;
      return;
    }
    process.env.REAL_API_TRANSPORT = originalTransport;
  }
}

describeIfRealApi('Sales Product Availability Real API', function () {
  this.timeout(180000);

  it('updates sales sellable catalog after confirmed order consumes stock and restores it after receipt', async () => {
    await withDirectRealApiTransport(async () => {
      const token = await getBearerToken();
      const seed = uniqueSeed('sales-product-availability');
      const salesSession = await createAuthenticatedSalesSession(token, seed, {
        namePrefix: 'Sales Product Availability',
        store: 'Sales Product Availability Store',
      });

      const { productId, variantId, productName } = await createWorkflowProduct(token, seed, {
        stockQuantity: 2,
        price: 168,
        namePrefix: 'Sales Availability Product',
        skuPrefix: 'SAP',
        dimensionValue: 'Khaki',
        brand: 'Sales Availability Brand',
      });

      const warmList = await salesApiRequest(
        salesSession.accessToken,
        salesSession.jwt,
        `/api/sales/${salesSession.accessToken}/products?search=${encodeURIComponent(seed)}`,
        { expectedStatus: 200 }
      );
      assert.ok(
        findSalesProduct(warmList.json, productId),
        'sales warm list missing sellable product'
      );

      const warmDetail = await salesApiRequest(
        salesSession.accessToken,
        salesSession.jwt,
        `/api/sales/${salesSession.accessToken}/products/${productId}`,
        { expectedStatus: 200 }
      );
      const warmVariant = (warmDetail.json?.data?.variants || []).find(
        (item) => item.id === variantId
      );
      assert.ok(warmVariant, 'sales warm detail missing sellable variant');
      assert.strictEqual(Number(warmVariant.available_quantity || 0), 2);

      const createdOrder = await apiRequest('/api/manage/orders', {
        bearerToken: token,
        method: 'POST',
        body: {
          productName,
          salespersonId: salesSession.salespersonId,
          productId,
          variantId,
          quantity: 2,
          remark: `availability-consume-${seed}`,
          fileIds: [],
        },
        expectedStatus: 201,
      });
      const orderId = createdOrder.json?.data?.id;
      assert.ok(orderId, 'availability order id missing');

      await apiRequest(`/api/manage/orders/${orderId}/status`, {
        bearerToken: token,
        method: 'PATCH',
        body: {
          status: 'confirmed',
          note: 'consume available stock for sales catalog regression',
        },
        expectedStatus: 200,
      });

      await waitFor(
        async () => {
          const salesList = await salesApiRequest(
            salesSession.accessToken,
            salesSession.jwt,
            `/api/sales/${salesSession.accessToken}/products?search=${encodeURIComponent(seed)}`,
            { expectedStatus: 200 }
          );
          assert.ok(
            !findSalesProduct(salesList.json, productId),
            'sales catalog still exposed out-of-stock product'
          );

          const salesDetail = await salesApiRequest(
            salesSession.accessToken,
            salesSession.jwt,
            `/api/sales/${salesSession.accessToken}/products/${productId}`,
            { expectedStatus: 200 }
          );
          const variant = (salesDetail.json?.data?.variants || []).find(
            (item) => item.id === variantId
          );
          assert.ok(!variant, 'sales product detail still exposed out-of-stock variant');
          return salesDetail.json?.data;
        },
        {
          timeoutMs: 20000,
          intervalMs: 500,
          onTimeoutMessage:
            'sales catalog did not hide exhausted sellable product after order confirmation',
        }
      );

      const poId = await createPurchaseOrderFromOrders(token, [orderId], seed, {
        remark: `sales availability procurement ${seed}`,
      });
      await transitionPurchaseOrderToShipping(token, poId);

      const poDetail = await getPurchaseOrderDetail(token, poId);
      const poItemId = poDetail?.items?.[0]?.id;
      assert.ok(poItemId, 'availability purchase order item id missing');

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
              note: 'restore sales sellable stock',
            },
          ],
        },
        expectedStatus: 201,
      });

      await waitFor(
        async () => {
          const salesList = await salesApiRequest(
            salesSession.accessToken,
            salesSession.jwt,
            `/api/sales/${salesSession.accessToken}/products?search=${encodeURIComponent(seed)}`,
            { expectedStatus: 200 }
          );
          const product = findSalesProduct(salesList.json, productId);
          assert.ok(product, 'sales catalog did not restore product after receipt replenishment');

          const salesDetail = await salesApiRequest(
            salesSession.accessToken,
            salesSession.jwt,
            `/api/sales/${salesSession.accessToken}/products/${productId}`,
            { expectedStatus: 200 }
          );
          const variant = (salesDetail.json?.data?.variants || []).find(
            (item) => item.id === variantId
          );
          assert.ok(
            variant,
            'sales product detail did not restore variant after receipt replenishment'
          );
          assert.strictEqual(Number(variant.available_quantity || 0), 2);
          return salesDetail.json?.data;
        },
        {
          timeoutMs: 20000,
          intervalMs: 500,
          onTimeoutMessage:
            'sales catalog did not restore sellable product after receipt replenishment',
        }
      );
    });
  });

  it('hides the sales sellable catalog again after a restoring receipt is reversed', async () => {
    await withDirectRealApiTransport(async () => {
      const token = await getBearerToken();
      const seed = uniqueSeed('sales-product-reversal');
      const salesSession = await createAuthenticatedSalesSession(token, seed, {
        namePrefix: 'Sales Product Reversal',
        store: 'Sales Product Reversal Store',
      });

      const { productId, variantId, productName } = await createWorkflowProduct(token, seed, {
        stockQuantity: 2,
        price: 188,
        namePrefix: 'Sales Reversal Product',
        skuPrefix: 'SRP',
        dimensionValue: 'Olive',
        brand: 'Sales Reversal Brand',
      });

      const warmList = await salesApiRequest(
        salesSession.accessToken,
        salesSession.jwt,
        `/api/sales/${salesSession.accessToken}/products?search=${encodeURIComponent(seed)}`,
        { expectedStatus: 200 }
      );
      assert.ok(
        findSalesProduct(warmList.json, productId),
        'sales warm list missing reversal product'
      );

      const createdOrder = await apiRequest('/api/manage/orders', {
        bearerToken: token,
        method: 'POST',
        body: {
          productName,
          salespersonId: salesSession.salespersonId,
          productId,
          variantId,
          quantity: 2,
          remark: `availability-reversal-${seed}`,
          fileIds: [],
        },
        expectedStatus: 201,
      });
      const orderId = createdOrder.json?.data?.id;
      assert.ok(orderId, 'availability reversal order id missing');

      await apiRequest(`/api/manage/orders/${orderId}/status`, {
        bearerToken: token,
        method: 'PATCH',
        body: {
          status: 'confirmed',
          note: 'consume stock before receipt reversal validation',
        },
        expectedStatus: 200,
      });

      await waitFor(
        async () => {
          const salesList = await salesApiRequest(
            salesSession.accessToken,
            salesSession.jwt,
            `/api/sales/${salesSession.accessToken}/products?search=${encodeURIComponent(seed)}`,
            { expectedStatus: 200 }
          );
          assert.ok(
            !findSalesProduct(salesList.json, productId),
            'sales catalog still exposed consumed product before reversal flow'
          );
          return salesList.json?.data;
        },
        {
          timeoutMs: 20000,
          intervalMs: 500,
          onTimeoutMessage: 'sales catalog did not hide exhausted product before reversal flow',
        }
      );

      const poId = await createPurchaseOrderFromOrders(token, [orderId], seed, {
        remark: `sales reversal procurement ${seed}`,
      });
      await transitionPurchaseOrderToShipping(token, poId);

      const poDetail = await getPurchaseOrderDetail(token, poId);
      const poItemId = poDetail?.items?.[0]?.id;
      assert.ok(poItemId, 'availability reversal purchase order item id missing');

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
              note: 'restore stock before reversal',
            },
          ],
        },
        expectedStatus: 201,
      });
      const receiptId = receipt.json?.data?.receipts?.[0]?.id;
      assert.ok(receiptId, 'availability reversal receipt id missing');

      await waitFor(
        async () => {
          const salesList = await salesApiRequest(
            salesSession.accessToken,
            salesSession.jwt,
            `/api/sales/${salesSession.accessToken}/products?search=${encodeURIComponent(seed)}`,
            { expectedStatus: 200 }
          );
          const product = findSalesProduct(salesList.json, productId);
          assert.ok(product, 'sales catalog did not restore product before reversal');

          const salesDetail = await salesApiRequest(
            salesSession.accessToken,
            salesSession.jwt,
            `/api/sales/${salesSession.accessToken}/products/${productId}`,
            { expectedStatus: 200 }
          );
          const variant = (salesDetail.json?.data?.variants || []).find(
            (item) => item.id === variantId
          );
          assert.ok(variant, 'sales detail did not restore variant before reversal');
          assert.strictEqual(Number(variant.available_quantity || 0), 2);
          return salesDetail.json?.data;
        },
        {
          timeoutMs: 20000,
          intervalMs: 500,
          onTimeoutMessage: 'sales catalog did not restore product before reversal',
        }
      );

      await apiRequest(`/api/manage/purchase-orders/${poId}/receipts/${receiptId}/reversal`, {
        bearerToken: token,
        method: 'POST',
        headers: {
          'Idempotency-Key': `${seed}-reversal`,
        },
        body: {
          reason: 're-hide sales product after receipt reversal',
        },
        expectedStatus: 201,
      });

      await waitFor(
        async () => {
          const salesList = await salesApiRequest(
            salesSession.accessToken,
            salesSession.jwt,
            `/api/sales/${salesSession.accessToken}/products?search=${encodeURIComponent(seed)}`,
            { expectedStatus: 200 }
          );
          assert.ok(
            !findSalesProduct(salesList.json, productId),
            'sales catalog still exposed product after receipt reversal'
          );

          const salesDetail = await salesApiRequest(
            salesSession.accessToken,
            salesSession.jwt,
            `/api/sales/${salesSession.accessToken}/products/${productId}`,
            { expectedStatus: 200 }
          );
          const variant = (salesDetail.json?.data?.variants || []).find(
            (item) => item.id === variantId
          );
          assert.ok(!variant, 'sales detail still exposed variant after receipt reversal');
          return salesDetail.json?.data;
        },
        {
          timeoutMs: 20000,
          intervalMs: 500,
          onTimeoutMessage: 'sales catalog did not hide product again after receipt reversal',
        }
      );
    });
  });
});

import assert from 'assert';
import { apiRequest } from './manage-products-real-api.js';

export async function ensureSalespersonId(
  token,
  seed,
  { namePrefix = 'Workflow Sales', store = 'Workflow Store' } = {}
) {
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
      name: `${namePrefix} ${seed}`,
      store,
      phone: `13${String(Date.now()).slice(-9)}`,
      password: '123456',
    },
    expectedStatus: 201,
  });
  return created.json?.data?.id;
}

export async function createWorkflowProduct(
  token,
  seed,
  {
    stockQuantity = 0,
    price = 99,
    costPrice = 55,
    alertThreshold = 1,
    namePrefix = 'Workflow Product',
    skuPrefix = 'WF',
    dimensionName = 'Color',
    dimensionValue = 'Gray',
    brand = 'KK',
    category = 'Workflow',
  } = {}
) {
  const productName = `${namePrefix} ${seed}`;
  const createdProduct = await apiRequest('/api/manage/products', {
    bearerToken: token,
    method: 'POST',
    body: {
      name: productName,
      spu: `${skuPrefix}-${seed}`,
      currency: 'CNY',
      brand,
      category,
      dimensions: [{ name: dimensionName, values: [dimensionValue] }],
      variants: [
        {
          sku: `${skuPrefix}-${String(dimensionValue).toUpperCase()}-${seed}`,
          price,
          cost_price: costPrice,
          stock_quantity: stockQuantity,
          alert_threshold: alertThreshold,
          status: 'active',
          options_values: { [dimensionName]: dimensionValue },
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

  return { productId, variantId, productName };
}

export async function createConfirmedOrder(
  token,
  {
    seed,
    salespersonId,
    productId,
    variantId,
    quantity,
    productName = `Workflow Product ${seed}`,
    fileIds = [],
  } = {}
) {
  const created = await apiRequest('/api/manage/orders', {
    bearerToken: token,
    method: 'POST',
    body: {
      productName,
      salespersonId,
      productId,
      variantId,
      quantity,
      fileIds,
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

export async function createPurchaseOrderFromOrders(
  token,
  orderIds,
  seed,
  { remark = `Workflow procurement ${seed}`, allocationMethod = 'by_quantity' } = {}
) {
  const created = await apiRequest('/api/manage/purchase-orders/from-orders', {
    bearerToken: token,
    method: 'POST',
    body: {
      order_ids: orderIds,
      remark,
      allocation_method: allocationMethod,
    },
    expectedStatus: 201,
  });
  const poId = created.json?.data?.id;
  assert.ok(poId, 'purchase order id missing');
  return poId;
}

export async function transitionPurchaseOrderToShipping(token, poId) {
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
}

export async function getOrderDetail(token, orderId) {
  const detail = await apiRequest(`/api/manage/orders/${orderId}`, {
    bearerToken: token,
    expectedStatus: 200,
  });
  return detail.json?.data;
}

export async function getPurchaseOrderDetail(token, poId) {
  const detail = await apiRequest(`/api/manage/purchase-orders/${poId}`, {
    bearerToken: token,
    expectedStatus: 200,
  });
  return detail.json?.data;
}

export async function getVariantDetail(token, productId, variantId) {
  const detail = await apiRequest(`/api/manage/products/${productId}`, {
    bearerToken: token,
    expectedStatus: 200,
  });
  const variant = (detail.json?.data?.variants || []).find((item) => item.id === variantId);
  assert.ok(variant, 'variant missing');
  return variant;
}

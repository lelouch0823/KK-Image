import { buildListCacheUrls } from '../../_shared/route-helpers.js';

const getOrigin = (c) => new URL(c.req.url).origin;
const dedupe = (urls = []) => [...new Set(urls.filter(Boolean))];

const SALES_ORDER_STATUSES = ['pending', 'confirmed', 'rejected', 'void'];

export function getManageNotificationCacheUrls(c) {
  const origin = getOrigin(c);
  return [
    `${origin}/api/manage/notifications`,
    `${origin}/api/manage/notifications?limit=20`,
    `${origin}/api/manage/notifications?unread_only=true&limit=20`,
    `${origin}/api/manage/notifications?limit=20&unread_only=true`,
  ];
}

export function getManageShareCacheUrls(c) {
  const origin = getOrigin(c);
  return buildListCacheUrls(origin, '/api/manage/shares', {
    allowedKeys: ['page', 'limit'],
    defaults: { page: 1, limit: 20 },
    maxLimit: 100,
  });
}

export function getManageTagCacheUrls(c) {
  const origin = getOrigin(c);
  return [`${origin}/api/manage/tags`];
}

export function getSalesNotificationCacheUrls(c, token) {
  if (!token) return [];
  const origin = getOrigin(c);
  return [
    `${origin}/api/sales/${token}/notifications`,
    `${origin}/api/sales/${token}/notifications?limit=20`,
    `${origin}/api/sales/${token}/notifications?unread_only=true&limit=20`,
    `${origin}/api/sales/${token}/notifications?limit=20&unread_only=true`,
  ];
}

export function getSalesOrderCacheUrls(c, { salesTokens = [] } = {}) {
  const origin = getOrigin(c);
  const urls = [];
  const uniqueTokens = [...new Set((salesTokens || []).filter(Boolean))];

  for (const token of uniqueTokens) {
    urls.push(...buildListCacheUrls(origin, `/api/sales/${token}/orders`, {
      allowedKeys: ['page', 'limit', 'status'],
      defaults: { page: 1, limit: 20 },
      maxLimit: 100,
      queryVariants: SALES_ORDER_STATUSES.map((status) => ({ status })),
    }));
  }

  return dedupe(urls);
}

export function getSalesStatsCacheUrls(c, { salesTokens = [] } = {}) {
  const origin = getOrigin(c);
  return dedupe(
    [...new Set((salesTokens || []).filter(Boolean))].map((token) => `${origin}/api/sales/${token}/stats`)
  );
}

export function getSalesProductCacheUrls(c, { salesTokens = [], productId = null } = {}) {
  const origin = getOrigin(c);
  const urls = [];
  const uniqueTokens = [...new Set((salesTokens || []).filter(Boolean))];

  for (const token of uniqueTokens) {
    urls.push(...buildListCacheUrls(origin, `/api/sales/${token}/products`, {
      allowedKeys: ['page', 'limit', 'search'],
      defaults: { page: 1, limit: 12 },
      maxLimit: 30,
    }));
    if (productId) {
      urls.push(`${origin}/api/sales/${token}/products/${productId}`);
    }
  }

  return dedupe(urls);
}

export function getSalesSpaceCacheUrls(c, { salesTokens = [], spaceId = null } = {}) {
  const origin = getOrigin(c);
  const urls = [];
  const uniqueTokens = [...new Set((salesTokens || []).filter(Boolean))];

  for (const token of uniqueTokens) {
    urls.push(`${origin}/api/sales/${token}/spaces`);
    if (spaceId) {
      urls.push(`${origin}/api/sales/${token}/spaces/${spaceId}`);
    }
  }

  return dedupe(urls);
}

export function getDashboardCacheUrls(c) {
  const origin = getOrigin(c);
  return [`${origin}/api/manage/dashboard/overview`];
}

export function getGoodsOverviewCacheUrls(c) {
  const origin = getOrigin(c);
  return [
    `${origin}/api/manage/goods-overview`,
    `${origin}/api/manage/goods-overview?sort=shortage`,
    `${origin}/api/manage/goods-overview?sort=demand`,
    `${origin}/api/manage/goods-overview?sort=name`,
    `${origin}/api/manage/goods-overview?sort=cost`,
    `${origin}/api/manage/goods-overview/summary`,
  ];
}

export function getPurchaseOrderCacheUrls(c, poId = null) {
  const origin = getOrigin(c);
  const urls = [
    ...buildListCacheUrls(origin, '/api/manage/purchase-orders', {
      allowedKeys: ['page', 'limit', 'status', 'search'],
      defaults: { page: 1, limit: 20 },
      maxLimit: 100,
    }),
    `${origin}/api/manage/purchase-orders/stats`,
    `${origin}/api/manage/purchase-orders/suggestions`,
  ];

  if (poId) {
    urls.push(`${origin}/api/manage/purchase-orders/${poId}`);
  }

  return urls;
}

export function getManageOrderCacheUrls(c) {
  const origin = getOrigin(c);
  return [
    ...buildListCacheUrls(origin, '/api/manage/orders', {
      allowedKeys: ['page', 'limit', 'status', 'procurementStatus', 'search', 'salesperson', 'startTime', 'endTime'],
      defaults: { page: 1, limit: 20 },
      maxLimit: 100,
    }),
    `${origin}/api/manage/orders/stats`,
  ];
}

export function getManageSalespersonCacheUrls(c) {
  const origin = getOrigin(c);
  return buildListCacheUrls(origin, '/api/manage/salespersons', {
    allowedKeys: ['page', 'limit', 'search'],
    defaults: { page: 1, limit: 50 },
    maxLimit: 100,
    queryVariants: [{ limit: 20 }],
  });
}

export function getOrderNotificationCacheUrls(c, { salesTokens = [] } = {}) {
  const urlSet = new Set(getManageNotificationCacheUrls(c));
  const uniqueTokens = [...new Set((salesTokens || []).filter(Boolean))];

  for (const token of uniqueTokens) {
    for (const url of getSalesNotificationCacheUrls(c, token)) {
      urlSet.add(url);
    }
  }

  return [...urlSet];
}

export function getManageSpaceCacheUrls(c, { spaceId = null, parentId = null, productIds = [] } = {}) {
  const origin = getOrigin(c);
  const urls = [
    `${origin}/api/manage/spaces`,
  ];

  const uniqueProductIds = [...new Set((productIds || []).filter(Boolean))];
  for (const productId of uniqueProductIds) {
    urls.push(`${origin}/api/manage/spaces/product/${productId}`);
  }

  if (spaceId) {
    urls.push(`${origin}/api/manage/spaces/${spaceId}`);
    urls.push(`${origin}/api/manage/spaces/${spaceId}/stats`);
    urls.push(`${origin}/api/manage/spaces/${spaceId}/stats?days=7`);
    urls.push(`${origin}/api/manage/spaces/${spaceId}/stats?days=30`);
    urls.push(`${origin}/api/manage/spaces/${spaceId}/subspaces`);
  }

  if (parentId) {
    urls.push(`${origin}/api/manage/spaces/${parentId}`);
    urls.push(`${origin}/api/manage/spaces/${parentId}/subspaces`);
  }

  return [...new Set(urls)];
}

export function getOrderAnalyticsCacheUrls(c) {
  const urlSet = new Set([
    ...getManageOrderCacheUrls(c),
    ...getDashboardCacheUrls(c),
    ...getGoodsOverviewCacheUrls(c),
    ...getPurchaseOrderCacheUrls(c),
  ]);

  return [...urlSet];
}

export function getOrderAndSalespersonCacheUrls(c, { salesTokens = [] } = {}) {
  return dedupe([
    ...getOrderAnalyticsCacheUrls(c),
    ...getManageSalespersonCacheUrls(c),
    ...getSalesOrderCacheUrls(c, { salesTokens }),
    ...getSalesStatsCacheUrls(c, { salesTokens }),
  ]);
}

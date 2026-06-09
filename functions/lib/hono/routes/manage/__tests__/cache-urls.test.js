import { describe, expect, it } from 'vitest';
import {
  getDashboardCacheUrls,
  getGoodsOverviewCacheUrls,
  getManageOrderCacheUrls,
  getManageStatsCacheUrls,
  getManageNotificationCacheUrls,
  getManageShareCacheUrls,
  getManageSalespersonCacheUrls,
  getManageSpaceCacheUrls,
  getManageTagCacheUrls,
  getOrderAndSalespersonCacheUrls,
  getOrderNotificationCacheUrls,
  getOrderAnalyticsCacheUrls,
  getPurchaseOrderCacheUrls,
  getSalesNotificationCacheUrls,
  getSalesOrderCacheUrls,
  getSalesProductCacheUrls,
  getSalesSpaceCacheUrls,
  getSalesStatsCacheUrls,
} from '../../_shared/cache-urls.js';

const createContext = (url) => ({ req: { url } });

describe('route cache url helpers', () => {
  it('builds manage notification cache urls', () => {
    const urls = getManageNotificationCacheUrls(
      createContext('https://example.com/api/manage/notifications')
    );
    expect(urls).toContain('https://example.com/api/manage/notifications');
    expect(urls).toContain('https://example.com/api/manage/notifications?limit=20');
  });

  it('builds sales notification cache urls', () => {
    const urls = getSalesNotificationCacheUrls(
      createContext('https://example.com/api/sales/token/notifications'),
      'token'
    );
    expect(urls).toContain('https://example.com/api/sales/token/notifications');
    expect(urls).toContain('https://example.com/api/sales/token/notifications?limit=20');
  });

  it('builds purchase order and analytics urls', () => {
    const c = createContext('https://example.com/api/manage/purchase-orders');
    const poUrls = getPurchaseOrderCacheUrls(c, 'po-1');
    const analyticsUrls = getOrderAnalyticsCacheUrls(c);

    expect(poUrls).toContain('https://example.com/api/manage/purchase-orders/po-1');
    expect(analyticsUrls).toContain('https://example.com/api/manage/orders');
    expect(analyticsUrls).toContain('https://example.com/api/manage/dashboard/overview');
    expect(analyticsUrls).toContain('https://example.com/api/manage/goods-overview/summary');
  });

  it('builds dashboard and goods overview urls', () => {
    const c = createContext('https://example.com/api/manage/dashboard/overview');
    expect(getDashboardCacheUrls(c)).toContain('https://example.com/api/manage/dashboard/overview');
    expect(getManageStatsCacheUrls(c)).toContain('https://example.com/api/manage/stats');
    expect(getManageStatsCacheUrls(c)).toContain(
      'https://example.com/api/manage/stats/uploads?days=30'
    );
    expect(getGoodsOverviewCacheUrls(c)).toContain(
      'https://example.com/api/manage/goods-overview?sort=shortage'
    );
  });

  it('builds manage orders cache urls', () => {
    const c = createContext('https://example.com/api/manage/orders');
    const urls = getManageOrderCacheUrls(c);
    expect(urls).toContain('https://example.com/api/manage/orders?limit=20&page=1');
    expect(urls).toContain('https://example.com/api/manage/orders/stats');
  });

  it('builds share and tag cache urls', () => {
    const c = createContext('https://example.com/api/manage/shares');
    expect(getManageShareCacheUrls(c)).toContain(
      'https://example.com/api/manage/shares?limit=20&page=1'
    );
    expect(getManageTagCacheUrls(c)).toContain('https://example.com/api/manage/tags');
  });

  it('builds salesperson and order notification cache urls', () => {
    const c = createContext('https://example.com/api/manage/orders');
    expect(getManageSalespersonCacheUrls(c)).toContain(
      'https://example.com/api/manage/salespersons?limit=50&page=1'
    );
    expect(getOrderAndSalespersonCacheUrls(c, { salesTokens: ['token-a'] })).toContain(
      'https://example.com/api/sales/token-a/orders?limit=20&page=1'
    );

    const notificationUrls = getOrderNotificationCacheUrls(c, { salesTokens: ['token-a'] });
    expect(notificationUrls).toContain('https://example.com/api/manage/notifications');
    expect(notificationUrls).toContain(
      'https://example.com/api/sales/token-a/notifications?limit=20'
    );
  });

  it('builds space cache urls', () => {
    const c = createContext('https://example.com/api/manage/spaces');
    const urls = getManageSpaceCacheUrls(c, {
      spaceId: 'sp-1',
      parentId: 'parent-1',
      productIds: ['prod-1'],
    });
    expect(urls).toContain('https://example.com/api/manage/spaces');
    expect(urls).toContain('https://example.com/api/manage/spaces/sp-1');
    expect(urls).toContain('https://example.com/api/manage/spaces/sp-1/stats?days=7');
    expect(urls).toContain('https://example.com/api/manage/spaces/parent-1/subspaces');
    expect(urls).toContain('https://example.com/api/manage/spaces/product/prod-1');
  });

  it('builds sales cache urls', () => {
    const c = createContext('https://example.com/api/sales/token-a/orders');
    expect(getSalesOrderCacheUrls(c, { salesTokens: ['token-a'] })).toContain(
      'https://example.com/api/sales/token-a/orders?limit=20&page=1'
    );
    expect(getSalesStatsCacheUrls(c, { salesTokens: ['token-a'] })).toContain(
      'https://example.com/api/sales/token-a/stats'
    );
    expect(
      getSalesProductCacheUrls(c, { salesTokens: ['token-a'], productId: 'prod-1' })
    ).toContain('https://example.com/api/sales/token-a/products/prod-1');
    expect(getSalesSpaceCacheUrls(c, { salesTokens: ['token-a'], spaceId: 'sp-1' })).toContain(
      'https://example.com/api/sales/token-a/spaces/sp-1'
    );
  });
});

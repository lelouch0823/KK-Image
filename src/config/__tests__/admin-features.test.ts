import { describe, expect, it, vi } from 'vitest';
import {
  adminFeatures,
  createAdminFeatureRoutes,
  getAdminFeatureByEntityType,
  getAdminFeatureByKey,
  getAdminFeaturePath,
  getCommandAdminFeatures,
  getSidebarAdminFeatures,
  inferAdminFeatureKeyFromPath,
} from '../admin-features';

describe('admin feature manifest', () => {
  it('keeps admin feature identity unique and route-ready', () => {
    const keys = adminFeatures.map((feature) => feature.key);
    const paths = adminFeatures.map((feature) => feature.path);
    const names = adminFeatures.map((feature) => feature.name);

    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(names).size).toBe(names.length);

    expect(getAdminFeatureByKey('outbox-ops')).toMatchObject({
      key: 'outbox-ops',
      path: 'outbox-ops',
      name: 'OutboxOps',
      titleKey: 'router.outbox_ops',
      permission: 'audit:read',
      icon: 'arrow-path',
    });
    expect(getAdminFeaturePath('outbox-ops')).toBe('/admin/outbox-ops');
  });

  it('derives Vue Router records from the shared manifest', () => {
    const routes = createAdminFeatureRoutes();
    const outboxRoute = routes.find((route) => route.name === 'OutboxOps');

    expect(routes).toHaveLength(adminFeatures.length);
    expect(outboxRoute).toMatchObject({
      path: 'outbox-ops',
      meta: { titleKey: 'router.outbox_ops', permission: 'audit:read' },
    });
    expect(typeof outboxRoute?.component).toBe('function');
  });

  it('uses the same manifest for sidebar and command navigation', () => {
    const sidebarKeys = getSidebarAdminFeatures().map((feature) => feature.key);
    const commandKeys = getCommandAdminFeatures().map((feature) => feature.key);

    expect(sidebarKeys).toContain('inventory-dashboard');
    expect(sidebarKeys).toContain('outbox-ops');
    expect(commandKeys).toContain('purchase-orders');
    expect(commandKeys).toContain('audit-logs');
    expect(commandKeys).not.toContain('outbox-ops');
  });

  it('maps route paths and entity recent views through the same feature records', () => {
    expect(inferAdminFeatureKeyFromPath('/admin/products')).toBe('products');
    expect(inferAdminFeatureKeyFromPath('/admin/products?edit=p-1')).toBe('products');
    expect(inferAdminFeatureKeyFromPath('/admin/forbidden')).toBe('forbidden');
    expect(inferAdminFeatureKeyFromPath('/admin')).toBe('dashboard');
    expect(inferAdminFeatureKeyFromPath('/login')).toBe('dashboard');

    expect(getAdminFeatureByEntityType('order')).toMatchObject({
      key: 'orders',
      icon: 'clipboard-document-list',
    });
    expect(getAdminFeatureByEntityType('product')).toMatchObject({
      key: 'products',
      icon: 'cube',
    });
    expect(getAdminFeatureByEntityType('customer')).toMatchObject({
      key: 'customers',
      icon: 'users',
    });
  });

  it('does not mutate the shared feature list from consumers', () => {
    expect(() => {
      Array.prototype.push.call(adminFeatures, {
        key: 'debug',
        path: 'debug',
        name: 'Debug',
        component: vi.fn(),
        titleKey: 'debug',
        permission: 'admin:full',
        icon: 'bug',
        labelKey: 'debug',
      });
    }).toThrow();
  });
});

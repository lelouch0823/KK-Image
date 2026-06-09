import type { RouteRecordRaw } from 'vue-router';

export interface AdminFeature {
  key: string;
  path: string;
  name: string;
  component: RouteRecordRaw['component'];
  titleKey: string;
  permission: string;
  icon: string;
  labelKey: string;
  commandLabelKey?: string;
  commandKeywords?: string[];
  sidebar?: boolean;
  command?: boolean;
}

const freezeFeature = (feature: AdminFeature): Readonly<AdminFeature> => Object.freeze(feature);

export const adminFeatures = Object.freeze(
  [
    freezeFeature({
      key: 'dashboard',
      path: 'dashboard',
      name: 'Dashboard',
      component: () => import('@/views/Dashboard.vue'),
      titleKey: 'router.dashboard',
      permission: 'stats:read',
      icon: 'squares-2x2',
      labelKey: 'sidebar.dashboard',
      commandKeywords: ['dashboard', '概览', '仪表盘'],
    }),
    freezeFeature({
      key: 'files',
      path: 'files',
      name: 'Files',
      component: () => import('@/views/FileManager/index.vue'),
      titleKey: 'router.file_management',
      permission: 'files:read',
      icon: 'folder',
      labelKey: 'sidebar.files',
      commandKeywords: ['files', '文件'],
    }),
    freezeFeature({
      key: 'spaces',
      path: 'spaces',
      name: 'Spaces',
      component: () => import('@/views/SpaceManager/index.vue'),
      titleKey: 'router.space_management',
      permission: 'spaces:read',
      icon: 'rectangle-group',
      labelKey: 'sidebar.spaces',
      commandKeywords: ['spaces', '共享空间'],
    }),
    freezeFeature({
      key: 'salespersons',
      path: 'salespersons',
      name: 'Salespersons',
      component: () => import('@/components/SalespersonManager.vue'),
      titleKey: 'router.salesperson_management',
      permission: 'users:read',
      icon: 'briefcase',
      labelKey: 'salesperson.title',
      commandKeywords: ['salespersons', '销售'],
    }),
    freezeFeature({
      key: 'products',
      path: 'products',
      name: 'Products',
      component: () => import('@/components/ProductManager.vue'),
      titleKey: 'router.product_management',
      permission: 'products:manage',
      icon: 'cube',
      labelKey: 'views.products',
      commandKeywords: ['products', '商品'],
    }),
    freezeFeature({
      key: 'orders',
      path: 'orders',
      name: 'Orders',
      component: () => import('@/components/OrderManager.vue'),
      titleKey: 'router.order_management',
      permission: 'orders:manage',
      icon: 'clipboard-document-list',
      labelKey: 'order.manage.title',
      commandKeywords: ['orders', '订单'],
    }),
    freezeFeature({
      key: 'goods-overview',
      path: 'goods-overview',
      name: 'GoodsOverview',
      component: () => import('@/views/GoodsOverview.vue'),
      titleKey: 'router.goods_overview',
      permission: 'products:manage',
      icon: 'building-storefront',
      labelKey: 'sidebar.goodsOverview',
      commandKeywords: ['goods', '订货总览'],
    }),
    freezeFeature({
      key: 'inventory-dashboard',
      path: 'inventory-dashboard',
      name: 'InventoryDashboard',
      component: () => import('@/views/InventoryDashboard.vue'),
      titleKey: 'router.inventory_dashboard',
      permission: 'products:manage',
      icon: 'archive-box',
      labelKey: 'sidebar.inventoryDashboard',
      command: false,
      commandKeywords: ['inventory', '库存'],
    }),
    freezeFeature({
      key: 'purchase-orders',
      path: 'purchase-orders',
      name: 'PurchaseOrders',
      component: () => import('@/views/PurchaseOrders.vue'),
      titleKey: 'router.purchase_orders',
      permission: 'products:manage',
      icon: 'shopping-cart',
      labelKey: 'purchaseOrder.title',
      commandKeywords: ['purchase', '采购'],
    }),
    freezeFeature({
      key: 'stocktakes',
      path: 'stocktakes',
      name: 'Stocktakes',
      component: () => import('@/views/StocktakeManager.vue'),
      titleKey: 'router.stocktakes',
      permission: 'products:manage',
      icon: 'clipboard-document-check',
      labelKey: 'stocktake.title',
      command: false,
      commandKeywords: ['stocktake', '盘点'],
    }),
    freezeFeature({
      key: 'customers',
      path: 'customers',
      name: 'Customers',
      component: () => import('@/views/Customers.vue'),
      titleKey: 'router.customer_management',
      permission: 'orders:manage',
      icon: 'users',
      labelKey: 'customer.manage.title',
      commandKeywords: ['customers', '客户'],
    }),
    freezeFeature({
      key: 'stats',
      path: 'stats',
      name: 'Stats',
      component: () => import('@/views/Stats.vue'),
      titleKey: 'router.stats_analysis',
      permission: 'stats:read',
      icon: 'chart-bar',
      labelKey: 'sidebar.stats',
      commandKeywords: ['stats', '统计'],
    }),
    freezeFeature({
      key: 'receivables',
      path: 'receivables',
      name: 'Receivables',
      component: () => import('@/components/ReceivablesDashboard.vue'),
      titleKey: 'router.receivables',
      permission: 'orders:read',
      icon: 'banknotes',
      labelKey: 'order.receivables.title',
      command: false,
      commandKeywords: ['receivables', '应收'],
    }),
    freezeFeature({
      key: 'reminders',
      path: 'reminders',
      name: 'Reminders',
      component: () => import('@/views/ReminderCenter.vue'),
      titleKey: 'router.reminders',
      permission: 'notifications:read',
      icon: 'bell',
      labelKey: 'router.reminders',
      sidebar: false,
      commandKeywords: ['reminders', '提醒'],
    }),
    freezeFeature({
      key: 'settings',
      path: 'settings',
      name: 'Settings',
      component: () => import('@/views/Settings.vue'),
      titleKey: 'router.system_settings',
      permission: 'admin:full',
      icon: 'cog-8-tooth',
      labelKey: 'settings.title',
      commandKeywords: ['settings', '设置'],
    }),
    freezeFeature({
      key: 'audit-logs',
      path: 'audit-logs',
      name: 'AuditLogs',
      component: () => import('@/views/AuditLogs.vue'),
      titleKey: 'router.audit_logs',
      permission: 'audit:read',
      icon: 'document-text',
      labelKey: 'router.audit_logs',
      commandKeywords: ['audit', '审计'],
    }),
    freezeFeature({
      key: 'outbox-ops',
      path: 'outbox-ops',
      name: 'OutboxOps',
      component: () => import('@/views/OutboxOps.vue'),
      titleKey: 'router.outbox_ops',
      permission: 'audit:read',
      icon: 'arrow-path',
      labelKey: 'router.outbox_ops',
      command: false,
      commandKeywords: ['outbox', 'replay', '运维'],
    }),
    freezeFeature({
      key: 'erp-sync',
      path: 'erp-sync',
      name: 'ErpSync',
      component: () => import('@/views/ErpSync.vue'),
      titleKey: 'router.erp_sync',
      permission: 'admin:full',
      icon: 'arrow-path',
      labelKey: 'router.erp_sync',
      sidebar: false,
      command: false,
      commandKeywords: ['erp', 'sync'],
    }),
    freezeFeature({
      key: 'oauth-apps',
      path: 'oauth-apps',
      name: 'OAuthApps',
      component: () => import('@/views/OAuthApps.vue'),
      titleKey: 'router.oauth_apps',
      permission: 'admin:full',
      icon: 'key',
      labelKey: 'router.oauth_apps',
      sidebar: false,
      command: false,
      commandKeywords: ['oauth', 'apps'],
    }),
  ]
);

const adminFeatureByKey = new Map(adminFeatures.map((feature) => [feature.key, feature]));
const adminEntityFeatureKeys: Readonly<Record<string, string>> = Object.freeze({
  order: 'orders',
  product: 'products',
  customer: 'customers',
});

export function getAdminFeatureByKey(key: string): Readonly<AdminFeature> | undefined {
  return adminFeatureByKey.get(key);
}

export function getAdminFeaturePath(key: string): string {
  const feature = getAdminFeatureByKey(key);
  return feature ? `/admin/${feature.path}` : '/admin/dashboard';
}

export function getSidebarAdminFeatures(): Readonly<AdminFeature>[] {
  return adminFeatures.filter((feature) => feature.sidebar !== false);
}

export function getCommandAdminFeatures(): Readonly<AdminFeature>[] {
  return adminFeatures.filter((feature) => feature.command !== false);
}

export function getAdminFeatureByEntityType(
  entityType: string
): Readonly<AdminFeature> | undefined {
  return getAdminFeatureByKey(adminEntityFeatureKeys[entityType]);
}

export function inferAdminFeatureKeyFromPath(routePath: string = ''): string {
  const normalizedPath = String(routePath || '').split(/[?#]/)[0].replace(/\/+$/, '');
  if (normalizedPath === '/admin' || normalizedPath === '') return 'dashboard';
  if (!normalizedPath.startsWith('/admin/')) return 'dashboard';

  const key = normalizedPath.replace('/admin/', '').split('/')[0];
  return key || 'dashboard';
}

export function createAdminFeatureRoutes(): RouteRecordRaw[] {
  return adminFeatures.map((feature) => ({
    path: feature.path,
    name: feature.name,
    component: feature.component,
    meta: {
      titleKey: feature.titleKey,
      permission: feature.permission,
    },
  }));
}

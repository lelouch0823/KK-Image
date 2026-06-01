import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import nprogress from 'nprogress';
import 'nprogress/nprogress.css';
import { useAuth } from '@/composables/useAuth';
import { useAccessControl } from '@/composables/useAccessControl';
import { useI18n } from '@/composables/useI18n';
import { APP_NAME } from '@/utils/constants';

// 懒加载组件
const Login = () => import('@/views/Login.vue');
const AdminLayout = () => import('@/layouts/AdminLayout.vue');
const Gallery = () => import('@/views/Gallery.vue');
const Space = () => import('@/views/Space.vue');
const Sales = () => import('@/views/Sales.vue');

const DASHBOARD_ROUTE_NAME = 'Dashboard';
const FORBIDDEN_ROUTE_NAME = 'Forbidden';

// 路由定义
const routes: RouteRecordRaw[] = [
    {
        path: '/',
        redirect: '/login', // 默认重定向到登录
    },
    {
        path: '/login',
        name: 'Login',
        component: Login,
        meta: {
            guest: true, // 仅访客可见
            titleKey: 'router.login',
        },
    },
    // Public Apps (Token Based)
    {
        path: '/gallery/:token',
        name: 'Gallery',
        component: Gallery,
        meta: { titleKey: 'router.gallery_share' },
    },
    {
        path: '/space/:token',
        name: 'Space',
        component: Space,
        meta: { titleKey: 'router.space_share' },
    },
    {
        path: '/sales/:token',
        component: Sales, // Sales.vue acts as layout
        meta: { titleKey: 'router.sales_portal' },
        children: [
            {
                path: '',
                name: 'SalesList',
                component: () => import('@/views/sales/SalesListView.vue'),
                meta: { titleKey: 'router.order_list' },
            },
            {
                path: 'create',
                name: 'SalesCreate',
                component: () => import('@/views/sales/SalesFormView.vue'),
                meta: { titleKey: 'router.new_order' },
            },
            {
                path: 'detail/:id',
                name: 'SalesDetail',
                component: () => import('@/views/sales/SalesDetailView.vue'),
                meta: { titleKey: 'router.order_detail' },
            },
            {
                path: 'stats',
                name: 'SalesStats',
                component: () => import('@/views/sales/SalesStatsView.vue'),
                meta: { titleKey: 'router.personal_stats' },
            },
            {
                path: 'spaces',
                name: 'SalesSpaces',
                component: () => import('@/views/sales/SalesSpacesView.vue'),
                meta: { titleKey: 'router.sales_spaces' },
            },
            {
                path: 'spaces/:id',
                name: 'SalesSpaceDetail',
                component: () => import('@/views/sales/SalesSpaceDetailView.vue'),
                meta: { titleKey: 'router.sales_spaces' },
            },
        ],
    },
    {
        path: '/admin',
        component: AdminLayout,
        meta: {
            requiresAuth: true, // 需要认证
        },
        children: [
            {
                path: '', // /admin
                redirect: '/admin/dashboard',
            },
            {
                path: 'dashboard',
                name: 'Dashboard',
                component: () => import('@/views/Dashboard.vue'),
                meta: { titleKey: 'router.dashboard', permission: 'stats:read' },
            },
            {
                path: 'files',
                name: 'Files',
                component: () => import('@/views/FileManager/index.vue'),
                meta: { titleKey: 'router.file_management', permission: 'files:read' },
            },
            {
                path: 'spaces',
                name: 'Spaces',
                component: () => import('@/views/SpaceManager/index.vue'),
                meta: { titleKey: 'router.space_management', permission: 'spaces:read' },
            },
            {
                path: 'salespersons',
                name: 'Salespersons',
                component: () => import('@/components/SalespersonManager.vue'), // 暂时兼容
                meta: { titleKey: 'router.salesperson_management', permission: 'users:read' },
            },
            {
                path: 'products',
                name: 'Products',
                component: () => import('@/components/ProductManager.vue'),
                meta: { titleKey: 'router.product_management', permission: 'products:manage' },
            },
            {
                path: 'orders',
                name: 'Orders',
                component: () => import('@/components/OrderManager.vue'), // 暂时兼容
                meta: { titleKey: 'router.order_management', permission: 'orders:manage' },
            },
            {
                path: 'goods-overview',
                name: 'GoodsOverview',
                component: () => import('@/views/GoodsOverview.vue'),
                meta: { titleKey: 'router.goods_overview', permission: 'products:manage' },
            },
            {
                path: 'inventory-dashboard',
                name: 'InventoryDashboard',
                component: () => import('@/views/InventoryDashboard.vue'),
                meta: { titleKey: 'router.inventory_dashboard', permission: 'products:manage' },
            },
            {
                path: 'purchase-orders',
                name: 'PurchaseOrders',
                component: () => import('@/views/PurchaseOrders.vue'),
                meta: { titleKey: 'router.purchase_orders', permission: 'products:manage' },
            },
            {
                path: 'stocktakes',
                name: 'Stocktakes',
                component: () => import('@/views/StocktakeManager.vue'),
                meta: { titleKey: 'router.stocktakes', permission: 'products:manage' },
            },
            {
                path: 'customers',
                name: 'Customers',
                component: () => import('@/views/Customers.vue'),
                meta: { titleKey: 'router.customer_management', permission: 'orders:manage' },
            },
            {
                path: 'stats',
                name: 'Stats',
                component: () => import('@/views/Stats.vue'),
                meta: { titleKey: 'router.stats_analysis', permission: 'stats:read' },
            },
            {
                path: 'receivables',
                name: 'Receivables',
                component: () => import('@/components/ReceivablesDashboard.vue'),
                meta: { titleKey: 'router.receivables', permission: 'orders:read' },
            },
            {
                path: 'reminders',
                name: 'Reminders',
                component: () => import('@/views/ReminderCenter.vue'),
                meta: { titleKey: 'router.reminders', permission: 'notifications:read' },
            },
            {
                path: 'settings',
                name: 'Settings',
                component: () => import('@/views/Settings.vue'),
                meta: { titleKey: 'router.system_settings', permission: 'admin:full' },
            },
            {
                path: 'audit-logs',
                name: 'AuditLogs',
                component: () => import('@/views/AuditLogs.vue'),
                meta: { titleKey: 'router.audit_logs', permission: 'audit:read' },
            },
            {
                path: 'outbox-ops',
                name: 'OutboxOps',
                component: () => import('@/views/OutboxOps.vue'),
                meta: { titleKey: 'router.outbox_ops', permission: 'audit:read' },
            },
            {
                path: 'forbidden',
                name: 'Forbidden',
                component: () => import('@/views/Forbidden.vue'),
                meta: { titleKey: 'common.permissionDenied' },
            },
            // Admin catch-all (prevents redirect to login for auth users)
            {
                path: ':pathMatch(.*)*',
                name: 'AdminNotFound',
                component: () => import('@/views/NotFound.vue'),
                meta: { titleKey: 'common.pageNotFound' },
            },
        ],
    },
    // File not found fallback (prevents dashboard redirect for missing files)
    {
        path: '/file/:pathMatch(.*)*',
        name: 'FileNotFound',
        component: () => import('@/views/FileNotFound.vue'),
        meta: { titleKey: 'common.fileNotFound' },
    },
    // Catch-all
    {
        path: '/:pathMatch(.*)*',
        redirect: '/login',
    },
];

const adminChildRoutes = routes.find((route) => route.path === '/admin')?.children || [];

const adminFallbackCandidates = adminChildRoutes.filter((route) => {
    if (!route?.name || route.redirect) return false;
    return route.name !== DASHBOARD_ROUTE_NAME && route.name !== FORBIDDEN_ROUTE_NAME && route.name !== 'AdminNotFound';
});

async function resolveFirstAllowedAdminRoute(can: (permission: string) => Promise<boolean>): Promise<{ name: string } | null> {
    for (const route of adminFallbackCandidates) {
        const requiredPermission = route.meta?.permission;
        if (typeof requiredPermission !== 'string' || await can(requiredPermission)) {
            return { name: route.name as string };
        }
    }

    return null;
}

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(to, from, savedPosition) {
        if (savedPosition) {
            return savedPosition;
        } else {
            return { top: 0 };
        }
    },
});

// NProgress 配置
nprogress.configure({ showSpinner: false });

// 路由守卫
router.beforeEach(async (to, from, next) => {
    nprogress.start();

    // 设置页面标题
    const { t } = useI18n();
    if (to.meta.titleKey) {
        document.title = `${t(to.meta.titleKey as string)} | ${APP_NAME}`;
    }

    const { checkAuth, isAuthenticated } = useAuth();
    const { can, clearPermissions } = useAccessControl();

    // 检查认证状态 (如果尚未检查过)
    // 这里可以优化：如果已经 isAuthenticated.value 为 true，是否还需要 checkAuth?
    // 考虑到 session 可能过期，保持每次路由切换检查或者依赖后端 401 拦截是常见的两种策略
    // 这里我们轻量化检查：如果已有状态，暂且信任；如果是首次加载，则完整检查
    let isAuth = isAuthenticated.value;
    if (!isAuth) {
        // 尝试恢复会话
        isAuth = await checkAuth();
    }

    // 1. 需要认证的页面
    if (to.matched.some(record => record.meta.requiresAuth)) {
        if (!isAuth) {
            clearPermissions();
            next({
                path: '/login',
                query: { redirect: to.fullPath },
            });
        } else {
            const requiredPermission = to.meta.permission as string | undefined;
            if (requiredPermission) {
                const allowed = await can(requiredPermission);
                if (!allowed) {
                    if (to.name === DASHBOARD_ROUTE_NAME) {
                        const fallbackRoute = await resolveFirstAllowedAdminRoute(can);
                        if (fallbackRoute) return next(fallbackRoute);
                    }
                    return next({ name: FORBIDDEN_ROUTE_NAME, query: { permission: requiredPermission } });
                }
            }
            next();
        }
    }
    // 2. 仅访客页面 (如登录页)
    else if (to.matched.some(record => record.meta.guest)) {
        if (isAuth) {
            next({ path: '/admin/dashboard' });
        } else {
            next();
        }
    }
    // 3. 其他页面
    else {
        next();
    }
});

router.afterEach(() => {
    nprogress.done();
});

export default router;

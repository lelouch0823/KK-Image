import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import nprogress from 'nprogress';
import 'nprogress/nprogress.css';
import { useAuth } from '@/composables/useAuth';
import { useAccessControl } from '@/composables/useAccessControl';
import { useI18n } from '@/composables/useI18n';
import { createAdminFeatureRoutes, getAdminFeaturePath } from '@/config/admin-features';
import { APP_NAME } from '@/utils/constants';

// 懒加载组件
const Login = () => import('@/views/Login.vue');
const AdminLayout = () => import('@/layouts/AdminLayout.vue');
const Gallery = () => import('@/views/Gallery.vue');
const Space = () => import('@/views/Space.vue');
const Sales = () => import('@/views/Sales.vue');

const DASHBOARD_ROUTE_NAME = 'Dashboard';
const FORBIDDEN_ROUTE_NAME = 'Forbidden';
const adminFeatureRoutes = createAdminFeatureRoutes();

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
                redirect: getAdminFeaturePath('dashboard'),
            },
            ...adminFeatureRoutes,
            {
                path: 'forbidden',
                name: 'Forbidden',
                component: () => import('@/views/Forbidden.vue'),
                meta: { titleKey: 'router.forbidden' },
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
            next({ path: getAdminFeaturePath('dashboard') });
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

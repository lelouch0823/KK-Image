import { createRouter, createWebHistory } from 'vue-router';
import nprogress from 'nprogress';
import 'nprogress/nprogress.css';
import { useAuth } from '@/composables/useAuth';
import { APP_NAME } from '@/utils/constants';

// 懒加载组件
const Login = () => import('@/views/Login.vue');
const AdminLayout = () => import('@/layouts/AdminLayout.vue');
const Gallery = () => import('@/views/Gallery.vue');
const Space = () => import('@/views/Space.vue');
const Sales = () => import('@/views/Sales.vue');

// 路由定义
const routes = [
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
            title: '登录',
        },
    },
    // Public Apps (Token Based)
    {
        path: '/gallery/:token',
        name: 'Gallery',
        component: Gallery,
        meta: { title: '相册分享' },
    },
    {
        path: '/space/:token',
        name: 'Space',
        component: Space,
        meta: { title: '共享空间' },
    },
    {
        path: '/sales/:token',
        component: Sales, // Sales.vue acts as layout
        meta: { title: '销售门户' },
        children: [
            {
                path: '',
                name: 'SalesList',
                component: () => import('@/views/sales/SalesListView.vue'),
                meta: { title: '订单列表' },
            },
            {
                path: 'create',
                name: 'SalesCreate',
                component: () => import('@/views/sales/SalesFormView.vue'),
                meta: { title: '新建订单' },
            },
            {
                path: 'detail/:id',
                name: 'SalesDetail',
                component: () => import('@/views/sales/SalesDetailView.vue'),
                meta: { title: '订单详情' },
            },
            {
                path: 'stats',
                name: 'SalesStats',
                component: () => import('@/views/sales/SalesStatsView.vue'),
                meta: { title: '个人统计' },
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
                meta: { title: '概览' },
            },
            {
                path: 'files',
                name: 'Files',
                component: () => import('@/views/FileManager/index.vue'),
                meta: { title: '文件管理' },
            },
            {
                path: 'spaces',
                name: 'Spaces',
                component: () => import('@/views/SpaceManager/index.vue'),
                meta: { title: '共享空间' },
            },
            {
                path: 'salespersons',
                name: 'Salespersons',
                component: () => import('@/components/SalespersonManager.vue'), // 暂时兼容
                meta: { title: '销售员管理' },
            },
            {
                path: 'orders',
                name: 'Orders',
                component: () => import('@/components/OrderManager.vue'), // 暂时兼容
                meta: { title: '订单管理' },
            },
            {
                path: 'customers',
                name: 'Customers',
                component: () => import('@/views/Customers.vue'),
                meta: { title: '客户管理' },
            },
            {
                path: 'stats',
                name: 'Stats',
                component: () => import('@/views/Stats.vue'),
                meta: { title: '统计分析' },
            },
            {
                path: 'settings',
                name: 'Settings',
                component: () => import('@/views/Settings.vue'),
                meta: { title: '系统设置' },
            },
        ],
    },
    // Catch-all
    {
        path: '/:pathMatch(.*)*',
        redirect: '/login',
    },
];

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

    // 更新标题 (基础标题，具体页面会在加载后设置更具体的标题)
    if (to.meta.title) {
        document.title = `${to.meta.title} | ${APP_NAME}`;
    }

    const { checkAuth, isAuthenticated } = useAuth();

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
            next({
                path: '/login',
                query: { redirect: to.fullPath },
            });
        } else {
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

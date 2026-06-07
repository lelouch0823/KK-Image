import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { CORS_MAX_AGE } from '../../_shared/utils.js';

import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { traceIdMiddleware } from './middleware/traceId.js';

// V1 路由导入
import authRoutes from './routes/v1/auth.js';
import filesRoutes from './routes/v1/files.js';
import foldersRoutes from './routes/v1/folders.js';
import usersRoutes from './routes/v1/users.js';
import permissionsRoutes from './routes/v1/permissions.js';
import webhooksRoutes from './routes/v1/webhooks.js';
import healthRoutes from './routes/v1/health.js';

// Manage 路由导入
import manageFoldersRoutes from './routes/manage/folders.js';
import manageFilesRoutes from './routes/manage/files.js';
import manageAlbumsRoutes from './routes/manage/albums.js';
import manageSpacesRoutes from './routes/manage/spaces/index.js';
import manageStatsRoutes from './routes/manage/stats.js';
import manageOrdersRoutes from './routes/manage/orders/index.js';
import manageDashboardRoutes from './routes/manage/dashboard.js';
import manageUsersRoutes from './routes/manage/user.js';
import manageSharesRoutes from './routes/manage/shares.js';
import manageUtilsRoutes from './routes/manage/utils.js';
import manageCustomersRoutes from './routes/manage/customers.js';
import manageSalespersonsRoutes from './routes/manage/salespersons.js';
import manageUploadRoutes from './routes/manage/upload.js';
import manageBackupsRoutes from './routes/manage/backups.js';
import manageSettingsRoutes from './routes/manage/settings.js';
import manageProductsRoutes from './routes/manage/products/index.js'; // NEW
import manageProductDetailRoutes from './routes/manage/products/[id].js'; // NEW
import salesRoutes from './routes/sales.js';
import manageNotificationsRoutes from './routes/manage/notifications.js';
import manageAiRoutes from './routes/manage/ai.js';
import manageTrashRoutes from './routes/manage/trash.js'; // NEW
import manageSearchRoutes from './routes/manage/search.js'; // NEW
import manageTagsRoutes from './routes/manage/tags.js'; // NEW
import manageAuditLogsRoutes from './routes/manage/audit-logs.js'; // NEW
import manageGoodsOverviewRoutes from './routes/manage/goods-overview.js'; // NEW: 订货总览
import managePurchaseOrdersRoutes from './routes/manage/purchase-orders.js'; // NEW: 采购单管理
import manageWebhooksRoutes from './routes/manage/webhooks.js';
import manageOutboxRoutes from './routes/manage/outbox.js';
import manageAuditReplayRoutes from './routes/manage/audit-replay.js';
import manageInventoryDashboardRoutes from './routes/manage/inventory-dashboard.js'; // NEW: 库存预警看板
import manageCategoriesRoutes from './routes/manage/categories.js'; // NEW: 分类管理
import manageStocktakesRoutes from './routes/manage/stocktakes.js'; // NEW: 库存盘点
import manageReceivablesRoutes from './routes/manage/receivables.js'; // NEW: 应收账款
import manageFeatureFlagsRoutes from './routes/manage/feature-flags.js'; // NEW: 功能开关
import apiDocsRoutes from './routes/v1/api-docs.js'; // NEW: API 文档
import manageErpSyncRoutes from './routes/manage/erp-sync.js'; // NEW: ERP 数据同步
import manageOAuthRoutes from './routes/manage/oauth.js'; // NEW: OAuth2.0 授权

export const app = new Hono();

// ============================================
// 全局中间件（洋葱模型，从外到内执行）
// ============================================

// 1. 错误处理已迁移至文件末尾的 app.onError

// 2. 日志记录
app.use('*', logger());

// 2.5 请求追踪（生成 trace ID，贯穿整个请求生命周期）
app.use('*', traceIdMiddleware);

// 3. CORS
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const allowed = (c.env?.CORS_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      // 未配置白名单时记录警告（仅首次）
      if (allowed.length === 0) {
        console.warn('[CORS] CORS_ORIGINS 未配置，当前使用首个白名单域名作为默认值');
      }
      // 无 Origin 头时返回第一个白名单域名（而非 '*'）
      if (!origin) return allowed.length > 0 ? allowed[0] : '*';
      // 匹配白名单
      return allowed.includes(origin) ? origin : allowed[0];
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: CORS_MAX_AGE,
  })
);

// 4. 安全头
app.use('*', secureHeaders());

// 5. 限流（仅 API 路由）
app.use('/api/*', rateLimitMiddleware);

// ============================================
// 公开路由（无需认证）
// ============================================

// ============================================
// 认证中间件配置
// ============================================

app.use('/api/v1/*', authMiddleware);
app.use('/api/manage/*', authMiddleware);
// 注意：/api/sales/login 和 wechat-login 在 authMiddleware 内部通过 publicRoutes 排除
app.use('/api/sales/*', authMiddleware);

app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/health', healthRoutes);
app.route('/api/v1/api-docs', apiDocsRoutes); // NEW: API 文档（公开访问）

// V1 API 路由
app.route('/api/v1/files', filesRoutes);
app.route('/api/v1/folders', foldersRoutes);
app.route('/api/v1/users', usersRoutes);
app.route('/api/v1/permissions', permissionsRoutes);
app.route('/api/v1/webhooks', webhooksRoutes);

// Manage API 路由
app.route('/api/manage/folders', manageFoldersRoutes);
app.route('/api/manage/files', manageFilesRoutes);
app.route('/api/manage/albums', manageAlbumsRoutes);
app.route('/api/manage/spaces', manageSpacesRoutes);
app.route('/api/manage/stats', manageStatsRoutes);
app.route('/api/manage/orders', manageOrdersRoutes);
app.route('/api/manage/dashboard', manageDashboardRoutes);
app.route('/api/manage/user', manageUsersRoutes);
app.route('/api/manage/shares', manageSharesRoutes);
app.route('/api/manage/utils', manageUtilsRoutes);
app.route('/api/manage/customers', manageCustomersRoutes);
app.route('/api/manage/salespersons', manageSalespersonsRoutes);
app.route('/api/manage/upload', manageUploadRoutes);
app.route('/api/manage/backups', manageBackupsRoutes);
app.route('/api/manage/settings', manageSettingsRoutes);
app.route('/api/manage/products', manageProductsRoutes); // NEW: List & Create
app.route('/api/manage/products', manageProductDetailRoutes); // NEW: Detail operations (/:id...)
app.route('/api/manage/notifications', manageNotificationsRoutes); // REST: 统一到 manage 命名空间
app.route('/api/manage/ai', manageAiRoutes); // NEW: AI 路由
app.route('/api/manage/trash', manageTrashRoutes); // NEW: 回收站路由
app.route('/api/manage/search', manageSearchRoutes); // NEW: Advanced Search
app.route('/api/manage/tags', manageTagsRoutes); // NEW: Tag Management
app.route('/api/manage/audit-logs', manageAuditLogsRoutes); // NEW: Audit Logs
app.route('/api/manage/goods-overview', manageGoodsOverviewRoutes); // NEW: 订货总览
app.route('/api/manage/purchase-orders', managePurchaseOrdersRoutes); // NEW: 采购单管理
app.route('/api/manage/webhooks', manageWebhooksRoutes);
app.route('/api/manage/outbox', manageOutboxRoutes);
app.route('/api/manage/audit-replay', manageAuditReplayRoutes);
app.route('/api/manage/inventory-dashboard', manageInventoryDashboardRoutes); // NEW: 库存预警看板
app.route('/api/manage/categories', manageCategoriesRoutes); // NEW: 分类管理
app.route('/api/manage/stocktakes', manageStocktakesRoutes); // NEW: 库存盘点
app.route('/api/manage/receivables', manageReceivablesRoutes); // NEW: 应收账款
app.route('/api/manage/feature-flags', manageFeatureFlagsRoutes); // NEW: 功能开关
app.route('/api/manage/erp-sync', manageErpSyncRoutes); // NEW: ERP 数据同步
app.route('/api/manage/oauth', manageOAuthRoutes); // NEW: OAuth2.0 授权
app.route('/api/sales', salesRoutes);

// ============================================
// 通用处理
// ============================================

// 404 处理
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: 'Not Found',
      path: c.req.path,
    },
    404
  );
});

// 全局异常捕获
app.onError(errorHandler);

export default app;

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { CORS_MAX_AGE } from '../../api/utils/constants.js';

import { authMiddleware, publicRoutes } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';

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
import manageSpacesRoutes from './routes/manage/spaces.js';
import manageStatsRoutes from './routes/manage/stats.js';
import manageUsersRoutes from './routes/manage/user.js';
import manageSharesRoutes from './routes/manage/shares.js';
import manageSalespersonsRoutes from './routes/manage/salespersons.js';
import manageOrdersRoutes from './routes/manage/orders.js';

export const app = new Hono();

// ============================================
// 全局中间件（洋葱模型，从外到内执行）
// ============================================

// 1. 错误处理（最外层，捕获所有错误）
app.use('*', errorHandler);

// 2. 日志记录
app.use('*', logger());

// 3. CORS
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: CORS_MAX_AGE
}));

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

app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/health', healthRoutes);



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
app.route('/api/manage/user', manageUsersRoutes);
app.route('/api/manage/shares', manageSharesRoutes);
app.route('/api/manage/salespersons', manageSalespersonsRoutes);
app.route('/api/manage/orders', manageOrdersRoutes);

// ============================================
// 通用处理
// ============================================

// 404 处理
app.notFound((c) => {
    return c.json({
        success: false,
        error: 'Not Found',
        path: c.req.path
    }, 404);
});

export default app;

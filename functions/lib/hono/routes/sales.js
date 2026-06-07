import { Hono } from 'hono';
import { salesAuthMiddleware } from '../middleware/sales-auth.js';

import authRoutes from './sales/auth.js';
import ordersRoutes from './sales/orders.js';
import filesRoutes from './sales/files.js';
import notificationsRoutes from './sales/notifications.js';
import spacesRoutes from './sales/spaces.js';
import profileRoutes from './sales/profile.js';
import productsRoutes from './sales/products.js';

const app = new Hono();

// ============================================
// Public / Auth Routes
// ============================================
// 包含了 /login, /wechat-login, /:token/auth (POST)
app.route('/', authRoutes);

// ============================================
// Protected Routes (requires JWT + Path Token)
// ============================================
const protectedSales = new Hono();
protectedSales.use('*', salesAuthMiddleware);

protectedSales.route('/orders', ordersRoutes);
protectedSales.route('/', filesRoutes); // /upload
protectedSales.route('/notifications', notificationsRoutes);
protectedSales.route('/spaces', spacesRoutes);
protectedSales.route('/products', productsRoutes);
protectedSales.route('/', profileRoutes); // /auth (GET), /bind-wechat, /stats

// Mount protected routes under /:token
app.route('/:token', protectedSales);

export default app;

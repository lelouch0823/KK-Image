
import { Hono } from 'hono';
import listRoutes from './list.js';
import createRoutes from './create.js';
import detailRoutes from './detail.js';
import { requirePermission } from '../../../middleware/auth.js';

const app = new Hono();
app.use('*', requirePermission('orders:manage'));

// Mount sub-routes
// Order matters: specific routes first, parameterized routes last

// List, Stats, Export
app.route('/', listRoutes);

// Create, Batch
app.route('/', createRoutes);

// Detailed operations (/:id...)
app.route('/', detailRoutes);

export default app;

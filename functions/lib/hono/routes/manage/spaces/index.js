/**
 * 共享空间路由入口
 * 整合所有子模块路由
 */

import { Hono } from 'hono';
import crud from './crud.js';
import files from './files.js';
import subspaces from './subspaces.js';
import { requirePermission } from '../../../middleware/auth.js';

const app = new Hono();
app.use('*', requirePermission('spaces:read'));

// 挂载 CRUD 路由（列表、详情、统计、创建、更新、删除）
app.route('/', crud);

// 挂载文件操作路由
app.route('/:id/files', files);

// 挂载子空间路由
app.route('/:id/subspaces', subspaces);

export default app;

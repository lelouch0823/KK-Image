import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ErpSyncRepository } from '../../../../repositories/ErpSyncRepository.js';
import { ProductRepository } from '../../../../repositories/ProductRepository.ts';
import { CustomerRepository } from '../../../../repositories/CustomerRepository.ts';
import { OrderRepository } from '../../../../repositories/OrderRepository.js';
import { ErpSyncService } from '../../../../services/ErpSyncService.js';
import { requirePermission } from '../../middleware/auth.js';
import { parsePagination } from '../../_shared/route-helpers.js';

const app = new Hono();

/**
 * 创建完整的 ErpSyncService 实例（注入所有必需仓库）
 * @param {D1Database} db
 * @returns {ErpSyncService}
 */
function createErpSyncService(db) {
  return new ErpSyncService({
    erpRepo: new ErpSyncRepository(db),
    productRepo: new ProductRepository(db),
    customerRepo: new CustomerRepository(db),
    orderRepo: new OrderRepository(db),
  });
}

// 所有 ERP 同步路由需要管理员权限
app.use('*', requirePermission('admin:full'));

// ============================================
// 连接管理
// ============================================

const CreateConnectionSchema = z
  .object({
    name: z.string().min(1, '名称不能为空'),
    adapterType: z.enum(['generic', 'rest', 'kingdee', 'yonyou', 'sap']),
    baseUrl: z.string().url('无效的 URL'),
    authType: z.enum(['api_key', 'oauth2', 'basic']).default('api_key'),
    credentials: z.record(z.string()).default({}),
    config: z.record(z.unknown()).default({}),
    syncDirection: z.enum(['push', 'pull', 'bidirectional']).default('bidirectional'),
  })
  .strict();

const UpdateConnectionSchema = z
  .object({
    name: z.string().min(1).optional(),
    adapterType: z.string().optional(),
    baseUrl: z.string().url().optional(),
    authType: z.enum(['api_key', 'oauth2', 'basic']).optional(),
    credentials: z.record(z.string()).optional(),
    config: z.record(z.unknown()).optional(),
    syncDirection: z.enum(['push', 'pull', 'bidirectional']).optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

/**
 * GET /connections - 列出所有 ERP 连接
 */
app.get('/connections', async (c) => {
  const repo = new ErpSyncRepository(c.env.DB);
  const connections = await repo.listConnections();
  return c.json({ success: true, data: connections });
});

/**
 * POST /connections - 创建 ERP 连接
 */
app.post('/connections', zValidator('json', CreateConnectionSchema), async (c) => {
  const body = c.req.valid('json');
  const repo = new ErpSyncRepository(c.env.DB);
  const connection = await repo.createConnection({
    ...body,
    actorId: c.get('user')?.id || c.get('user')?.sub,
  });
  return c.json({ success: true, data: connection }, 201);
});

/**
 * GET /connections/:id - 获取连接详情
 */
app.get('/connections/:id', async (c) => {
  const repo = new ErpSyncRepository(c.env.DB);
  const connection = await repo.getConnectionById(c.req.param('id'));
  if (!connection) return c.json({ success: false, error: '连接不存在' }, 404);
  return c.json({ success: true, data: connection });
});

/**
 * PUT /connections/:id - 更新连接
 */
app.put('/connections/:id', zValidator('json', UpdateConnectionSchema), async (c) => {
  const body = c.req.valid('json');
  const repo = new ErpSyncRepository(c.env.DB);
  const connection = await repo.updateConnection(c.req.param('id'), {
    ...body,
    actorId: c.get('user')?.id || c.get('user')?.sub,
  });
  if (!connection) return c.json({ success: false, error: '连接不存在' }, 404);
  return c.json({ success: true, data: connection });
});

/**
 * DELETE /connections/:id - 删除连接
 */
app.delete('/connections/:id', async (c) => {
  const repo = new ErpSyncRepository(c.env.DB);
  await repo.deleteConnection(c.req.param('id'));
  return c.json({ success: true });
});

/**
 * POST /connections/:id/test - 测试连接
 */
app.post('/connections/:id/test', async (c) => {
  const service = createErpSyncService(c.env.DB);
  try {
    const result = await service.testConnection(c.req.param('id'));
    return c.json({ success: true, data: result });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

// ============================================
// 同步操作
// ============================================

const SyncSchema = z
  .object({
    entityTypes: z
      .array(z.enum(['product', 'customer', 'order']))
      .default(['product', 'customer', 'order']),
    direction: z.enum(['push', 'pull', 'bidirectional']).optional(),
  })
  .strict();

/**
 * POST /connections/:id/sync - 触发全量同步
 */
app.post('/connections/:id/sync', zValidator('json', SyncSchema), async (c) => {
  const body = c.req.valid('json');
  const service = createErpSyncService(c.env.DB);
  try {
    const result = await service.syncAll(c.req.param('id'), body);
    return c.json({ success: true, data: result });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

/**
 * POST /connections/:id/webhook - ERP webhook 回调入口
 * 此端点无需管理员认证，通过 HMAC-SHA256 签名验证请求合法性
 */
app.post('/connections/:id/webhook', async (c) => {
  const connectionId = c.req.param('id');
  const signature = c.req.header('X-Webhook-Signature') || '';
  const rawBody = await c.req.text();
  const service = createErpSyncService(c.env.DB);
  try {
    const result = await service.handleWebhook(connectionId, rawBody, signature);
    return c.json({ success: true, data: result });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

// ============================================
// 同步日志
// ============================================

/**
 * GET /logs - 同步日志列表
 */
app.get('/logs', async (c) => {
  const { page, limit } = parsePagination(c);
  const connectionId = c.req.query('connectionId');
  const entityType = c.req.query('entityType');
  const status = c.req.query('status');
  const repo = new ErpSyncRepository(c.env.DB);
  const result = await repo.listSyncLogs({ connectionId, entityType, status, page, limit });
  return c.json({ success: true, data: result.data, total: result.total, page, limit });
});

/**
 * GET /connections/:id/stats - 连接同步统计
 */
app.get('/connections/:id/stats', async (c) => {
  const repo = new ErpSyncRepository(c.env.DB);
  const stats = await repo.getSyncStats(c.req.param('id'));
  return c.json({ success: true, data: stats });
});

// ============================================
// 实体映射
// ============================================

/**
 * GET /connections/:id/mappings - 实体映射列表
 */
app.get('/connections/:id/mappings', async (c) => {
  const entityType = c.req.query('entityType') || 'product';
  const repo = new ErpSyncRepository(c.env.DB);
  const mappings = await repo.listMappings(c.req.param('id'), entityType);
  return c.json({ success: true, data: mappings });
});

export default app;

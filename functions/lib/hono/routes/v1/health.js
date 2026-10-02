import { Hono } from 'hono';

const app = new Hono();

/**
 * GET /api/v1/health - 健康检查
 */
app.get('/', async (c) => {
  const { env } = c;

  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    services: {},
  };

  // 检查 D1 数据库
  if (env.DB) {
    try {
      await env.DB.prepare('SELECT 1').first();
      healthCheck.services.d1 = 'healthy';
    } catch (_error) {
      healthCheck.services.d1 = 'unhealthy';
      healthCheck.status = 'degraded';
    }
  } else {
    healthCheck.services.d1 = 'not_configured';
  }

  // KV 已迁移至 D1，移除 KV 检查

  // 检查 R2 存储
  if (env.R2_BUCKET) {
    healthCheck.services.r2 = 'configured';
  } else {
    healthCheck.services.r2 = 'not_configured';
  }

  const statusCode = healthCheck.status === 'healthy' ? 200 : 503;

  return c.json(healthCheck, statusCode);
});

/**
 * GET /api/v1/health/info - API 信息
 *
 * 该端点位于公开前缀（/api/v1/health/*）之下，供探活与接入方识别使用；
 * 不暴露构建指纹（commit SHA / 分支名），避免为针对性攻击提供部署情报。
 */
app.get('/info', async (c) => {
  const apiInfo = {
    name: 'kk-life API',
    version: '2.0.0',
    framework: 'Hono',
    description: 'RESTful API for kk-life file management system',
    documentation: 'https://github.com/x-dr/kk-image',
    endpoints: {
      files: '/api/manage/files',
      folders: '/api/manage/folders',
      users: '/api/v1/users',
      webhooks: '/api/manage/webhooks',
      auth: '/api/v1/auth',
      health: '/api/v1/health',
    },
    authentication: {
      methods: ['JWT Bearer Token', 'API Key'],
      headers: {
        jwt: 'Authorization: Bearer <token>',
        apiKey: 'X-API-Key: <key>',
      },
    },
    timestamp: new Date().toISOString(),
  };

  return c.json(apiInfo);
});

export default app;

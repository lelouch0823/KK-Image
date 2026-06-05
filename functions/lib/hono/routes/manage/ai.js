/**
 * AI 路由层
 * 仅负责参数验证、中间件编排、响应格式化
 * 业务逻辑已下沉到 Service 层：
 * - AIService: /chat 和 /stream 核心流程
 * - AIReportService: /report 数据聚合
 * - AIConfigService: 配置解析逻辑
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { success } from '../../../../api/utils/response.js';
import { requirePermission } from '../../middleware/auth.js';
import { aiRateLimitMiddleware } from '../../middleware/ai-rate-limit.js';
import { createAIService } from '../../../../services/AIService.js';
import { createAIReportService } from '../../../../services/AIReportService.js';
import { createAIConfigService } from '../../../../services/AIConfigService.js';

const app = new Hono();
app.use('*', requirePermission('stats:read'));
app.use('*', aiRateLimitMiddleware);

/**
 * POST /chat - AI 聊天 (非流式)
 */
app.post('/chat', async (c) => {
  const { env } = c;
  const body = c.get('aiRequestBody') || await c.req.json();

  const configService = createAIConfigService(env.DB, env);
  const runtimeEnv = await configService.resolveRuntimeEnv();

  const aiService = createAIService(env.DB);
  const result = await aiService.handleChat({
    body,
    runtimeEnv,
    user: c.get('user'),
    c,
    quotaDecision: c.get('aiQuotaDecision'),
  });

  if (result.blocked) {
    return c.json({ success: false, error: result.error }, 400);
  }

  return success({ message: result.message });
});

/**
 * POST /report - AI 报告生成
 */
app.post('/report', async (c) => {
  const { env } = c;

  const configService = createAIConfigService(env.DB, env);
  const runtimeEnv = await configService.resolveRuntimeEnv();

  const reportService = createAIReportService(env.DB);
  const html = await reportService.generateReport(runtimeEnv);

  return success({ html });
});

/**
 * POST /stream - AI 流式聊天 (SSE)
 */
app.post('/stream', async (c) => {
  const { env } = c;
  const body = c.get('aiRequestBody') || await c.req.json();

  const configService = createAIConfigService(env.DB, env);
  const runtimeEnv = await configService.resolveRuntimeEnv();

  const aiService = createAIService(env.DB);

  return streamSSE(c, async (stream) => {
    try {
      const result = await aiService.handleStream({
        body,
        runtimeEnv,
        user: c.get('user'),
        c,
        quotaDecision: c.get('aiQuotaDecision'),
        emit: async (event) => {
          await stream.writeSSE({ event: event.type, data: JSON.stringify(event.data || {}) });
        },
      });

      if (result.blocked) {
        await stream.writeSSE({ event: 'error', data: JSON.stringify({ message: result.error }) });
      }
    } catch (err) {
      console.error('[AI Hono Stream] Error:', err);
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ message: err.message }) });
    }
  });
});

export default app;

import { Hono } from 'hono';
import { BadRequestError } from '../../errors.js';
import { SettingsRepository } from '../../../../repositories/SettingsRepository.js';

const app = new Hono();

// 获取所有设置
app.get('/', async (c) => {
  const repo = new SettingsRepository(c.env.DB);
  const grouped = await repo.getAllGrouped();

  // 如果数据库为空，尝试从环境变量读取默认值
  if (!grouped) {
    const aiDefaults = {
      ai: {
        AI_API_KEY: c.env.AI_API_KEY || '',
        AI_API_URL: c.env.AI_API_URL || 'https://api.openai.com/v1',
        AI_MODELS: c.env.AI_MODELS || 'gpt-4o',
      },
    };
    return c.json({ success: true, data: aiDefaults });
  }

  return c.json({ success: true, data: grouped });
});

// 批量更新或创建设置
app.post('/batch', async (c) => {
  const body = await c.req.json();
  const { settings } = body;

  if (!Array.isArray(settings)) {
    throw new BadRequestError('Invalid format. "settings" must be an array.');
  }

  const repo = new SettingsRepository(c.env.DB);
  const count = await repo.batchUpsert(settings);

  return c.json({ success: true, data: { count } });
});

// 单个更新
app.put('/:key', async (c) => {
  const key = c.req.param('key');
  const { value, category, description } = await c.req.json();

  const repo = new SettingsRepository(c.env.DB);
  await repo.upsert(key, { value, category, description });

  return c.json({ success: true, data: { key, value } });
});

export default app;

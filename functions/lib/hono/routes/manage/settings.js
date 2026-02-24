import { Hono } from 'hono';
import { BadRequestError } from '../../errors.js';

const app = new Hono();

// 获取所有设置
app.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM SystemSettings ORDER BY category, "key"'
  ).all();

  // 转换为对象格式: { category: { key: value } }
  const settings = {};

  // 如果数据库为空，尝试从环境变量读取默认值
  if (!results || results.length === 0) {
    // AI Defaults
    const aiDefaults = [
      { key: 'AI_API_KEY', value: c.env.AI_API_KEY || '', category: 'ai' },
      { key: 'AI_API_URL', value: c.env.AI_API_URL || 'https://api.openai.com/v1', category: 'ai' },
      { key: 'AI_MODELS', value: c.env.AI_MODELS || 'gpt-4o', category: 'ai' }
    ];

    return c.json({ success: true, data: aiDefaults.reduce((acc, curr) => {
      if (!acc[curr.category]) acc[curr.category] = {};
      acc[curr.category][curr.key] = curr.value;
      return acc;
    }, {}) });
  }

  results.forEach(row => {
    if (!settings[row.category]) {
      settings[row.category] = {};
    }
    settings[row.category][row.key] = row.value;
  });

  return c.json({ success: true, data: settings });
});

// 批量更新或创建设置
app.post('/batch', async (c) => {
  const body = await c.req.json();
  const { settings } = body; // 期望格式: [{ key, value, category, description? }]

  if (!Array.isArray(settings)) {
    throw new BadRequestError('Invalid format. "settings" must be an array.');
  }

  const stmt = c.env.DB.prepare(
    `INSERT INTO SystemSettings ("key", "value", "category", "description", "updatedAt") 
     VALUES (?, ?, ?, ?, strftime('%s', 'now')) 
     ON CONFLICT("key") DO UPDATE SET 
     "value" = excluded."value", 
     "category" = excluded."category",
     "updatedAt" = strftime('%s', 'now')`
  );

  const batch = settings.map(s => stmt.bind(s.key, s.value, s.category || 'general', s.description || null));

  await c.env.DB.batch(batch);

  return c.json({ success: true, data: { count: settings.length } });
});

// 单个更新
app.put('/:key', async (c) => {
  const key = c.req.param('key');
  const { value, category, description } = await c.req.json();

  await c.env.DB.prepare(
    `INSERT INTO SystemSettings ("key", "value", "category", "description", "updatedAt") 
     VALUES (?, ?, ?, ?, strftime('%s', 'now')) 
     ON CONFLICT("key") DO UPDATE SET 
     "value" = excluded."value",
     "updatedAt" = strftime('%s', 'now')`
  ).bind(key, value, category || 'general', description || null).run();

  return c.json({ success: true, data: { key, value } });
});

export default app;

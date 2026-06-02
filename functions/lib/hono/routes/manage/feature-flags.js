import { Hono } from 'hono';
import { BadRequestError, NotFoundError } from '../../errors.js';
import { SettingsRepository } from '../../../../repositories/SettingsRepository.ts';
import { requirePermission } from '../../middleware/auth.js';
import { withCache } from '../../middleware/cache.js';

const CATEGORY = 'featureFlags';

const app = new Hono();
app.use('*', requirePermission('admin:full'));

// 获取所有功能开关
app.get('/', withCache(30), async (c) => {
  const repo = new SettingsRepository(c.env.DB);
  const grouped = await repo.getAllGrouped();
  const flagsRaw = grouped?.[CATEGORY] || {};

  const flags = Object.entries(flagsRaw).map(([key, value]) => ({
    key,
    enabled: parseBooleanFlag(value),
    description: null,
  }));

  return c.json({ success: true, data: flags });
});

// 更新单个功能开关
app.patch('/:key', async (c) => {
  const key = c.req.param('key');
  const body = await c.req.json().catch(() => ({}));
  const { enabled, description } = body;

  if (enabled === undefined && description === undefined) {
    throw new BadRequestError('至少需要提供 enabled 或 description 字段');
  }

  const repo = new SettingsRepository(c.env.DB);

  // 如果只更新 description，需要先读取当前 value
  let value;
  if (enabled !== undefined) {
    value = String(Boolean(enabled));
  } else {
    const grouped = await repo.getAllGrouped();
    const current = grouped?.[CATEGORY]?.[key];
    if (current === undefined) {
      throw new NotFoundError(`功能开关 "${key}" 不存在`);
    }
    value = current;
  }

  await repo.upsert(key, {
    value,
    category: CATEGORY,
    description: description ?? null,
  });

  return c.json({
    success: true,
    data: { key, enabled: parseBooleanFlag(value), description: description ?? null },
  });
});

// 创建/批量设置功能开关
app.post('/', async (c) => {
  const body = await c.req.json();
  const { flags } = body;

  if (!Array.isArray(flags)) {
    throw new BadRequestError('flags 必须是数组');
  }

  for (const flag of flags) {
    if (!flag.key || flag.enabled === undefined) {
      throw new BadRequestError('每个 flag 必须包含 key 和 enabled 字段');
    }
  }

  const repo = new SettingsRepository(c.env.DB);
  const settings = flags.map((f) => ({
    key: f.key,
    value: String(Boolean(f.enabled)),
    category: CATEGORY,
    description: f.description || null,
  }));

  await repo.batchUpsert(settings);

  return c.json({
    success: true,
    data: { count: settings.length },
  });
});

function parseBooleanFlag(value) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(normalized);
}

export default app;

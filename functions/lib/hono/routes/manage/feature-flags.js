import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { BadRequestError, NotFoundError } from '../../errors.js';
import { SettingsRepository } from '../../../../repositories/SettingsRepository.ts';
import { requirePermission } from '../../middleware/auth.js';
import { withCache } from '../../middleware/cache.js';
import { parseBooleanFlag } from '../../../../ai/config-schema.js';

const CATEGORY = 'featureFlags';

const app = new Hono();
app.use('*', requirePermission('admin:full'));

const FlagKeySchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, 'key 只允许字母、数字、下划线和连字符'),
});

const UpdateFlagSchema = z
  .object({
    enabled: z.boolean().optional(),
    description: z.string().max(500).optional(),
  })
  .strict();

const BatchCreateFlagsSchema = z
  .object({
    flags: z
      .array(
        z.object({
          key: z
            .string()
            .min(1)
            .max(100)
            .regex(/^[a-zA-Z0-9_-]+$/, 'key 只允许字母、数字、下划线和连字符'),
          enabled: z.boolean(),
          description: z.string().max(500).optional(),
        })
      )
      .min(1)
      .max(50),
  })
  .strict();

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
app.patch('/:key', zValidator('json', UpdateFlagSchema), async (c) => {
  const keyParse = FlagKeySchema.safeParse({ key: c.req.param('key') });
  if (!keyParse.success) {
    throw new BadRequestError('无效的 key 格式');
  }
  const key = keyParse.data.key;
  const { enabled, description } = c.req.valid('json');

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
app.post('/', zValidator('json', BatchCreateFlagsSchema), async (c) => {
  const { flags } = c.req.valid('json');

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

export default app;

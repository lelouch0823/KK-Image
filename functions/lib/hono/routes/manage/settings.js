import { Hono } from 'hono';
import { BadRequestError } from '../../errors.js';
import { SettingsRepository } from '../../../../repositories/SettingsRepository.js';
import { parseModels, getModelHealthSnapshot } from '../../../../utils/ai-utils.js';
import { requirePermission } from '../../middleware/auth.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  { method: 'POST', path: '/batch', domain: 'settings', action: 'settings.batch_upsert', severity: 'high', targetType: 'setting' },
  { method: 'PUT', path: '/:key', domain: 'settings', action: 'settings.update', severity: 'high', targetType: 'setting' },
]);
app.use('*', requirePermission('admin:full'));

const normalizeApiBaseUrl = (rawUrl = '') => {
  const trimmed = String(rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  return trimmed;
};

const ensureRequiredAiConfig = ({ apiUrl, apiKey }) => {
  if (!apiUrl) throw new BadRequestError('AI_API_URL is required');
  if (!apiKey) throw new BadRequestError('AI_API_KEY is required');
};

const fetchJsonWithAuth = async (url, apiKey, init = {}) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(init.headers || {}),
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { response, data };
};

const parseBooleanFlag = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(normalized);
};

const parseWindowSize = (value, fallback = 20) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(200, Math.max(5, parsed));
};

const extractModelIds = (payload) => {
  const candidateLists = [
    payload?.data,
    payload?.models,
    payload?.results,
  ];

  for (const list of candidateLists) {
    if (!Array.isArray(list)) continue;
    const ids = list
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return String(item.id || item.model || item.name || '').trim();
        }
        return '';
      })
      .filter(Boolean);
    if (ids.length > 0) {
      return [...new Set(ids)];
    }
  }

  return [];
};

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
        AI_DYNAMIC_FALLBACK_ENABLED: c.env.AI_DYNAMIC_FALLBACK_ENABLED || 'false',
        AI_MODEL_HEALTH_WINDOW: c.env.AI_MODEL_HEALTH_WINDOW || '20',
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
  scheduleAuditEvent(c, {
    domain: 'settings',
    action: 'settings.batch_upsert',
    result: 'success',
    severity: 'high',
    targetType: 'setting',
    summary: `Updated ${count} settings`,
    metadata: { count, keys: settings.map((item) => item?.key).filter(Boolean) },
  });

  return c.json({ success: true, data: { count } });
});

// 单个更新
app.put('/:key', async (c) => {
  const key = c.req.param('key');
  const { value, category, description } = await c.req.json();

  const repo = new SettingsRepository(c.env.DB);
  await repo.upsert(key, { value, category, description });
  scheduleAuditEvent(c, {
    domain: 'settings',
    action: 'settings.update',
    result: 'success',
    severity: 'high',
    targetType: 'setting',
    targetId: key,
    target_label: key,
    summary: `Updated setting ${key}`,
    metadata: { category, description },
  });

  return c.json({ success: true, data: { key, value } });
});

app.post('/ai/models', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const apiUrl = normalizeApiBaseUrl(body.apiUrl);
  const apiKey = String(body.apiKey || '').trim();
  ensureRequiredAiConfig({ apiUrl, apiKey });

  const { response, data } = await fetchJsonWithAuth(`${apiUrl}/models`, apiKey, { method: 'GET' });

  if (!response.ok) {
    throw new BadRequestError(data?.error?.message || `Fetch models failed: HTTP ${response.status}`);
  }

  const models = extractModelIds(data);
  return c.json({
    success: true,
    data: {
      models,
      count: models.length,
    },
  });
});

app.post('/ai/test', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const apiUrl = normalizeApiBaseUrl(body.apiUrl);
  const apiKey = String(body.apiKey || '').trim();
  const model = String(body.model || '').trim();
  ensureRequiredAiConfig({ apiUrl, apiKey });

  const startedAt = Date.now();
  const modelListResult = await fetchJsonWithAuth(`${apiUrl}/models`, apiKey, { method: 'GET' });
  const modelListLatencyMs = Date.now() - startedAt;

  if (!modelListResult.response.ok) {
    throw new BadRequestError(
      modelListResult.data?.error?.message || `Connectivity test failed on /models: HTTP ${modelListResult.response.status}`
    );
  }

  const models = extractModelIds(modelListResult.data);
  const testedModel = model || models[0] || '';
  let completionOk = false;
  let completionLatencyMs = null;

  if (testedModel) {
    const completionStartedAt = Date.now();
    const completionResult = await fetchJsonWithAuth(`${apiUrl}/chat/completions`, apiKey, {
      method: 'POST',
      body: JSON.stringify({
        model: testedModel,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    });
    completionLatencyMs = Date.now() - completionStartedAt;
    completionOk = completionResult.response.ok;
  }

  return c.json({
    success: true,
    data: {
      ok: true,
      modelsEndpointOk: true,
      completionEndpointOk: completionOk,
      modelsCount: models.length,
      testedModel: testedModel || null,
      latencyMs: {
        models: modelListLatencyMs,
        completion: completionLatencyMs,
      },
    },
  });
});

app.get('/ai/health', async (c) => {
  const repo = new SettingsRepository(c.env.DB);
  const grouped = await repo.getAllGrouped().catch(() => null);
  const ai = grouped?.ai || {};

  const modelsFromQuery = parseModels(c.req.query('models') || '');
  const models = modelsFromQuery.length > 0
    ? modelsFromQuery
    : parseModels(ai.AI_MODELS || c.env.AI_MODELS || c.env.AI_MODEL || '');
  const enabled = parseBooleanFlag(ai.AI_DYNAMIC_FALLBACK_ENABLED ?? c.env.AI_DYNAMIC_FALLBACK_ENABLED, false);
  const windowSize = parseWindowSize(ai.AI_MODEL_HEALTH_WINDOW ?? c.env.AI_MODEL_HEALTH_WINDOW, 20);

  const snapshot = getModelHealthSnapshot({ models, windowSize });
  return c.json({
    success: true,
    data: {
      enabled,
      windowSize: snapshot.windowSize,
      models: snapshot.models,
    },
  });
});

export default app;

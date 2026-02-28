import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import settingsApp from '../settings.js';
import * as aiUtils from '../../../../../utils/ai-utils.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) => c.json({ success: false, error: err.message }, err.statusCode || 500));
  app.route('/api/manage/settings', settingsApp);
  return app;
}

describe('settings ai helper routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POST /ai/models returns parsed model ids', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'gpt-4o' },
          { id: 'gpt-4.1-mini' },
        ],
      }),
    }));

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/settings/ai/models',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl: 'https://api.openai.com/v1', apiKey: 'sk-test' }),
      },
      { DB: {} }
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.success).toBe(true);
    expect(payload.data.models).toEqual(['gpt-4o', 'gpt-4.1-mini']);
  });

  it('POST /ai/test validates /models and /chat/completions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'gpt-4o' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { role: 'assistant', content: 'pong' } }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/settings/ai/test',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl: 'https://api.openai.com/v1', apiKey: 'sk-test', model: 'gpt-4o' }),
      },
      { DB: {} }
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.success).toBe(true);
    expect(payload.data.modelsEndpointOk).toBe(true);
    expect(payload.data.completionEndpointOk).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('POST /ai/models rejects missing required config', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/settings/ai/models',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl: '', apiKey: '' }),
      },
      { DB: {} }
    );

    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('AI_API_URL is required');
  });

  it('GET /ai/health returns model health snapshot', async () => {
    const spy = vi.spyOn(aiUtils, 'getModelHealthSnapshot').mockReturnValue({
      windowSize: 20,
      models: [
        {
          model: 'gpt-4o',
          requests: 3,
          failures: 1,
          failureRate: 0.3333,
          avgLatencyMs: 420,
          lastSuccessAt: Date.now(),
          lastFailureAt: Date.now(),
          score: 33720,
        },
      ],
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/settings/ai/health',
      { method: 'GET' },
      {
        DB: {
          prepare: vi.fn(() => ({
            all: vi.fn(async () => ({
              results: [
                { category: 'ai', key: 'AI_MODELS', value: 'gpt-4o, gpt-4o-mini' },
                { category: 'ai', key: 'AI_DYNAMIC_FALLBACK_ENABLED', value: 'true' },
                { category: 'ai', key: 'AI_MODEL_HEALTH_WINDOW', value: '20' },
              ],
            })),
          })),
        },
      }
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.success).toBe(true);
    expect(payload.data.enabled).toBe(true);
    expect(payload.data.windowSize).toBe(20);
    expect(payload.data.models[0].model).toBe('gpt-4o');
    expect(spy).toHaveBeenCalled();
  });
});

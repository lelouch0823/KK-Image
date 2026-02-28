import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callAI, getModelHealthSnapshot, resetModelHealthStatsForTests } from '../ai-utils.js';

const createJsonResponse = ({ ok = true, status = 200, payload = {}, headers = {} } = {}) => ({
  ok,
  status,
  headers: new Headers(headers),
  json: vi.fn().mockResolvedValue(payload),
  text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
});

describe('ai-utils dynamic fallback and health stats', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetModelHealthStatsForTests();
  });

  it('keeps manual primary model when dynamic fallback is enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        payload: {
          choices: [{ message: { role: 'assistant', content: 'ok' } }],
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await callAI([{ role: 'user', content: 'ping' }], [], {
      AI_API_URL: 'https://api.example.com/v1',
      AI_API_KEY: 'sk-test',
      AI_MODELS: 'primary-model, fallback-model',
      AI_DYNAMIC_FALLBACK_ENABLED: 'true',
      AI_MODEL_HEALTH_WINDOW: '20',
    });

    const req = fetchMock.mock.calls[0];
    const body = JSON.parse(req[1].body);
    expect(body.model).toBe('primary-model');
  });

  it('reorders fallback candidates by health when dynamic fallback is enabled', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({ ok: false, status: 500, payload: { error: 'fail-a' } })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          payload: { choices: [{ message: { role: 'assistant', content: 'ok' } }] },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const env = {
      AI_API_URL: 'https://api.example.com/v1',
      AI_API_KEY: 'sk-test',
      AI_MODELS: 'primary-model, slow-a, stable-b',
      AI_DYNAMIC_FALLBACK_ENABLED: 'true',
      AI_MODEL_HEALTH_WINDOW: '20',
    };

    await expect(callAI([{ role: 'user', content: 'first' }], [], env, 1)).rejects.toThrow('AI API error');
    await callAI([{ role: 'user', content: 'second' }], [], env, 1);

    const secondRequestBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondRequestBody.model).toBe('stable-b');

    const snapshot = getModelHealthSnapshot({ models: ['slow-a', 'stable-b'], windowSize: 20 });
    const slow = snapshot.models.find((m) => m.model === 'slow-a');
    const stable = snapshot.models.find((m) => m.model === 'stable-b');
    expect(slow.failureRate).toBeGreaterThan(stable.failureRate);
  });
});

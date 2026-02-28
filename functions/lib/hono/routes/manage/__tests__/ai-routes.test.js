import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const { callAI, executeAITool } = vi.hoisted(() => ({
  callAI: vi.fn(),
  executeAITool: vi.fn(),
}));

vi.mock('../../../../../utils/ai-utils.js', () => ({
  callAI,
  callAIStream: vi.fn(),
  callAIAuto: vi.fn(),
  parseSSEChunk: vi.fn(),
  SYSTEM_PROMPT: vi.fn(() => 'system-prompt'),
}));

vi.mock('../../../../../utils/ai-tool-executor.js', () => ({
  executeAITool,
}));

import aiApp from '../ai.js';

function createApp() {
  const app = new Hono();
  app.route('/api/manage/ai', aiApp);
  return app;
}

describe('manage ai routes - variant tool integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /chat executes getVariantDetail tool and includes variant repo in context', async () => {
    callAI
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_var_1',
                  type: 'function',
                  function: {
                    name: 'getVariantDetail',
                    arguments: JSON.stringify({ id: 'var-1' }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'variant detail ready',
            },
          },
        ],
      });

    executeAITool.mockResolvedValue({
      id: 'var-1',
      product: { id: 'prod-1', name: 'Sneaker' },
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/ai/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: '查一下这个变体' }],
          context: { path: '/products', selectedId: 'var-1' },
        }),
      },
      { DB: {} }
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.success).toBe(true);
    expect(payload.data?.message?.content).toBe('variant detail ready');

    expect(executeAITool).toHaveBeenCalledWith(
      'getVariantDetail',
      { id: 'var-1' },
      expect.objectContaining({
        variantRepo: expect.any(Object),
        productRepo: expect.any(Object),
      })
    );
    expect(callAI).toHaveBeenCalledTimes(2);
  });
});

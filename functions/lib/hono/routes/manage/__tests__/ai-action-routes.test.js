import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

/* global ReadableStream */

const { callAIStream, parseSSEChunk, advance } = vi.hoisted(() => ({
  callAIStream: vi.fn(),
  parseSSEChunk: vi.fn(),
  advance: vi.fn(),
}));

vi.mock('../../../../../utils/ai-utils.js', () => ({
  callAI: vi.fn(),
  callAIStream,
  callAIAuto: vi.fn(),
  parseSSEChunk,
  SYSTEM_PROMPT: vi.fn(() => 'system-prompt'),
}));

vi.mock('../../../../../utils/ai-tool-executor.js', () => ({
  executeAITool: vi.fn(),
}));

vi.mock('../../../../../ai/action-orchestrator.js', () => ({
  AIActionOrchestrator: class {
    async advance(...args) {
      return advance(...args);
    }
  },
}));

vi.mock('../../../../../ai/action-session-store.js', () => ({
  D1ActionSessionStore: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../../../../ai/action-submitters.js', () => ({
  createActionSubmitters: vi.fn(() => ({})),
}));

vi.mock('../../../../../ai/action-registry.js', () => ({
  getActionAdapter: vi.fn(),
}));

import aiApp from '../ai.js';

function createApp() {
  const app = new Hono();
  app.use('/api/manage/ai/*', async (c, next) => {
    c.set('user', { id: 'u-manager', type: 'user', role: 'manager', permissions: [] });
    await next();
  });
  app.route('/api/manage/ai', aiApp);
  return app;
}

function createDbWithSettingsRows(rows = []) {
  return {
    prepare: vi.fn(() => ({
      all: vi.fn(async () => ({ results: rows })),
      bind: vi.fn(function () { return this; }),
      run: vi.fn(async () => ({ success: true })),
      first: vi.fn(async () => null),
    })),
  };
}

describe('manage ai action routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseSSEChunk.mockReturnValue([]);
  });

  it('streams slot_request when create intent lacks required slots', async () => {
    advance.mockResolvedValueOnce({
      kind: 'slot_request',
      payload: { sessionId: 'act-1', missingSlots: ['salespersonId'] },
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/ai/stream',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: '帮我创建订单' }],
          context: {},
        }),
      },
      { DB: createDbWithSettingsRows([]) }
    );

    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain('slot_request');
    expect(callAIStream).not.toHaveBeenCalled();
  });

  it('streams action_preview before submission', async () => {
    advance.mockResolvedValueOnce({
      kind: 'action_preview',
      payload: { sessionId: 'act-2', title: '客户创建预览', summary: { name: 'Alice' } },
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/ai/stream',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: '帮我新增客户 Alice' }],
          context: {},
        }),
      },
      { DB: createDbWithSettingsRows([]) }
    );

    const text = await res.text();
    expect(text).toContain('action_preview');
    expect(callAIStream).not.toHaveBeenCalled();
  });

  it('streams action_submitted and module_refresh after explicit confirmation', async () => {
    advance.mockResolvedValueOnce({
      kind: 'action_submitted',
      payload: {
        sessionId: 'act-3',
        targetModule: 'orders',
        createdEntityId: 'ord-1',
        successMessage: '订单已创建',
      },
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/ai/stream',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: '确认' }],
          context: {},
        }),
      },
      { DB: createDbWithSettingsRows([]) }
    );

    const text = await res.text();
    expect(text).toContain('action_submitted');
    expect(text).toContain('module_refresh');
  });
});

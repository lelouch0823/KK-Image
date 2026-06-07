import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { createAIRateLimitMiddleware } from '../ai-rate-limit.js';

describe('ai-rate-limit middleware', () => {
  it('returns 429 with AI quota headers when budget is denied', async () => {
    const app = new Hono();
    app.use(
      '*',
      createAIRateLimitMiddleware({
        createManager: () => ({
          checkAndConsume: vi.fn().mockResolvedValue({
            allowed: false,
            reason: 'rpm_exceeded',
            remaining: { requests: 0, tokens: 50 },
          }),
        }),
        resolveConfig: async () => ({
          enabled: true,
          requestsPerMinute: 3,
          tokensPerDay: 100,
          imageRequestsPerMinute: 1,
        }),
      })
    );
    app.post('/ai', (c) => c.json({ ok: true }));

    const res = await app.request(
      'http://localhost/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
      },
      {
        AI_KV: { get: vi.fn(), put: vi.fn() },
        executionCtx: { waitUntil: vi.fn() },
      }
    );

    expect(res.status).toBe(429);
    expect(res.headers.get('X-AI-RateLimit-Requests-Limit')).toBe('3');
    expect(res.headers.get('X-AI-RateLimit-Requests-Remaining')).toBe('0');
    expect(res.headers.get('X-AI-RateLimit-Tokens-Limit')).toBe('100');
    expect(res.headers.get('X-AI-RateLimit-Tokens-Remaining')).toBe('50');
  });

  it('ignores x-test-ai-quota-deny header in production environment', async () => {
    const app = new Hono();
    app.use(
      '*',
      createAIRateLimitMiddleware({
        createManager: () => ({
          checkAndConsume: vi.fn().mockResolvedValue({
            allowed: true,
            reason: 'ok',
            remaining: { requests: 59, tokens: 99000 },
          }),
        }),
        resolveConfig: async () => ({
          enabled: true,
          requestsPerMinute: 60,
          tokensPerDay: 100000,
          imageRequestsPerMinute: 20,
        }),
      })
    );
    app.post('/ai', (c) => c.json({ ok: true }));

    const res = await app.request(
      'http://localhost/ai',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-ai-quota-deny': 'test_reason',
        },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
      },
      {
        ENVIRONMENT: 'production',
        AI_KV: { get: vi.fn(), put: vi.fn() },
        executionCtx: { waitUntil: vi.fn() },
      }
    );

    // production 环境下忽略测试 header，请求正常通过
    expect(res.status).toBe(200);
  });
});

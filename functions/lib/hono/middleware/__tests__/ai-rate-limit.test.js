import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { createAIRateLimitMiddleware } from '../ai-rate-limit.js';

describe('ai-rate-limit middleware', () => {
  it('returns 429 with AI quota headers when budget is denied', async () => {
    const app = new Hono();
    app.use('*', createAIRateLimitMiddleware({
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
    }));
    app.post('/ai', (c) => c.json({ ok: true }));

    const res = await app.request('http://localhost/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    }, {
      AI_KV: { get: vi.fn(), put: vi.fn() },
      executionCtx: { waitUntil: vi.fn() },
    });

    expect(res.status).toBe(429);
    expect(res.headers.get('X-AI-RateLimit-Requests-Limit')).toBe('3');
    expect(res.headers.get('X-AI-RateLimit-Requests-Remaining')).toBe('0');
    expect(res.headers.get('X-AI-RateLimit-Tokens-Limit')).toBe('100');
    expect(res.headers.get('X-AI-RateLimit-Tokens-Remaining')).toBe('50');
  });
});

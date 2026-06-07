import { describe, expect, it, vi } from 'vitest';
import { createAIRateLimitManager } from '../rate-limit-manager.js';

describe('ai rate limit manager', () => {
  it('allows request under request-per-minute budget and returns remaining counters', async () => {
    const store = new Map();
    const kv = {
      get: vi.fn(async (key) => store.get(key) ?? null),
      put: vi.fn(async (key, value) => {
        store.set(key, value);
      }),
    };
    const manager = createAIRateLimitManager({ kv, now: () => 1_700_000_000_000 });

    const result = await manager.checkAndConsume({
      userId: 'u-1',
      requestsPerMinute: 3,
      estimatedTokens: 120,
      tokensPerDay: 1000,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining.requests).toBe(2);
    expect(result.remaining.tokens).toBe(880);
  });

  it('rejects request when requests-per-minute budget is exhausted', async () => {
    const windowKey = Math.floor(1_700_000_000_000 / 60000);
    const dayKey = new Date(1_700_000_000_000).toISOString().slice(0, 10);
    // 合并 key 格式：单个 JSON 包含所有计数器
    const store = new Map([
      [
        `ai_quota:u-1`,
        JSON.stringify({
          rpm: 3,
          rpmWindow: windowKey,
          tpd: 0,
          tpdDay: dayKey,
          imgRpm: 0,
          imgWindow: windowKey,
        }),
      ],
    ]);
    const kv = {
      get: vi.fn(async (key, type) => {
        const val = store.get(key) ?? null;
        if (type === 'json' && val) return JSON.parse(val);
        return val;
      }),
      put: vi.fn(async (key, value) => {
        store.set(key, value);
      }),
    };
    const manager = createAIRateLimitManager({ kv, now: () => 1_700_000_000_000 });

    const result = await manager.checkAndConsume({
      userId: 'u-1',
      requestsPerMinute: 3,
      estimatedTokens: 10,
      tokensPerDay: 1000,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('rpm_exceeded');
  });
});

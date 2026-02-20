
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  triggerWebhook,
  registerWebhook,
  deleteWebhook
} from '../webhook';

describe('Webhook Utils Final 100%', () => {
  let env;
  let db;

  beforeEach(() => {
    vi.clearAllMocks();
    db = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      batch: vi.fn().mockResolvedValue([])
    };
    env = { DB: db };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  it('registerWebhook and deleteWebhook success paths', async () => {
    db.first.mockResolvedValueOnce(null); // No existing for register
    const res = await registerWebhook(env, { url: 'https://h.com' });
    expect(res.id).toBeDefined();

    db.first.mockResolvedValueOnce({ id: res.id }); // Found for delete
    expect(await deleteWebhook(env, res.id)).toBe(true);
  });

  it('triggerWebhook coverage (including logs and retries)', async () => {
    db.all.mockResolvedValueOnce({ results: [{ id: 'w1', url: 'https://h.com', enabled: 1 }] });
    globalThis.fetch.mockRejectedValue(new Error('!'));

    vi.useFakeTimers();
    const p = triggerWebhook(env, 'e', {});
    await vi.runAllTimersAsync();
    await p;

    expect(db.prepare).toHaveBeenCalled(); // Should log execution
    vi.useRealTimers();
  });
});

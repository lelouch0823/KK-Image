import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from '../[token].js';

describe('public space access api', () => {
  const spaceRecord = {
    id: 'space-1',
    share_token: 'share-token',
    password: 'secret',
    name: '受保护空间',
    template: 'product',
    description: '',
    view_count: 3,
    cover_file_id: null,
    p_images: '[]',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('records access log and increments view count after password verification succeeds', async () => {
    const first = vi.fn().mockResolvedValue(spaceRecord);
    const all = vi.fn().mockResolvedValue({ results: [] });
    const batch = vi.fn().mockResolvedValue([]);

    const prepare = vi.fn((sql) => {
      if (sql.includes('WHERE s.share_token = ?')) {
        return { bind: () => ({ first }) };
      }
      if (sql.includes('FROM space_files sf')) {
        return { bind: () => ({ all }) };
      }
      if (sql.includes('WHERE s.parent_id = ? AND s.is_public = 1')) {
        return { bind: () => ({ all }) };
      }
      if (sql.includes('INSERT INTO space_access_logs')) {
        return { bind: (...args) => ({ sql, args }) };
      }
      if (sql.includes('UPDATE spaces SET view_count = view_count + 1')) {
        return { bind: (...args) => ({ sql, args }) };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await onRequestPost({
      env: { DB: { prepare, batch } },
      params: { token: 'share-token' },
      request: new Request('http://localhost/api/space/share-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'vitest',
          Referer: 'http://localhost/from',
          'CF-Connecting-IP': '127.0.0.1',
        },
        body: JSON.stringify({ password: 'secret' }),
      }),
    });

    expect(response.status).toBe(200);
    expect(batch).toHaveBeenCalledTimes(1);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.viewCount).toBe(4);
  });
});

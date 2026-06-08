import { describe, expect, it, vi } from 'vitest';

import { onRequestGet, onRequestPost } from '../[token].js';
import { hashPassword } from '../../utils/id.js';

function createDb({ password = 'secret' } = {}) {
  return {
    prepare: vi.fn((sql) => {
      if (sql.includes('SELECT * FROM folders WHERE share_token = ?')) {
        return {
          bind: vi.fn(() => ({
            first: vi.fn(async () => ({
              id: 'folder-1',
              share_token: 'gallery-token',
              name: 'Gallery',
              description: '',
              created_at: 1,
              is_public: 1,
              password,
              share_expires_at: Date.now() + 60_000,
            })),
          })),
        };
      }
      if (sql.includes('FROM files') && sql.includes('WHERE folder_id = ?')) {
        return {
          bind: vi.fn(() => ({
            all: vi.fn(async () => ({
              results: [
                {
                  id: 'file-1',
                  folder_id: 'folder-1',
                  name: 'hero.jpg',
                  original_name: 'hero.jpg',
                  mime_type: 'image/jpeg',
                  storage_key: 'hero-key',
                  size: 10,
                  created_at: 1,
                },
                {
                  id: 'file-2',
                  folder_id: 'folder-1',
                  name: 'detail.jpg',
                  original_name: 'detail.jpg',
                  mime_type: 'image/jpeg',
                  storage_key: 'detail-key',
                  size: 12,
                  created_at: 2,
                },
              ],
            })),
          })),
        };
      }
      if (sql.includes('FROM folders') && sql.includes('parent_id = ?')) {
        return {
          bind: vi.fn(() => ({
            all: vi.fn(async () => ({ results: [] })),
          })),
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }),
  };
}

describe('public gallery access api', () => {
  it('caps public response caching to the signed url lifetime', async () => {
    const response = await onRequestGet({
      env: {
        DB: createDb(),
        JWT_SECRET: 'jwt-secret',
      },
      params: { token: 'gallery-token' },
      request: new Request('http://localhost/api/gallery/gallery-token'),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=900, stale-while-revalidate=0'
    );
  });

  it('does not accept password from query string anymore', async () => {
    const response = await onRequestGet({
      env: { DB: createDb() },
      params: { token: 'gallery-token' },
      request: new Request('http://localhost/api/gallery/gallery-token?password=secret'),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { requiresPassword: true },
    });
  });

  it('returns signed file URLs after password verification succeeds', async () => {
    const response = await onRequestPost({
      env: {
        DB: createDb(),
        JWT_SECRET: 'jwt-secret',
        KV: {
          get: vi.fn(async () => null),
          put: vi.fn(async () => undefined),
          delete: vi.fn(async () => undefined),
        },
      },
      params: { token: 'gallery-token' },
      request: new Request('http://localhost/api/gallery/gallery-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'secret' }),
      }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.files[0].url).toContain('/file/file-1');
    expect(payload.data.files[0].url).toContain('access=');
    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
  });

  it('returns 400 for malformed password JSON', async () => {
    const response = await onRequestPost({
      env: {
        DB: createDb(),
        JWT_SECRET: 'jwt-secret',
        KV: {
          get: vi.fn(async () => null),
          put: vi.fn(async () => undefined),
          delete: vi.fn(async () => undefined),
        },
      },
      params: { token: 'gallery-token' },
      request: new Request('http://localhost/api/gallery/gallery-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
    });
  });

  it('returns 400 for malformed password JSON even when the share is locked', async () => {
    const kv = {
      get: vi.fn(async () => ({
        attempts: 5,
        lockedUntil: Date.now() + 60_000,
      })),
      put: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    };

    const response = await onRequestPost({
      env: {
        DB: createDb(),
        JWT_SECRET: 'jwt-secret',
        KV: kv,
      },
      params: { token: 'gallery-token' },
      request: new Request('http://localhost/api/gallery/gallery-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '203.0.113.9',
        },
        body: '{',
      }),
    });

    expect(response.status).toBe(400);
    expect(kv.get).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      success: false,
    });
  });

  it('returns signed file URLs after hashed password verification succeeds', async () => {
    const hashedPassword = await hashPassword('secret', 'jwt-secret');

    const response = await onRequestPost({
      env: {
        DB: createDb({ password: hashedPassword }),
        JWT_SECRET: 'jwt-secret',
        KV: {
          get: vi.fn(async () => null),
          put: vi.fn(async () => undefined),
          delete: vi.fn(async () => undefined),
        },
      },
      params: { token: 'gallery-token' },
      request: new Request('http://localhost/api/gallery/gallery-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'secret' }),
      }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.files[0].url).toContain('access=');
  });

  it('reuses one shared access token for all gallery files in the same response', async () => {
    const response = await onRequestPost({
      env: {
        DB: createDb(),
        JWT_SECRET: 'jwt-secret',
        KV: {
          get: vi.fn(async () => null),
          put: vi.fn(async () => undefined),
          delete: vi.fn(async () => undefined),
        },
      },
      params: { token: 'gallery-token' },
      request: new Request('http://localhost/api/gallery/gallery-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'secret' }),
      }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    const accessTokens = payload.data.files.map((file) =>
      new URL(file.url, 'http://localhost').searchParams.get('access')
    );

    expect(accessTokens).toHaveLength(2);
    expect(new Set(accessTokens).size).toBe(1);
  });
});

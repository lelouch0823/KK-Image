import { beforeEach, describe, expect, it, vi } from 'vitest';

import { onRequest } from '../[id].js';
import { generateScopedAccessToken } from '../../api/utils/auth.js';

function createObject() {
  return {
    body: new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('ok'));
        controller.close();
      },
    }),
    httpEtag: '"etag"',
    writeHttpMetadata(headers) {
      headers.set('Content-Type', 'image/jpeg');
    },
  };
}

beforeEach(() => {
  globalThis.caches = {
    default: {
      match: vi.fn(async () => null),
      put: vi.fn(async () => undefined),
    },
  };
});

describe('/file access control', () => {
  it('does not serve cached protected files to unauthenticated requests', async () => {
    globalThis.caches.default.match = vi.fn(async () => new Response('cached-ok', { status: 200 }));

    const response = await onRequest({
      request: new Request('http://localhost/file/file-1'),
      params: { id: 'file-1' },
      env: {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              first: vi.fn(async () => ({
                id: 'file-1',
                folder_id: 'folder-1',
                storage_key: 'hero-key',
                mime_type: 'image/jpeg',
                is_deleted: 0,
                created_by: 'sales-1',
              })),
            })),
          })),
        },
        R2_BUCKET: { get: vi.fn(async () => createObject()) },
      },
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(401);
  });

  it('rejects unauthenticated direct fetches for protected files', async () => {
    const response = await onRequest({
      request: new Request('http://localhost/file/file-1'),
      params: { id: 'file-1' },
      env: {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              first: vi.fn(async () => ({
                id: 'file-1',
                folder_id: 'folder-1',
                storage_key: 'hero-key',
                mime_type: 'image/jpeg',
                is_deleted: 0,
                created_by: 'sales-1',
              })),
            })),
          })),
        },
        R2_BUCKET: { get: vi.fn(async () => createObject()) },
      },
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(401);
  });

  it('does not fall back to raw storage key when no database record exists', async () => {
    const response = await onRequest({
      request: new Request('http://localhost/file/hero-key'),
      params: { id: 'hero-key' },
      env: {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              first: vi.fn(async () => null),
            })),
          })),
        },
        R2_BUCKET: { get: vi.fn(async () => createObject()) },
      },
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(404);
  });

  it('allows gallery-scoped signed access tokens', async () => {
    const access = await generateScopedAccessToken(
      {
        sub: 'file-1',
        type: 'public_file_access',
        fileRef: 'file-1',
        shareType: 'gallery',
        shareToken: 'gallery-token',
      },
      { JWT_SECRET: 'jwt-secret' },
      300
    );

    const prepare = vi.fn((sql) => {
      if (sql.includes('FROM files')) {
        return {
          bind: vi.fn(() => ({
            first: vi.fn(async () => ({
              id: 'file-1',
              folder_id: 'folder-1',
              storage_key: 'hero-key',
              mime_type: 'image/jpeg',
              is_deleted: 0,
              created_by: 'sales-1',
            })),
          })),
        };
      }
      if (sql.includes('FROM folders')) {
        return {
          bind: vi.fn(() => ({
            first: vi.fn(async () => ({ id: 1 })),
          })),
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await onRequest({
      request: new Request(`http://localhost/file/file-1?access=${encodeURIComponent(access)}`),
      params: { id: 'file-1' },
      env: {
        JWT_SECRET: 'jwt-secret',
        DB: { prepare },
        R2_BUCKET: { get: vi.fn(async () => createObject()) },
      },
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(200);
  });

  it('allows share-scoped gallery tokens without binding a single file id', async () => {
    const access = await generateScopedAccessToken(
      {
        sub: 'gallery-token',
        type: 'public_file_access',
        shareType: 'gallery',
        shareToken: 'gallery-token',
      },
      { JWT_SECRET: 'jwt-secret' },
      300
    );

    const prepare = vi.fn((sql) => {
      if (sql.includes('FROM files')) {
        return {
          bind: vi.fn(() => ({
            first: vi.fn(async () => ({
              id: 'file-1',
              folder_id: 'folder-1',
              storage_key: 'hero-key',
              mime_type: 'image/jpeg',
              is_deleted: 0,
              created_by: 'sales-1',
            })),
          })),
        };
      }
      if (sql.includes('FROM folders')) {
        return {
          bind: vi.fn(() => ({
            first: vi.fn(async () => ({ id: 1 })),
          })),
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await onRequest({
      request: new Request(`http://localhost/file/file-1?access=${encodeURIComponent(access)}`),
      params: { id: 'file-1' },
      env: {
        JWT_SECRET: 'jwt-secret',
        DB: { prepare },
        R2_BUCKET: { get: vi.fn(async () => createObject()) },
      },
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(200);
  });

  it('does not cache signed protected file responses in the shared cache', async () => {
    const access = await generateScopedAccessToken(
      {
        sub: 'file-1',
        type: 'public_file_access',
        fileRef: 'file-1',
        shareType: 'gallery',
        shareToken: 'gallery-token',
      },
      { JWT_SECRET: 'jwt-secret' },
      300
    );

    const prepare = vi.fn((sql) => {
      if (sql.includes('FROM files')) {
        return {
          bind: vi.fn(() => ({
            first: vi.fn(async () => ({
              id: 'file-1',
              folder_id: 'folder-1',
              storage_key: 'hero-key',
              mime_type: 'image/jpeg',
              is_deleted: 0,
              created_by: 'sales-1',
            })),
          })),
        };
      }
      if (sql.includes('FROM folders')) {
        return {
          bind: vi.fn(() => ({
            first: vi.fn(async () => ({ id: 1 })),
          })),
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await onRequest({
      request: new Request(`http://localhost/file/file-1?access=${encodeURIComponent(access)}`),
      params: { id: 'file-1' },
      env: {
        JWT_SECRET: 'jwt-secret',
        DB: { prepare },
        R2_BUCKET: { get: vi.fn(async () => createObject()) },
      },
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).not.toContain('public');
    expect(globalThis.caches.default.put).not.toHaveBeenCalled();
  });
});

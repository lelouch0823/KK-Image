import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  extractRequestToken: vi.fn(),
  isAdminAuthenticated: vi.fn(),
  verifyJWT: vi.fn(),
  verifyScopedAccessToken: vi.fn(),
}));

vi.mock('../../api/utils/auth.js', async () => {
  const actual = await vi.importActual('../../api/utils/auth.js');
  return {
    ...actual,
    extractRequestToken: authMocks.extractRequestToken,
    isAdminAuthenticated: authMocks.isAdminAuthenticated,
    verifyJWT: authMocks.verifyJWT,
    verifyScopedAccessToken: authMocks.verifyScopedAccessToken,
  };
});

import { onRequest } from '../[id].js';

function createFileRow(overrides = {}) {
  return {
    id: 'file-1',
    folder_id: 'folder-1',
    storage_key: 'hero-key',
    mime_type: 'image/jpeg',
    is_deleted: 0,
    created_by: 'admin-1',
    ...overrides,
  };
}

function createObject(overrides = {}) {
  return {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('ok'));
        controller.close();
      },
    }),
    httpEtag: '"etag"',
    writeHttpMetadata(headers) {
      headers.set('Content-Type', 'image/jpeg');
    },
    ...overrides,
  };
}

function createDb(fileRow, extra = {}) {
  return {
    prepare: vi.fn((sql) => {
      if (sql.includes('FROM files')) {
        return {
          bind: vi.fn(() => ({
            first: vi.fn(async () => fileRow),
          })),
        };
      }
      if (sql.includes('FROM folders')) {
        return {
          bind: vi.fn(() => ({
            first: vi.fn(async () => extra.folderRow || null),
          })),
        };
      }
      if (sql.includes('FROM spaces')) {
        return {
          bind: vi.fn(() => ({
            first: vi.fn(async () => extra.spaceRow || null),
          })),
        };
      }
      if (sql.includes('order_files')) {
        return {
          bind: vi.fn(() => ({
            first: vi.fn(async () => extra.salesRow || null),
          })),
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }),
  };
}

describe('file access extra coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.caches = {
      default: {
        match: vi.fn(async () => null),
        put: vi.fn(async () => undefined),
      },
    };
  });

  it('returns 500 when the database lookup fails', async () => {
    const response = await onRequest({
      request: new Request('http://localhost/file/file-1'),
      params: { id: 'file-1' },
      env: {
        DB: {
          prepare: vi.fn(() => {
            throw new Error('db down');
          }),
        },
        R2_BUCKET: { get: vi.fn() },
      },
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(500);
    expect(await response.text()).toContain('Database error');
  });

  it('rejects deleted files before any storage access happens', async () => {
    const response = await onRequest({
      request: new Request('http://localhost/file/file-1'),
      params: { id: 'file-1' },
      env: {
        DB: createDb(createFileRow({ is_deleted: 1 })),
        R2_BUCKET: { get: vi.fn() },
      },
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(404);
  });

  it('serves external storage urls with public-share cache policy', async () => {
    authMocks.verifyScopedAccessToken.mockResolvedValue({
      fileRef: 'file-1',
      shareType: 'gallery',
      shareToken: 'gallery-token',
    });
    globalThis.fetch = vi.fn(async () =>
      new Response('image-bytes', {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg', 'x-frame-options': 'deny' },
      })
    );

    const response = await onRequest({
      request: new Request('http://localhost/file/file-1?access=token', {
        headers: { 'User-Agent': 'TestUA', Accept: 'image/webp' },
      }),
      params: { id: 'file-1' },
      env: {
        JWT_SECRET: 'jwt-secret',
        DB: createDb(createFileRow({ storage_key: 'https://cdn.example.com/hero.jpg' }), {
          folderRow: { id: 1 },
        }),
        R2_BUCKET: { get: vi.fn() },
      },
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Cache')).toBe('MISS-EXTERNAL');
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=900');
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
  });

  it('returns 500 when R2 is not configured for local storage', async () => {
    authMocks.isAdminAuthenticated.mockResolvedValue(true);

    const response = await onRequest({
      request: new Request('http://localhost/file/file-1'),
      params: { id: 'file-1' },
      env: {
        DB: createDb(createFileRow()),
      },
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(500);
    expect(await response.text()).toContain('R2 not configured');
  });

  it('returns 404 when R2 misses after authorization', async () => {
    authMocks.isAdminAuthenticated.mockResolvedValue(true);

    const response = await onRequest({
      request: new Request('http://localhost/file/file-1'),
      params: { id: 'file-1' },
      env: {
        DB: createDb(createFileRow()),
        R2_BUCKET: { get: vi.fn(async () => null) },
      },
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(404);
  });

  it('applies attachment disposition and conditional request headers to not-modified R2 responses', async () => {
    authMocks.isAdminAuthenticated.mockResolvedValue(true);
    const get = vi.fn(async () => ({
      httpEtag: '"etag"',
      writeHttpMetadata(headers) {
        headers.delete('Content-Type');
      },
    }));

    const response = await onRequest({
      request: new Request('http://localhost/file/file-1', {
        headers: {
          Range: 'bytes=0-10',
          'If-Match': '"abc"',
          'If-None-Match': '"xyz"',
          'If-Unmodified-Since': 'Mon, 01 Jan 2024 00:00:00 GMT',
          'If-Modified-Since': 'Tue, 02 Jan 2024 00:00:00 GMT',
        },
      }),
      params: { id: 'file-1' },
      env: {
        DB: createDb(createFileRow({ mime_type: 'text/html' })),
        R2_BUCKET: { get },
      },
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(304);
    expect(response.headers.get('Content-Disposition')).toBe('attachment');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(get).toHaveBeenCalledWith('hero-key', expect.any(Object));
    const [, options] = get.mock.calls[0];
    expect(typeof options.range.get).toBe('function');
    expect(options.range.get('Range')).toBe('bytes=0-10');
    expect(options.onlyIf).toEqual(
      expect.objectContaining({
        etagMatches: '"abc"',
        etagDoesNotMatch: '"xyz"',
        uploadedBefore: expect.any(Date),
        uploadedAfter: expect.any(Date),
      })
    );
  });

  it('returns partial content when R2 resolves a ranged object body', async () => {
    authMocks.isAdminAuthenticated.mockResolvedValue(true);

    const response = await onRequest({
      request: new Request('http://localhost/file/file-1', {
        headers: { Range: 'bytes=0-10' },
      }),
      params: { id: 'file-1' },
      env: {
        DB: createDb(createFileRow()),
        R2_BUCKET: {
          get: vi.fn(async () =>
            createObject({
              range: { offset: 0, length: 11 },
            })
          ),
        },
      },
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(206);
    expect(response.headers.get('X-Cache')).toBe('MISS');
  });
});

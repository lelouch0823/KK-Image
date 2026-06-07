import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  now: vi.fn(),
}));

vi.mock('../id.js', async () => {
  const actual = await vi.importActual('../id.js');
  return {
    ...actual,
    now: (...args) => mocks.now(...args),
  };
});

import { cleanupOldBackups, performStreamingBackup } from '../backup-utils.js';

describe('backup utils', () => {
  const originalCompressionStream = globalThis.CompressionStream;
  const originalBlobStream = Blob.prototype.stream;
  const originalBlobArrayBuffer = Blob.prototype.arrayBuffer;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T08:00:00.000Z'));
    mocks.now.mockReset().mockReturnValue(1700000000000);
    globalThis.CompressionStream = class CompressionStreamMock {
      constructor() {
        return new TransformStream();
      }
    };
    Blob.prototype.stream = function stream() {
      const blob = this;
      return new ReadableStream({
        async start(controller) {
          controller.enqueue(new Uint8Array(await blob.arrayBuffer()));
          controller.close();
        },
      });
    };
    Blob.prototype.arrayBuffer = async function arrayBuffer() {
      return new Uint8Array().buffer;
    };
  });

  afterEach(() => {
    globalThis.CompressionStream = originalCompressionStream;
    Blob.prototype.stream = originalBlobStream;
    Blob.prototype.arrayBuffer = originalBlobArrayBuffer;
  });

  it('exports table schemas and paginated rows into a gzip backup uploaded to R2', async () => {
    const put = vi.fn(async () => {});
    const env = {
      DB: {
        prepare: vi.fn((sql) => {
          if (sql.includes("WHERE type ='table'")) {
            return {
              all: vi.fn(async () => ({ results: [{ name: 'orders' }, { name: 'customers' }] })),
            };
          }

          if (sql.includes('SELECT sql FROM sqlite_schema WHERE name = ?')) {
            return {
              bind: vi.fn((table) => ({
                first: vi.fn(async () => ({ sql: `CREATE TABLE ${table} (...)` })),
              })),
            };
          }

          if (sql.includes('SELECT * FROM "orders"')) {
            return {
              bind: vi.fn((limit, offset) => ({
                all: vi.fn(async () => ({
                  results: offset === 0 ? [{ id: 1 }, { id: 2 }] : [],
                })),
              })),
            };
          }

          if (sql.includes('SELECT * FROM "customers"')) {
            return {
              bind: vi.fn((limit, offset) => ({
                all: vi.fn(async () => ({
                  results: offset === 0 ? [{ id: 'c-1' }] : [],
                })),
              })),
            };
          }

          throw new Error(`Unexpected SQL: ${sql}`);
        }),
      },
      R2_BACKUP_BUCKET: {
        put,
      },
    };

    const result = await performStreamingBackup(env);

    expect(result).toEqual({
      filename: 'backup_2026-04-18T08-00-00-000Z.json.gz',
      key: 'backup_2026-04-18T08-00-00-000Z.json.gz',
      tables: 2,
      originalSize: expect.any(Number),
      compressedSize: expect.any(Number),
    });
    expect(put).toHaveBeenCalledWith(
      'backup_2026-04-18T08-00-00-000Z.json.gz',
      expect.any(ArrayBuffer),
      expect.objectContaining({
        httpMetadata: {
          contentType: 'application/gzip',
          contentDisposition: 'attachment; filename="backup_2026-04-18T08-00-00-000Z.json.gz"',
        },
        customMetadata: expect.objectContaining({
          type: 'auto-backup',
          timestamp: '1700000000000',
          tables: '2',
        }),
      })
    );
  });

  it('deletes only the oldest backups beyond the retention count', async () => {
    const deleteSpy = vi.fn(async () => {});
    const env = {
      R2_BACKUP_BUCKET: {
        list: vi.fn(async () => ({
          objects: [
            { key: 'a', uploaded: '2026-04-01T00:00:00.000Z' },
            { key: 'b', uploaded: '2026-04-02T00:00:00.000Z' },
            { key: 'c', uploaded: '2026-04-03T00:00:00.000Z' },
          ],
        })),
        delete: deleteSpy,
      },
    };

    await expect(cleanupOldBackups(env, 1)).resolves.toBe(2);
    expect(deleteSpy).toHaveBeenCalledTimes(2);
    expect(deleteSpy).toHaveBeenNthCalledWith(1, 'a');
    expect(deleteSpy).toHaveBeenNthCalledWith(2, 'b');
  });

  it('returns zero when cleanup has nothing to delete', async () => {
    const env = {
      R2_BACKUP_BUCKET: {
        list: vi.fn(async () => ({
          objects: [{ key: 'only', uploaded: '2026-04-01T00:00:00.000Z' }],
        })),
        delete: vi.fn(async () => {}),
      },
    };

    await expect(cleanupOldBackups(env, 7)).resolves.toBe(0);
    expect(env.R2_BACKUP_BUCKET.delete).not.toHaveBeenCalled();
  });
});

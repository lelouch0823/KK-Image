import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBlobByHash,
  createBlob,
  incrementRefCount,
  decrementRefCount,
  createFileReference,
  uploadToBlobStorage
} from '../blob-utils';

describe('Blob Utils', () => {
  const env = {
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      batch: vi.fn(),
    },
    R2_BUCKET: {
      get: vi.fn(),
      put: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // 重置链式调用 mock
    env.DB.prepare.mockReturnThis();
    env.DB.bind.mockReturnThis();
  });

  describe('createBlob', () => {
    it('should create a blob record and increment ref_count if exists', async () => {
      env.DB.run.mockResolvedValueOnce({ success: true });
      await createBlob(env, 'hash1', 100, 'image/png');
      expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO blobs'));
    });
  });

  describe('getBlobByHash', () => {
    it('should fetch blob info from DB', async () => {
      env.DB.first.mockResolvedValueOnce({ content_hash: 'h1' });
      const blob = await getBlobByHash(env, 'h1');
      expect(blob.content_hash).toBe('h1');
    });

    it('should return null if no hash provided', async () => {
      expect(await getBlobByHash(env, null)).toBeNull();
    });
  });

  describe('incrementRefCount', () => {
    it('should call update ref_count', async () => {
      await incrementRefCount(env, 'h1');
      expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE blobs SET ref_count = ref_count + 1'));
    });
  });

  describe('decrementRefCount', () => {
    it('should decrement ref_count and delete if last reference', async () => {
      // batch 返回: [updateResult, selectResult]
      env.DB.batch.mockResolvedValueOnce([
        { success: true },
        { results: [{ ref_count: 0 }] },
      ]);
      env.DB.run.mockResolvedValueOnce({ success: true });

      const deleted = await decrementRefCount(env, 'hash1');

      expect(deleted).toBe(true);
      expect(env.DB.batch).toHaveBeenCalled();
      expect(env.R2_BUCKET.delete).toHaveBeenCalledWith('hash1');
    });

    it('should handle R2 deletion failure gracefully', async () => {
      env.DB.batch.mockResolvedValueOnce([
        { success: true },
        { results: [{ ref_count: 0 }] },
      ]);
      env.DB.run.mockResolvedValueOnce({ success: true });
      env.R2_BUCKET.delete.mockRejectedValueOnce(new Error('R2 Error'));

      const deleted = await decrementRefCount(env, 'hash1');
      expect(deleted).toBe(true);
    });

    it('should just decrement ref_count if not last reference', async () => {
      env.DB.batch.mockResolvedValueOnce([
        { success: true },
        { results: [{ ref_count: 1 }] },
      ]);

      const deleted = await decrementRefCount(env, 'hash1');

      expect(deleted).toBe(false);
      expect(env.DB.batch).toHaveBeenCalled();
    });

    it('should return false if hash not found after update', async () => {
      env.DB.batch.mockResolvedValueOnce([
        { success: true },
        { results: [] },
      ]);
      expect(await decrementRefCount(env, 'h1')).toBe(false);
    });

    it('should return false if no hash provided', async () => {
      expect(await decrementRefCount(env, null)).toBe(false);
    });
  });

  describe('createFileReference', () => {
    it('should insert into files table', async () => {
      const options = { id: 'f1', hash: 'h1', name: 'n', folderId: 'root', mimeType: 'm', size: 10 };
      await createFileReference(env, options);
      expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO files'));
    });
  });

  describe('uploadToBlobStorage', () => {
    it('should put to R2 and create blob', async () => {
      await uploadToBlobStorage(env, 'h1', 'stream', 'm', 10);
      expect(env.R2_BUCKET.put).toHaveBeenCalledWith('h1', 'stream', expect.anything());
      expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO blobs'));
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storeFile } from '../file-utils.js';
import * as blobUtils from '../blob-utils.js';

// Mock dependencies
vi.mock('../id.js', () => ({
  generateId: () => 'file-id-123',
  now: () => 1000,
  sha256Hex: async () => 'mock-hash-123',
}));

vi.mock('../blob-utils.js', () => ({
  getBlobByHash: vi.fn(),
  createBlob: vi.fn(),
  incrementRefCount: vi.fn(),
}));

// Mock FileRepository
const mockFindByNameInFolder = vi.fn();
const mockCreate = vi.fn();

// Mock the module used by file-utils.js
vi.mock('../../../repositories/FileRepository.js', () => ({
  FileRepository: class {
    constructor(db) {
      this.db = db;
    }
    findByNameInFolder = mockFindByNameInFolder;
    create = mockCreate;
  },
}));

describe('storeFile - Duplicate Handling', () => {
  const env = {
    DB: {
      prepare: vi.fn(), // Fallback
    },
    R2_BUCKET: { put: vi.fn() },
    MAX_UPLOAD_SIZE: 1024 * 1024 * 10, // 10MB
  };

  const file = new File(['content'], 'test.png', { type: 'image/png' });
  // Polyfill arrayBuffer
  if (!file.arrayBuffer) {
    file.arrayBuffer = async () => new ArrayBuffer(0);
  }
  // Polyfill stream
  if (!file.stream) {
    file.stream = () => 'mock-stream';
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Scenario A: Same Name + Same Hash -> Instant Upload (Duplicate)', async () => {
    // Mock existing file with same name and hash
    mockFindByNameInFolder.mockResolvedValueOnce({
      id: 'existing-id',
      name: 'test.png',
      content_hash: 'mock-hash-123',
      storage_key: 'existing-key',
      size: 7,
      mime_type: 'image/png',
    });

    const result = await storeFile(env, file, { folderId: 'root' });

    expect(result.instantUpload).toBe(true);
    expect(result.isDuplicate).toBe(true);
    expect(result.id).toBe('existing-id');
    expect(mockCreate).not.toHaveBeenCalled(); // No new DB record
    expect(env.R2_BUCKET.put).not.toHaveBeenCalled(); // No R2 upload
  });

  it('Scenario B: Same Name + Diff Hash -> Auto Rename', async () => {
    const existingFile = {
      id: 'existing-id',
      name: 'test.png',
      content_hash: 'diff-hash', // Different hash
    };

    // 1. storeFile checking 'test.png' -> Found
    mockFindByNameInFolder.mockResolvedValueOnce(existingFile);

    // 2. generateUniqueName checking 'test.png' -> Found (enter loop)
    mockFindByNameInFolder.mockResolvedValueOnce(existingFile);

    // 3. generateUniqueName checking 'test (1).png' -> Not Found (exit loop)
    mockFindByNameInFolder.mockResolvedValueOnce(null);

    // Mock blob utils (new blob)
    vi.spyOn(blobUtils, 'getBlobByHash').mockResolvedValue(null);

    const result = await storeFile(env, file, { folderId: 'root' });

    expect(result.name).toBe('test (1).png'); // Renamed
    expect(result.isDuplicate).toBeUndefined();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test (1).png',
        originalName: 'test.png',
      })
    );
    expect(env.R2_BUCKET.put).toHaveBeenCalled();
  });

  it('Scenario C: New File -> Normal Upload', async () => {
    mockFindByNameInFolder.mockResolvedValue(null);
    vi.spyOn(blobUtils, 'getBlobByHash').mockResolvedValue(null);

    const result = await storeFile(env, file, { folderId: 'root' });

    expect(result.name).toBe('test.png');
    expect(mockCreate).toHaveBeenCalled();
  });
});

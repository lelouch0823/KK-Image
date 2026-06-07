import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ensureFolder,
  ensureProductFolder,
  moveFilesToFolder,
  ensureOrderFolder,
} from '../folder-utils';

describe('Folder Utils', () => {
  let statement;
  let env;

  beforeEach(() => {
    vi.clearAllMocks();
    statement = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ id: 'mock-id' }),
      run: vi.fn().mockResolvedValue({ success: true }),
    };
    env = {
      DB: {
        prepare: vi.fn().mockReturnValue(statement),
      },
    };
  });

  describe('ensureFolder', () => {
    it('should return existing folder ID if found', async () => {
      statement.first.mockResolvedValueOnce({ id: 'existing-id' });

      const id = await ensureFolder(env, 'MyFolder', 'root');

      expect(id).toBe('existing-id');
      expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR IGNORE'));
      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM folders')
      );
    });

    it('should return new ID if folder was just created', async () => {
      statement.first.mockResolvedValueOnce(null);

      const id = await ensureFolder(env, 'NewFolder');
      expect(id).toBeDefined();
    });
  });

  describe('System Folders', () => {
    it('ensureProductFolder should create _System root before Products', async () => {
      statement.first.mockResolvedValue({ id: 'root-id' });
      await ensureProductFolder(env);
      expect(statement.bind).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        null,
        '_System',
        expect.any(Number),
        expect.any(Number),
        1
      );
      expect(statement.bind).toHaveBeenNthCalledWith(
        3,
        expect.any(String),
        'root-id',
        'Products',
        expect.any(Number),
        expect.any(Number),
        1
      );
    });
  });

  describe('moveFilesToFolder', () => {
    it('should update folder_id for multiple file IDs', async () => {
      await moveFilesToFolder(env, ['file1', 'file2'], 'folder-a');
      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE files SET folder_id = ? WHERE id IN (?,?)')
      );
      expect(statement.bind).toHaveBeenCalledWith('folder-a', 'file1', 'file2');
    });

    it('should return early if no file IDs provided', async () => {
      await moveFilesToFolder(env, [], 'folder-a');
      expect(env.DB.prepare).not.toHaveBeenCalled();
    });
  });

  describe('ensureOrderFolder', () => {
    it('should create nested folder structure', async () => {
      statement.first.mockResolvedValue({ id: 'nested-id' });
      const id = await ensureOrderFolder(env, 'ORD-123');
      expect(id).toBe('nested-id');
    });

    it('should fallback to root on error', async () => {
      env.DB.prepare.mockImplementation(() => {
        throw new Error('DB Error');
      });
      const id = await ensureOrderFolder(env, 'ORD-123');
      expect(id).toBe('root');
    });
  });
});

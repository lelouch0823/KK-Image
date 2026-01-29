import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  ensureFolder, 
  ensureSystemRoot, 
  ensureProductFolder, 
  moveFilesToFolder, 
  ensureOrderFolder 
} from '../folder-utils';

describe('Folder Utils', () => {
  const env = {
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn().mockResolvedValue({ success: true })
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureFolder', () => {
    it('should return existing folder ID if found', async () => {
      env.DB.first.mockResolvedValueOnce({ id: 'existing-id' });
      
      const id = await ensureFolder(env, 'MyFolder', 'root');
      
      expect(id).toBe('existing-id');
      expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR IGNORE'));
      expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT id FROM folders'));
    });

    it('should return new ID if folder was just created', async () => {
      env.DB.first.mockResolvedValueOnce(null);
      
      const id = await ensureFolder(env, 'NewFolder');
      expect(id).toBeDefined();
    });
  });

  describe('System Folders', () => {
    it('ensureSystemRoot should call ensureFolder with correct params', async () => {
      env.DB.first.mockResolvedValue({ id: 'root-id' });
      const id = await ensureSystemRoot(env);
      expect(id).toBe('root-id');
      expect(env.DB.bind).toHaveBeenCalledWith(expect.anything(), null, '_System', expect.anything(), expect.anything(), 1);
    });

    it('ensureProductFolder should create Products under SystemRoot', async () => {
       env.DB.first.mockResolvedValue({ id: 'sys-product-id' });
       await ensureProductFolder(env);
       expect(env.DB.bind).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'Products', expect.anything(), expect.anything(), 1);
    });
  });

  describe('moveFilesToFolder', () => {
    it('should update folder_id for multiple file IDs', async () => {
      await moveFilesToFolder(env, ['file1', 'file2'], 'folder-a');
      expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE files SET folder_id = ? WHERE id IN (?,?)'));
      expect(env.DB.bind).toHaveBeenCalledWith('folder-a', 'file1', 'file2');
    });

    it('should return early if no file IDs provided', async () => {
      await moveFilesToFolder(env, [], 'folder-a');
      expect(env.DB.prepare).not.toHaveBeenCalled();
    });
  });

  describe('ensureOrderFolder', () => {
    it('should create nested folder structure', async () => {
      env.DB.first.mockResolvedValue({ id: 'nested-id' });
      const id = await ensureOrderFolder(env, 'ORD-123');
      expect(id).toBe('nested-id');
    });

    it('should fallback to root on error', async () => {
      env.DB.prepare.mockImplementation(() => { throw new Error('DB Error'); });
      const id = await ensureOrderFolder(env, 'ORD-123');
      expect(id).toBe('root');
    });
  });
});

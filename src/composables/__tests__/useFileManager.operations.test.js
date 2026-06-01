import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { useFileManager } from '../useFileManager';

const mockAuthFetch = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('../useAuth', () => ({
  useAuth: () => ({
    authFetch: mockAuthFetch,
  }),
}));

vi.mock('../useToast', () => ({
  useToast: () => ({
    success: toastSuccess,
    error: toastError,
  }),
}));

vi.mock('../useI18n', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));

describe('useFileManager operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads a folder detail payload and resets selection state', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            id: 'folder-1',
            name: 'Folder 1',
            subfolders: [{ id: 'sub-1' }],
            files: [{ id: 'file-1', name: 'demo.jpg' }],
            breadcrumbs: [{ id: 'folder-1', name: 'Folder 1' }],
          },
        }),
    });

    const store = useFileManager();
    store.selectedFiles.value = ['old-selection'];

    await store.loadFolderData('folder-1');

    expect(store.currentFolder.value).toEqual(expect.objectContaining({ id: 'folder-1' }));
    expect(store.subfolders.value).toEqual([{ id: 'sub-1' }]);
    expect(store.files.value).toEqual([{ id: 'file-1', name: 'demo.jpg' }]);
    expect(store.breadcrumbs.value).toEqual([{ id: 'folder-1', name: 'Folder 1' }]);
    expect(store.selectedFiles.value).toEqual([]);
  });

  it('aborts in-flight folder requests when the composable scope is disposed', async () => {
    let capturedSignal;
    mockAuthFetch.mockImplementationOnce((_url, options = {}) => {
      capturedSignal = options.signal;

      return new Promise((_resolve, reject) => {
        capturedSignal.addEventListener('abort', () => {
          const abortError = new Error('aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    });

    const scope = effectScope();
    const store = scope.run(() => useFileManager());
    const pending = store.loadFolderData('folder-1');

    await Promise.resolve();
    expect(capturedSignal.aborted).toBe(false);

    scope.stop();

    await expect(pending).resolves.toBeUndefined();
    expect(capturedSignal.aborted).toBe(true);
  });

  it('surfaces folder detail payload failures', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, message: 'folder missing' }),
    });

    const store = useFileManager();
    await store.loadFolderData('folder-missing');

    expect(store.error.value).toBe('folder missing');
    expect(store.errorCode.value).toBe(null);
    expect(toastError).toHaveBeenCalledWith('folder missing');
  });

  it('loads root data, normalizes file payload shapes, and keeps folder-list failures toast-only', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: [{ id: 'folder-1', name: 'Folder 1' }],
          }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { unexpected: true },
          }),
      });

    const store = useFileManager();
    await store.loadFolderData();

    expect(store.subfolders.value).toEqual([{ id: 'folder-1', name: 'Folder 1' }]);
    expect(store.files.value).toEqual([]);

    vi.clearAllMocks();

    mockAuthFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: false,
            message: 'folder list unavailable',
          }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              data: [{ id: 'file-1', name: 'root-file.jpg' }],
            },
          }),
      });

    await store.loadFolderData();

    expect(store.subfolders.value).toEqual([]);
    expect(store.files.value).toEqual([{ id: 'file-1', name: 'root-file.jpg' }]);
    expect(store.error.value).toBe(null);
    expect(store.errorCode.value).toBe(null);
    expect(toastError).toHaveBeenCalledWith('fileOps.loadFailed');
  });

  it('sets a page-level error when root file loading fails', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: [] }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: false,
            message: 'files unavailable',
          }),
      });

    const store = useFileManager();
    await store.loadFolderData();

    expect(store.files.value).toEqual([]);
    expect(store.error.value).toBe('files unavailable');
    expect(store.errorCode.value).toBe(null);
    expect(toastError).toHaveBeenCalledWith('fileOps.loadFailed');
  });

  it('creates, updates, and deletes folders through the management endpoints', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: 'parent-1',
              subfolders: [],
              files: [],
              breadcrumbs: [],
            },
          }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: 'parent-1',
              subfolders: [],
              files: [],
              breadcrumbs: [],
            },
          }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: [],
          }),
      });

    const store = useFileManager();
    store.currentFolder.value = { id: 'parent-1', parentId: 'root' };

    await expect(store.createFolder({ name: 'New folder' })).resolves.toBe(true);
    await expect(store.updateFolder('folder-1', { name: 'Updated' })).resolves.toBe(true);
    await expect(store.deleteFolder('folder-1')).resolves.toBe(true);

    const calls = mockAuthFetch.mock.calls;

    expect(calls[0]).toEqual([
      '/api/manage/folders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'New folder', parentId: 'parent-1' }),
      }),
    ]);
    expect(calls[1][0]).toBe('/api/manage/folders/parent-1');

    expect(calls[2]).toEqual([
      '/api/manage/folders/folder-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
      }),
    ]);
    expect(calls[3][0]).toBe('/api/manage/folders/parent-1');

    expect(calls[4]).toEqual([
      '/api/manage/folders/folder-1',
      expect.objectContaining({
        method: 'DELETE',
      }),
    ]);
    expect(calls[5][0]).toBe('/api/manage/folders/parent-1');
    expect(toastSuccess).toHaveBeenCalledWith('fileOps.folderCreateSuccess');
    expect(toastSuccess).toHaveBeenCalledWith('fileOps.updateSuccess');
    expect(toastSuccess).toHaveBeenCalledWith('fileOps.deleteSuccess');
  });

  it('renames and batch-moves files successfully', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: 'folder-1',
              subfolders: [],
              files: [],
              breadcrumbs: [],
            },
          }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, message: 'moved' }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: 'folder-1',
              subfolders: [],
              files: [],
              breadcrumbs: [],
            },
          }),
      });

    const store = useFileManager();
    store.currentFolder.value = { id: 'folder-1' };

    await expect(store.renameFile('file-1', 'renamed.jpg')).resolves.toBe(true);
    await expect(store.batchMoveFiles(['file-1', 'file-2'], 'folder-2')).resolves.toBe(true);

    const calls = mockAuthFetch.mock.calls;

    expect(calls[0]).toEqual([
      '/api/v1/files/file-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'renamed.jpg' }),
      }),
    ]);
    expect(calls[1][0]).toBe('/api/manage/folders/folder-1');
    expect(calls[2]).toEqual([
      '/api/v1/files/batch/move',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ ids: ['file-1', 'file-2'], targetFolderId: 'folder-2' }),
      }),
    ]);
    expect(calls[3][0]).toBe('/api/manage/folders/folder-1');
    expect(toastSuccess).toHaveBeenCalledWith('fileOps.renameSuccess');
    expect(toastSuccess).toHaveBeenCalledWith('moved');
  });

  it('routes renameFolder and moveFolder through folder updates', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 'parent-1', subfolders: [], files: [], breadcrumbs: [] },
          }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 'parent-1', subfolders: [], files: [], breadcrumbs: [] },
          }),
      });

    const store = useFileManager();
    store.currentFolder.value = { id: 'parent-1' };

    await expect(store.renameFolder('folder-1', 'Renamed folder')).resolves.toBe(true);
    await expect(store.moveFolder('folder-1', 'folder-2')).resolves.toBe(true);

    const calls = mockAuthFetch.mock.calls;
    expect(calls[0]).toEqual([
      '/api/manage/folders/folder-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'Renamed folder' }),
      }),
    ]);
    expect(calls[2]).toEqual([
      '/api/manage/folders/folder-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ parentId: 'folder-2' }),
      }),
    ]);
  });

  it('reports mutation failures for folders and files', async () => {
    mockAuthFetch
      .mockRejectedValueOnce(new Error('create exploded'))
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, message: 'cannot update' }),
      })
      .mockRejectedValueOnce(new Error('delete exploded'))
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, message: 'file locked' }),
      })
      .mockRejectedValueOnce(new Error('network down'));

    const store = useFileManager();

    await expect(store.createFolder({ name: 'Broken folder' })).resolves.toBe(false);
    await expect(store.updateFolder('folder-1', { name: 'Broken update' })).resolves.toBe(false);
    await expect(store.deleteFolder('folder-1')).resolves.toBe(false);
    await store.deleteFile('file-1');
    await store.deleteFile('file-2');

    expect(toastError).toHaveBeenCalledWith('fileOps.createFailed');
    expect(toastError).toHaveBeenCalledWith('cannot update');
    expect(toastError).toHaveBeenCalledWith('fileOps.deleteFailed');
    expect(toastError).toHaveBeenCalledWith('file locked');
  });

  it('refreshes the parent folder when deleting the current folder', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 'parent-folder', subfolders: [], files: [], breadcrumbs: [] },
          }),
      });

    const store = useFileManager();
    store.currentFolder.value = { id: 'folder-1', parentId: 'parent-folder' };

    await expect(store.deleteFolder('folder-1')).resolves.toBe(true);

    expect(mockAuthFetch.mock.calls[1][0]).toBe('/api/manage/folders/parent-folder');
  });

  it('handles rename and batch file operation failures', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, message: 'rename rejected' }),
      })
      .mockRejectedValueOnce(new Error('rename exploded'))
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, message: 'deleted' }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 'folder-1', subfolders: [], files: [], breadcrumbs: [] },
          }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, message: 'batch delete rejected' }),
      })
      .mockRejectedValueOnce(new Error('batch delete exploded'))
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, message: 'batch move rejected' }),
      })
      .mockRejectedValueOnce(new Error('batch move exploded'));

    const store = useFileManager();
    store.currentFolder.value = { id: 'folder-1' };

    await expect(store.renameFile('file-1', 'bad-name.jpg')).resolves.toBe(false);
    await expect(store.renameFile('file-2', 'bad-name-2.jpg')).resolves.toBe(false);
    await expect(store.batchDeleteFiles(['file-1'])).resolves.toBe(true);
    await expect(store.batchDeleteFiles(['file-2'])).resolves.toBe(false);
    await expect(store.batchDeleteFiles(['file-3'])).resolves.toBe(false);
    await expect(store.batchMoveFiles(['file-1'], 'folder-2')).resolves.toBe(false);
    await expect(store.batchMoveFiles(['file-2'], 'folder-2')).resolves.toBe(false);

    expect(toastSuccess).toHaveBeenCalledWith('deleted');
    expect(toastError).toHaveBeenCalledWith('rename rejected');
    expect(toastError).toHaveBeenCalledWith('fileOps.renameFailed');
    expect(toastError).toHaveBeenCalledWith('batch delete rejected');
    expect(toastError).toHaveBeenCalledWith('fileOps.deleteFailed');
    expect(toastError).toHaveBeenCalledWith('batch move rejected');
    expect(toastError).toHaveBeenCalledWith('fileOps.moveFailed');
  });

  it('loads trash data and exposes trash-specific view state', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: [{ id: 'trash-file-1', type: 'file', name: 'old.jpg' }],
        }),
    });

    const store = useFileManager();
    await store.loadTrashData();

    expect(store.files.value).toEqual([{ id: 'trash-file-1', type: 'file', name: 'old.jpg' }]);
    expect(store.currentFolder.value).toEqual({ id: 'trash', isTrash: true, name: 'trash.title' });
    expect(store.breadcrumbs.value).toEqual([{ name: 'trash.title', path: '/admin/trash' }]);
  });

  it('restores and permanently deletes mixed trash items by separating file and folder ids', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

    const store = useFileManager();
    store.files.value = [
      { id: 'file-1', type: 'file' },
      { id: 'folder-1', type: 'folder' },
    ];

    await expect(store.restoreTrashItems(['file-1', 'folder-1'])).resolves.toBe(true);
    await expect(store.deleteTrashItems(['file-1', 'folder-1'])).resolves.toBe(true);

    expect(mockAuthFetch).toHaveBeenNthCalledWith(
      1,
      '/api/manage/trash/restore',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ fileIds: ['file-1'], folderIds: ['folder-1'] }),
      })
    );
    expect(mockAuthFetch).toHaveBeenNthCalledWith(
      2,
      '/api/manage/trash/delete',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ fileIds: ['file-1'], folderIds: ['folder-1'] }),
      })
    );
    expect(toastSuccess).toHaveBeenCalledWith('trash.restoreSuccess');
    expect(toastSuccess).toHaveBeenCalledWith('trash.deleteSuccess');
  });

  it('empties the trash and falls back to error toasts on trash action failures', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, message: 'cannot restore' }),
      })
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('network down'));

    const store = useFileManager();
    store.files.value = [{ id: 'file-1', type: 'file' }];

    await expect(store.emptyTrash()).resolves.toBe(true);
    await expect(store.restoreTrashItems(['file-1'])).resolves.toBe(false);
    await expect(store.deleteTrashItems(['file-1'])).resolves.toBe(false);
    await expect(store.emptyTrash()).resolves.toBe(false);

    expect(toastSuccess).toHaveBeenCalledWith('trash.emptySuccess');
    expect(toastError).toHaveBeenCalledWith('cannot restore');
    expect(toastError).toHaveBeenCalledWith('common.networkError');
  });

  it('surfaces trash loading and destructive action failures', async () => {
    const trashLoadError = new Error('trash crashed');
    trashLoadError.status = 500;
    trashLoadError.data = { error: 'trash crashed' };

    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, message: 'trash unavailable' }),
      })
      .mockRejectedValueOnce(trashLoadError)
      .mockRejectedValueOnce(new Error('restore exploded'))
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, message: 'cannot delete permanently' }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, message: 'cannot empty trash' }),
      });

    const store = useFileManager();
    store.files.value = [{ id: 'file-1', type: 'file' }];

    await store.loadTrashData();
    expect(store.error.value).toBe('trash unavailable');
    expect(toastError).toHaveBeenCalledWith('trash unavailable');

    await store.loadTrashData();
    expect(store.error.value).toBe('trash crashed');
    expect(toastError).toHaveBeenCalledWith('fileOps.loadFailed');

    await expect(store.restoreTrashItems(['file-1'])).resolves.toBe(false);
    await expect(store.deleteTrashItems(['file-1'])).resolves.toBe(false);
    await expect(store.emptyTrash()).resolves.toBe(false);

    expect(toastError).toHaveBeenCalledWith('common.networkError');
    expect(toastError).toHaveBeenCalledWith('cannot delete permanently');
    expect(toastError).toHaveBeenCalledWith('cannot empty trash');
  });

  it('re-exports formatter helpers for file presentation', () => {
    const store = useFileManager();

    expect(store.getFileExtension('photo.JPG')).toBe('JPG');
    expect(store.isImage({ name: 'photo.png' })).toBe(true);
    expect(store.formatSize(1024)).toContain('KB');
    expect(store.formatDate(Date.parse('2026-04-18T00:00:00.000Z'))).toContain('2026');
  });
});

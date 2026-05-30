import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSpaces } from '../useSpaces';

// Mock dependencies
const mockAuthFetch = vi.fn();
const mockAddToast = vi.fn();
const mockT = vi.fn((key) => key);
const mockResource = vi.hoisted(() => ({
    items: { value: [] },
    loading: { value: false },
    error: { value: null },
    errorCode: { value: null },
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    loadItems: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
}));

vi.mock('../useAuth', () => ({
    useAuth: () => ({ authFetch: mockAuthFetch }),
}));

vi.mock('../useToast', () => ({
    useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../useI18n', () => ({
    useI18n: () => ({ t: mockT }),
}));

vi.mock('../useResource', () => ({
    useResource: () => mockResource,
}));

vi.mock('@/utils/constants', () => ({
    API: {
        SPACES: '/api/spaces',
        SPACE_BY_ID: (id) => `/api/spaces/${id}`,
        SPACE_FILES: (id) => `/api/spaces/${id}/files`,
        SPACE_SUBSPACES: (id) => `/api/spaces/${id}/subspaces`,
        SPACE_BY_PRODUCT: (id) => `/api/spaces/product/${id}`,
    },
}));

describe('useSpaces Composable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResource.loadItems.mockReset();
        mockResource.createItem.mockReset();
        mockResource.updateItem.mockReset();
        mockResource.deleteItem.mockReset();
    });

    it('delegates list loading to the shared resource layer', async () => {
        mockResource.loadItems.mockResolvedValue(true);

        const spaces = useSpaces();

        await spaces.loadSpaces('parent-1');
        await spaces.loadSpaces();

        expect(mockResource.loadItems).toHaveBeenNthCalledWith(1, { parent_id: 'parent-1' });
        expect(mockResource.loadItems).toHaveBeenNthCalledWith(2, {});
        expect(spaces.createSpace).toBe(mockResource.createItem);
        expect(spaces.updateSpace).toBe(mockResource.updateItem);
        expect(spaces.deleteSpace).toBe(mockResource.deleteItem);
    });

    describe('loadProductSpaces', () => {
        it('should fetch and return spaces for a specific product', async () => {
            const mockSpaces = [{ id: 'space1', name: 'Product Space' }];
            mockAuthFetch.mockResolvedValue({
                json: () => Promise.resolve({ success: true, data: mockSpaces }),
            });

            const { loadProductSpaces } = useSpaces();
            const result = await loadProductSpaces('prod123');

            expect(mockAuthFetch).toHaveBeenCalledWith('/api/spaces/product/prod123');
            expect(result).toEqual(mockSpaces);
        });

        it('should throw the backend error if the API response is unsuccessful', async () => {
            mockAuthFetch.mockResolvedValue({
                json: () => Promise.resolve({ success: false, error: 'Database error' }),
            });

            const { loadProductSpaces } = useSpaces();
            await expect(loadProductSpaces('prod123')).rejects.toThrow('Database error');
            expect(mockAuthFetch).toHaveBeenCalledWith('/api/spaces/product/prod123');
        });

        it('should throw on network error', async () => {
            mockAuthFetch.mockRejectedValue(new Error('Network failure'));

            const { loadProductSpaces } = useSpaces();
            await expect(loadProductSpaces('prod123')).rejects.toThrow('Network failure');
            expect(mockAuthFetch).toHaveBeenCalledWith('/api/spaces/product/prod123');
        });
    });

    it('loads space detail and exposes failure states through toasts', async () => {
        mockAuthFetch
            .mockResolvedValueOnce({
                json: () => Promise.resolve({ success: true, data: { id: 'space-1', name: 'Alpha' } }),
            })
            .mockResolvedValueOnce({
                json: () => Promise.resolve({ success: false, message: 'detail failed' }),
            })
            .mockRejectedValueOnce(new Error('network down'));

        const { loadSpace, currentSpace } = useSpaces();

        await expect(loadSpace('space-1')).resolves.toEqual({ id: 'space-1', name: 'Alpha' });
        expect(currentSpace.value).toEqual({ id: 'space-1', name: 'Alpha' });

        await expect(loadSpace('space-2')).resolves.toBeNull();
        expect(mockAddToast).toHaveBeenCalledWith({ message: 'detail failed', type: 'error' });

        await expect(loadSpace('space-3')).resolves.toBeNull();
        expect(mockAddToast).toHaveBeenCalledWith({ message: 'network down', type: 'error' });
    });

    it('handles add/remove/reorder flows for space files', async () => {
        mockAuthFetch
            .mockResolvedValueOnce({
                json: () => Promise.resolve({ success: true, message: 'added ok' }),
            })
            .mockResolvedValueOnce({
                json: () => Promise.resolve({ success: true, message: 'added folders ok' }),
            })
            .mockResolvedValueOnce({
                json: () => Promise.resolve({ success: false, message: 'remove failed' }),
            })
            .mockRejectedValueOnce(new Error('network down'))
            .mockResolvedValueOnce({
                json: () => Promise.resolve({ success: true }),
            })
            .mockResolvedValueOnce({
                json: () => Promise.resolve({ success: false, message: 'reorder failed' }),
            });

        const {
            addFilesToSpace,
            removeFilesFromSpace,
            reorderSpaceFiles,
        } = useSpaces();

        await expect(addFilesToSpace('space-1', ['file-1', 'file-2'], 'hero')).resolves.toBe(true);
        expect(mockAuthFetch).toHaveBeenNthCalledWith(
            1,
            '/api/spaces/space-1/files',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ fileIds: ['file-1', 'file-2'], section: 'hero' }),
            })
        );

        await expect(
            addFilesToSpace('space-1', { fileIds: ['file-3'], folderIds: ['folder-1'] }, 'detail')
        ).resolves.toBe(true);
        expect(mockAuthFetch).toHaveBeenNthCalledWith(
            2,
            '/api/spaces/space-1/files',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    fileIds: ['file-3'],
                    folderIds: ['folder-1'],
                    section: 'detail',
                }),
            })
        );

        await expect(removeFilesFromSpace('space-1', ['file-1'])).resolves.toBe(false);
        expect(mockAddToast).toHaveBeenCalledWith({ message: 'remove failed', type: 'error' });

        await expect(removeFilesFromSpace('space-1', ['file-2'])).resolves.toBe(false);
        expect(mockAddToast).toHaveBeenCalledWith({ message: 'network down', type: 'error' });

        await expect(reorderSpaceFiles('space-1', ['file-2', 'file-1'])).resolves.toBe(true);
        await expect(reorderSpaceFiles('space-1', ['file-1'])).resolves.toBe(false);
        expect(mockAddToast).toHaveBeenCalledWith({ message: 'reorder failed', type: 'error' });
    });

    it('loads subspaces and creates subspaces with success and fallback branches', async () => {
        mockAuthFetch
            .mockResolvedValueOnce({
                json: () => Promise.resolve({ success: true, data: [{ id: 'sub-1' }] }),
            })
            .mockResolvedValueOnce({
                json: () => Promise.resolve({ success: false, message: 'load failed' }),
            })
            .mockRejectedValueOnce(new Error('network down'))
            .mockResolvedValueOnce({
                json: () => Promise.resolve({ success: true, data: { id: 'sub-2' } }),
            })
            .mockResolvedValueOnce({
                json: () => Promise.resolve({ success: false, message: 'create failed' }),
            })
            .mockRejectedValueOnce(new Error('network down'));

        const { loadSubspaces, createSubspace } = useSpaces();

        await expect(loadSubspaces('space-1')).resolves.toEqual([{ id: 'sub-1' }]);
        await expect(loadSubspaces('space-1')).resolves.toEqual([]);
        await expect(loadSubspaces('space-1')).resolves.toEqual([]);
        await expect(createSubspace('space-1', { name: 'Child' })).resolves.toEqual({ id: 'sub-2' });
        await expect(createSubspace('space-1', { name: 'Child' })).resolves.toBeNull();
        await expect(createSubspace('space-1', { name: 'Child' })).resolves.toBeNull();

        expect(mockAddToast).toHaveBeenCalledWith({ message: 'spaces.createSuccess', type: 'success' });
        expect(mockAddToast).toHaveBeenCalledWith({ message: 'create failed', type: 'error' });
        expect(mockAddToast).toHaveBeenCalledWith({ message: 'network down', type: 'error' });
    });
});

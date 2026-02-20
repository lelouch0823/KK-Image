import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSpaces } from '../useSpaces';
import { API } from '@/utils/constants';

// Mock dependencies
const mockAuthFetch = vi.fn();
const mockAddToast = vi.fn();
const mockT = vi.fn((key) => key);

vi.mock('../useAuth', () => ({
    useAuth: () => ({ authFetch: mockAuthFetch }),
}));

vi.mock('../useToast', () => ({
    useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../useI18n', () => ({
    useI18n: () => ({ t: mockT }),
}));

vi.mock('@/utils/constants', () => ({
    API: {
        SPACES: '/api/spaces',
        SPACE_BY_PRODUCT: (id) => `/api/spaces/product/${id}`,
    },
}));

describe('useSpaces Composable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

        it('should return an empty array if the API response is unsuccessful', async () => {
            mockAuthFetch.mockResolvedValue({
                json: () => Promise.resolve({ success: false, error: 'Database error' }),
            });

            const { loadProductSpaces } = useSpaces();
            const result = await loadProductSpaces('prod123');

            expect(mockAuthFetch).toHaveBeenCalledWith('/api/spaces/product/prod123');
            expect(result).toEqual([]);
        });

        it('should return an empty array and degrade gracefully on network error', async () => {
            mockAuthFetch.mockRejectedValue(new Error('Network failure'));

            const { loadProductSpaces } = useSpaces();
            const result = await loadProductSpaces('prod123');

            expect(mockAuthFetch).toHaveBeenCalledWith('/api/spaces/product/prod123');
            expect(result).toEqual([]); // Safe degradation without crashing the app
        });
    });
});

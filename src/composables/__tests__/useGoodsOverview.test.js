import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGoodsOverview } from '../useGoodsOverview';
import { API } from '@/utils/constants';

// Mock dependencies
const mockFetch = vi.fn();

// Add global fetch mock
global.fetch = mockFetch;

vi.mock('@/utils/constants', () => ({
    API: {
        MANAGE_GOODS_OVERVIEW: '/api/manage/goods-overview',
        MANAGE_GOODS_OVERVIEW_SUMMARY: '/api/manage/goods-overview/summary',
        MANAGE_GOODS_OVERVIEW_EXPORT: '/api/manage/goods-overview/export',
    },
}));

describe('useGoodsOverview Composable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Initialization & State', () => {
        it('should initialize with default state', () => {
            const { items, summary, loading, error, filters, availableFilters } = useGoodsOverview();

            expect(items.value).toEqual([]);
            expect(summary.value).toBeNull();
            expect(loading.value).toBe(false);
            expect(error.value).toBeNull();
            expect(filters.category).toBe('');
            expect(filters.brand).toBe('');
            expect(filters.shortageOnly).toBe(false);
            expect(filters.sort).toBe('shortage');
            expect(availableFilters.value).toEqual({ categories: [], brands: [] });
        });
    });

    describe('loadData()', () => {
        it('should fetch and populate items and filters on success', async () => {
            const mockResponse = {
                success: true,
                data: {
                    items: [{ id: 'p1', name: 'Product 1' }],
                    filters: { categories: ['Cat1'], brands: ['Brand1'] }
                }
            };
            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve(mockResponse)
            });

            const { loadData, items, availableFilters, loading, error } = useGoodsOverview();

            expect(loading.value).toBe(false);

            const promise = loadData();
            expect(loading.value).toBe(true);

            await promise;

            expect(loading.value).toBe(false);
            expect(error.value).toBeNull();
            expect(items.value).toEqual(mockResponse.data.items);
            expect(availableFilters.value).toEqual(mockResponse.data.filters);
            expect(mockFetch).toHaveBeenCalledWith(API.MANAGE_GOODS_OVERVIEW + '?sort=shortage');
        });

        it('should correctly build query string with filters', async () => {
            const mockResponse = { success: true, data: { items: [], filters: {} } };
            mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve(mockResponse) });

            const { loadData, filters } = useGoodsOverview();

            filters.category = 'Electronics';
            filters.brand = 'Apple';
            filters.shortageOnly = true;
            filters.sort = 'demand';

            await loadData();

            expect(mockFetch).toHaveBeenCalledWith(API.MANAGE_GOODS_OVERVIEW + '?category=Electronics&brand=Apple&shortageOnly=1&sort=demand');
        });

        it('should populate error when API returns success: false', async () => {
            const mockResponse = { success: false, error: 'API Error message' };
            mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve(mockResponse) });

            const { loadData, error, items } = useGoodsOverview();

            await loadData();

            expect(error.value).toBe('API Error message');
            expect(items.value).toEqual([]);
        });

        it('should populate error when fetch throws an exception', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network disconnected'));

            const { loadData, error, loading } = useGoodsOverview();

            await loadData();

            expect(error.value).toBe('Network disconnected');
            expect(loading.value).toBe(false);
        });
    });

    describe('loadSummary()', () => {
        it('should fetch and populate summary on success', async () => {
            const mockSummaryData = { totalProducts: 10, totalDemand: 50, shortageCount: 2 };
            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({ success: true, data: mockSummaryData })
            });

            const { loadSummary, summary } = useGoodsOverview();

            await loadSummary();

            expect(summary.value).toEqual(mockSummaryData);
            expect(mockFetch).toHaveBeenCalledWith(API.MANAGE_GOODS_OVERVIEW_SUMMARY);
        });

        it('should handle errors silently', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Failed to fetch summary'));

            const { loadSummary, summary } = useGoodsOverview();

            await loadSummary();

            expect(summary.value).toBeNull(); // Should not crash, keeps previous state
        });
    });

    describe('init()', () => {
        it('should call both loadData and loadSummary in parallel', async () => {
            mockFetch.mockResolvedValue({
                json: () => Promise.resolve({ success: true, data: {} })
            });

            const { init } = useGoodsOverview();

            await init();

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(mockFetch).toHaveBeenCalledWith(API.MANAGE_GOODS_OVERVIEW + '?sort=shortage');
            expect(mockFetch).toHaveBeenCalledWith(API.MANAGE_GOODS_OVERVIEW_SUMMARY);
        });
    });

    describe('exportCSV()', () => {
        it('should create and click a download link', () => {
            const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => { });
            const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => { });
            const mockClick = vi.fn();

            vi.spyOn(document, 'createElement').mockReturnValue({
                click: mockClick,
                href: '',
                download: ''
            });

            const { exportCSV } = useGoodsOverview();
            exportCSV();

            expect(document.createElement).toHaveBeenCalledWith('a');
            expect(mockAppendChild).toHaveBeenCalled();
            expect(mockClick).toHaveBeenCalled();
            expect(mockRemoveChild).toHaveBeenCalled();

            vi.restoreAllMocks();
        });
    });

    describe('createPOFromSelected()', () => {
        it('should submit variant-level purchase items', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    json: () => Promise.resolve({
                        success: true,
                        data: {
                            items: [
                                { id: 'var-1', productId: 'prod-1', name: 'Tee', sku: 'TEE-YELLOW-S', shortage: 5, avgUnitCost: 8.8 }
                            ],
                            filters: { categories: [], brands: [] }
                        }
                    })
                })
                .mockResolvedValueOnce({
                    json: () => Promise.resolve({ success: true, data: { id: 'po-1' } })
                });

            const { loadData, toggleSelect, items, createPOFromSelected } = useGoodsOverview();
            await loadData();
            toggleSelect(items.value[0]);

            const result = await createPOFromSelected();
            expect(result.success).toBe(true);

            const [, postRequest] = mockFetch.mock.calls;
            expect(postRequest[0]).toBe(API.MANAGE_PURCHASE_ORDERS);
            const payload = JSON.parse(postRequest[1].body);

            expect(payload.items).toEqual([
                expect.objectContaining({
                    product_id: 'prod-1',
                    variant_id: 'var-1',
                    product_sku: 'TEE-YELLOW-S',
                    quantity: 5,
                }),
            ]);
        });
    });
});

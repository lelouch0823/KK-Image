import { describe, it, expect, vi } from 'vitest';
import { SpaceRepository } from '../SpaceRepository.js';

describe('SpaceRepository', () => {
    describe('findByProductId', () => {
        it('should return spaces linked to a specific product ID', async () => {
            // Setup mock DB
            const mockResults = [
                { id: 'space1', name: 'Space 1', product_id: 'prod123', file_count: 5, cover_storage_key: 'key1' },
            ];

            const mockAll = vi.fn().mockResolvedValue({ results: mockResults });
            const mockBind = vi.fn().mockReturnValue({ all: mockAll });
            const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

            const mockDb = { prepare: mockPrepare };

            const repo = new SpaceRepository(mockDb);
            const productId = 'prod123';

            // Execute
            const result = await repo.findByProductId(productId);

            // Assert
            expect(mockPrepare).toHaveBeenCalledWith(
                expect.stringContaining('SELECT s.*')
            );
            expect(mockPrepare).toHaveBeenCalledWith(
                expect.stringContaining('WHERE s.product_id = ?')
            );
            expect(mockBind).toHaveBeenCalledWith(productId);
            expect(mockAll).toHaveBeenCalled();

            expect(result).toEqual(mockResults);
        });

        it('should return empty array if no spaces are linked to the product ID', async () => {
            // Setup mock DB
            const mockAll = vi.fn().mockResolvedValue({ results: [] });
            const mockBind = vi.fn().mockReturnValue({ all: mockAll });
            const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

            const mockDb = { prepare: mockPrepare };

            const repo = new SpaceRepository(mockDb);
            const productId = 'prod_none';

            // Execute
            const result = await repo.findByProductId(productId);

            // Assert
            expect(mockBind).toHaveBeenCalledWith(productId);
            expect(result).toEqual([]);
        });

        it('should throw an error if the database query fails', async () => {
            // Setup mock DB to throw
            const dbError = new Error('Database connection failed');
            const mockAll = vi.fn().mockRejectedValue(dbError);
            const mockBind = vi.fn().mockReturnValue({ all: mockAll });
            const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

            const mockDb = { prepare: mockPrepare };

            const repo = new SpaceRepository(mockDb);
            const productId = 'prod_error';

            // Execute & Assert
            await expect(repo.findByProductId(productId)).rejects.toThrow('Database connection failed');
        });

        it('prefers variant primary image over product image in query selection', async () => {
            const mockAll = vi.fn().mockResolvedValue({ results: [] });
            const mockBind = vi.fn().mockReturnValue({ all: mockAll });
            const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
            const mockDb = { prepare: mockPrepare };

            const repo = new SpaceRepository(mockDb);
            await repo.findByProductId('prod_1');

            const sql = mockPrepare.mock.calls[0][0];
            expect(sql).toContain('variant_images');
            expect(sql).toContain('COALESCE');
            expect(sql).toContain('display_image_id');
        });
    });

    describe('findById', () => {
        it('keeps fallback chain when variant images are empty', async () => {
            const mockFirst = vi.fn().mockResolvedValue({
                id: 'space_1',
                display_image_id: 'product_img_1',
            });
            const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
            const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
            const mockDb = { prepare: mockPrepare };

            const repo = new SpaceRepository(mockDb);
            const result = await repo.findById('space_1');

            const sql = mockPrepare.mock.calls[0][0];
            expect(sql).toContain('variant_images');
            expect(sql).toContain('json_extract');
            expect(result.display_image_id).toBe('product_img_1');
        });
    });

    describe('batch safety', () => {
        function createStatement(sql) {
            const statement = {
                sql,
                params: [],
                bind: vi.fn((...params) => {
                    statement.params = params;
                    return statement;
                }),
                run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
            };
            return statement;
        }

        it('chunks addFiles when linking many files to one space', async () => {
            const db = {
                prepare: vi.fn((sql) => createStatement(sql)),
                batch: vi.fn(async (statements = []) => statements.map(() => ({ meta: { changes: 1 } }))),
            };
            const repo = new SpaceRepository(db);

            await repo.addFiles('space-1', Array.from({ length: 205 }, (_, index) => `file-${index}`));

            expect(db.batch).toHaveBeenCalledTimes(3);
            expect(db.batch.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 5]);
        });

        it('chunks reorderFiles when sorting many files in one space', async () => {
            const db = {
                prepare: vi.fn((sql) => createStatement(sql)),
                batch: vi.fn(async (statements = []) => statements.map(() => ({ meta: { changes: 1 } }))),
            };
            const repo = new SpaceRepository(db);

            await repo.reorderFiles('space-1', Array.from({ length: 205 }, (_, index) => `file-${index}`));

            expect(db.batch).toHaveBeenCalledTimes(3);
            expect(db.batch.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 6]);
        });
    });

    describe('createSubspace', () => {
        it('persists both product_id and variant_id for bound child spaces', async () => {
            const mockRun = vi.fn().mockResolvedValue({ success: true });
            const mockBind = vi.fn().mockReturnValue({ run: mockRun });
            const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
            const mockDb = { prepare: mockPrepare };

            const repo = new SpaceRepository(mockDb);

            await repo.createSubspace({
                id: 'space-child-1',
                parentId: 'space-parent-1',
                name: 'Child Product Space',
                description: '',
                isPublic: false,
                password: null,
                shareToken: 'share-space',
                expiresAt: null,
                template: 'product',
                templateData: '{}',
                productId: 'product-2',
                variantId: 'variant-2',
                createdAt: 100,
                updatedAt: 100,
            });

            expect(mockPrepare).toHaveBeenCalledWith(
                expect.stringContaining('product_id')
            );
            expect(mockBind).toHaveBeenCalledWith(
                'space-child-1',
                'space-parent-1',
                'Child Product Space',
                '',
                0,
                null,
                'share-space',
                null,
                'product',
                '{}',
                'product-2',
                'variant-2',
                100,
                100
            );
            expect(mockRun).toHaveBeenCalled();
        });
    });
});

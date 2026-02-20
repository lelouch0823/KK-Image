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
    });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VariantImageRepository } from '../VariantImageRepository.js';

function createPreparedStatement(sql) {
    const statement = {
        sql,
        params: [],
        bind: vi.fn((...params) => {
            statement.params = params;
            return statement;
        }),
        first: vi.fn(),
        all: vi.fn(),
        run: vi.fn(),
    };
    return statement;
}

function createMockDb() {
    const statements = [];
    const db = {
        prepare: vi.fn((sql) => {
            const stmt = createPreparedStatement(sql);
            statements.push(stmt);
            return stmt;
        }),
        batch: vi.fn(async (batchStatements) => batchStatements),
    };
    return { db, statements };
}

describe('VariantImageRepository', () => {
    let db;
    let statements;
    let repo;

    beforeEach(() => {
        ({ db, statements } = createMockDb());
        repo = new VariantImageRepository(db);
    });

    it('adds image links for a variant', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('FROM product_variants')) {
                stmt.first.mockResolvedValue({ id: 'variant_1' });
            } else if (sql.includes('WHERE variant_id = ? AND image_id = ?')) {
                stmt.first.mockResolvedValue(null);
            } else if (sql.includes('MAX(sort_order)')) {
                stmt.first.mockResolvedValue({ max_sort_order: 4 });
            } else if (sql.includes('INSERT INTO variant_images')) {
                stmt.run.mockResolvedValue({ meta: { changes: 1 } });
            } else if (sql.includes('SELECT * FROM variant_images')) {
                stmt.first.mockResolvedValue({
                    id: 'vi_1',
                    variant_id: 'variant_1',
                    image_id: 'file_1',
                    sort_order: 5,
                    is_primary: 0,
                });
            }
            statements.push(stmt);
            return stmt;
        });

        const created = await repo.addImage({
            productId: 'product_1',
            variantId: 'variant_1',
            imageId: 'file_1',
            isPrimary: false,
        });

        expect(created.image_id).toBe('file_1');
        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO variant_images'));
    });

    it('rejects duplicate image links for the same variant', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('FROM product_variants')) {
                stmt.first.mockResolvedValue({ id: 'variant_1' });
            } else if (sql.includes('WHERE variant_id = ? AND image_id = ?')) {
                stmt.first.mockResolvedValue({
                    id: 'vi_existing',
                    variant_id: 'variant_1',
                    image_id: 'file_1',
                    is_primary: 0,
                });
            }
            statements.push(stmt);
            return stmt;
        });

        await expect(
            repo.addImage({
                productId: 'product_1',
                variantId: 'variant_1',
                imageId: 'file_1',
            })
        ).rejects.toThrow('Image already linked to variant');

        expect(db.prepare).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO variant_images'));
    });

    it('clears previous primaries before inserting a new primary image', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('FROM product_variants')) {
                stmt.first.mockResolvedValue({ id: 'variant_1' });
            } else if (sql.includes('WHERE variant_id = ? AND image_id = ?')) {
                stmt.first.mockResolvedValue(null);
            } else if (sql.includes('MAX(sort_order)')) {
                stmt.first.mockResolvedValue({ max_sort_order: 2 });
            } else if (sql.includes('INSERT INTO variant_images')) {
                stmt.run.mockResolvedValue({ meta: { changes: 1 } });
            } else if (sql.includes('SELECT * FROM variant_images WHERE id = ?')) {
                stmt.first.mockResolvedValue({
                    id: 'vi_3',
                    variant_id: 'variant_1',
                    image_id: 'file_3',
                    sort_order: 3,
                    is_primary: 1,
                });
            }
            return stmt;
        });

        const created = await repo.addImage({
            productId: 'product_1',
            variantId: 'variant_1',
            imageId: 'file_3',
            isPrimary: true,
        });

        expect(created.is_primary).toBe(1);
        expect(db.batch).toHaveBeenCalledTimes(1);
        const batched = db.batch.mock.calls[0][0];
        expect(batched).toHaveLength(2);
        expect(batched[0].sql).toContain('UPDATE variant_images SET is_primary = 0');
        expect(batched[0].params.slice(1)).toEqual(['variant_1']);
        expect(batched[1].sql).toContain('INSERT INTO variant_images');
        expect(batched[1].params[4]).toBe(1);
    });

    it('normalizes database uniqueness conflicts into duplicate-link errors', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('FROM product_variants')) {
                stmt.first.mockResolvedValue({ id: 'variant_1' });
            } else if (sql.includes('WHERE variant_id = ? AND image_id = ?')) {
                stmt.first.mockResolvedValue(null);
            } else if (sql.includes('MAX(sort_order)')) {
                stmt.first.mockResolvedValue({ max_sort_order: 4 });
            } else if (sql.includes('INSERT INTO variant_images')) {
                stmt.run.mockRejectedValue(
                    new Error('D1_ERROR: UNIQUE constraint failed: variant_images.variant_id, variant_images.image_id')
                );
            }
            return stmt;
        });

        await expect(
            repo.addImage({
                productId: 'product_1',
                variantId: 'variant_1',
                imageId: 'file_1',
            })
        ).rejects.toThrow('Image already linked to variant');
    });

    it('sets primary image atomically', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('FROM product_variants')) {
                stmt.first.mockResolvedValue({ id: 'variant_1' });
            } else if (sql.includes('SELECT 1 FROM variant_images')) {
                stmt.first.mockResolvedValue({ exists: 1 });
            } else if (sql.includes('UPDATE variant_images')) {
                stmt.run.mockResolvedValue({ meta: { changes: 1 } });
            }
            return stmt;
        });

        await repo.setPrimary({
            productId: 'product_1',
            variantId: 'variant_1',
            imageId: 'file_2',
        });

        expect(db.batch).toHaveBeenCalledTimes(1);
        const sqlBatch = db.batch.mock.calls[0][0].map((stmt) => stmt.sql).join('\n');
        expect(sqlBatch).toContain('UPDATE variant_images');
        expect(sqlBatch).toContain('is_primary = 0');
        expect(sqlBatch).toContain('is_primary = 1');
    });

    it('rejects setPrimary when the target image does not exist', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('FROM product_variants')) {
                stmt.first.mockResolvedValue({ id: 'variant_1' });
            } else if (sql.includes('SELECT 1 FROM variant_images')) {
                stmt.first.mockResolvedValue(null);
            }
            return stmt;
        });

        await expect(
            repo.setPrimary({
                productId: 'product_1',
                variantId: 'variant_1',
                imageId: 'file_missing',
            })
        ).rejects.toThrow('Variant image does not exist');

        expect(db.batch).not.toHaveBeenCalled();
    });

    it('sorts variant images with provided order', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('FROM product_variants')) {
                stmt.first.mockResolvedValue({ id: 'variant_1' });
            } else if (sql.includes('SELECT image_id FROM variant_images')) {
                stmt.all.mockResolvedValue({
                    results: [
                        { image_id: 'file_1' },
                        { image_id: 'file_2' },
                        { image_id: 'file_3' },
                    ],
                });
            } else if (sql.includes('MAX(sort_order)')) {
                stmt.first.mockResolvedValue({ max_sort_order: 2 });
            } else if (sql.includes('UPDATE variant_images')) {
                stmt.run.mockResolvedValue({ meta: { changes: 1 } });
            }
            statements.push(stmt);
            return stmt;
        });

        await repo.sortImages({
            productId: 'product_1',
            variantId: 'variant_1',
            imageIds: ['file_2', 'file_1', 'file_3'],
        });

        expect(db.batch).toHaveBeenCalledTimes(1);
        const updates = db.batch.mock.calls[0][0];
        expect(updates).toHaveLength(6);
        expect(updates[0].params.slice(0, 2)).toEqual([6, expect.any(Number)]);
        expect(updates[1].params.slice(0, 2)).toEqual([7, expect.any(Number)]);
        expect(updates[2].params.slice(0, 2)).toEqual([8, expect.any(Number)]);
        expect(updates[3].params.slice(0, 2)).toEqual([0, expect.any(Number)]);
        expect(updates[4].params.slice(0, 2)).toEqual([1, expect.any(Number)]);
        expect(updates[5].params.slice(0, 2)).toEqual([2, expect.any(Number)]);
    });

    it('rejects sortImages when the requested ids are not a full unique match for the variant', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('FROM product_variants')) {
                stmt.first.mockResolvedValue({ id: 'variant_1' });
            } else if (sql.includes('SELECT image_id FROM variant_images')) {
                stmt.all.mockResolvedValue({
                    results: [
                        { image_id: 'file_1' },
                        { image_id: 'file_2' },
                        { image_id: 'file_3' },
                    ],
                });
            }
            return stmt;
        });

        await expect(
            repo.sortImages({
                productId: 'product_1',
                variantId: 'variant_1',
                imageIds: ['file_2', 'file_2', 'file_3'],
            })
        ).rejects.toThrow('imageIds must include each variant image exactly once');

        expect(db.batch).not.toHaveBeenCalled();
    });

    it('deletes an image link and preserves valid operation scope', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('FROM product_variants')) {
                stmt.first.mockResolvedValue({ id: 'variant_1' });
            } else if (sql.includes('DELETE FROM variant_images')) {
                stmt.run.mockResolvedValue({ meta: { changes: 1 } });
            }
            return stmt;
        });

        const removed = await repo.deleteImage({
            productId: 'product_1',
            variantId: 'variant_1',
            imageId: 'file_2',
        });

        expect(removed).toBe(true);
        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM variant_images'));
    });

    it('returns false when deleteImage affects zero rows', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('FROM product_variants')) {
                stmt.first.mockResolvedValue({ id: 'variant_1' });
            } else if (sql.includes('DELETE FROM variant_images')) {
                stmt.run.mockResolvedValue({ meta: { changes: 0 } });
            }
            return stmt;
        });

        const removed = await repo.deleteImage({
            productId: 'product_1',
            variantId: 'variant_1',
            imageId: 'file_missing',
        });

        expect(removed).toBe(false);
    });

    it('rejects cross-product variant operations', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('FROM product_variants')) {
                stmt.first.mockResolvedValue(null);
            }
            return stmt;
        });

        await expect(
            repo.addImage({
                productId: 'product_A',
                variantId: 'variant_from_other_product',
                imageId: 'file_2',
            })
        ).rejects.toThrow('Variant does not belong to product');
    });

    it('normalizes sync image payload: dedupe and enforce single primary', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('FROM product_variants')) {
                stmt.first.mockResolvedValue({ id: 'variant_1' });
            } else if (sql.includes('DELETE FROM variant_images') || sql.includes('INSERT INTO variant_images')) {
                stmt.run.mockResolvedValue({ meta: { changes: 1 } });
            }
            return stmt;
        });

        await repo.syncImages('product_1', 'variant_1', [
            { image_id: 'img-1', is_primary: 0 },
            { image_id: 'img-2', is_primary: 1 },
            { image_id: 'img-2', is_primary: 1 },
            { id: 'img-3', is_primary: 1 },
            '',
        ]);

        expect(db.batch).toHaveBeenCalledTimes(1);
        const batched = db.batch.mock.calls[0][0];
        expect(batched.length).toBe(4);
        expect(batched[1].params.slice(1, 5)).toEqual(['variant_1', 'img-1', 0, 0]);
        expect(batched[2].params.slice(1, 5)).toEqual(['variant_1', 'img-2', 1, 1]);
        expect(batched[3].params.slice(1, 5)).toEqual(['variant_1', 'img-3', 2, 0]);
    });

    it('chunks large syncImages writes into D1-safe batches', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('FROM product_variants')) {
                stmt.first.mockResolvedValue({ id: 'variant_1' });
            } else if (sql.includes('DELETE FROM variant_images') || sql.includes('INSERT INTO variant_images')) {
                stmt.run.mockResolvedValue({ meta: { changes: 1 } });
            }
            return stmt;
        });

        await repo.syncImages(
            'product_1',
            'variant_1',
            Array.from({ length: 205 }, (_, index) => ({ image_id: `img-${index}` }))
        );

        expect(db.batch).toHaveBeenCalledTimes(3);
        expect(db.batch.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 6]);
    });

    it('chunks large sortImages reorder writes into D1-safe batches', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('FROM product_variants')) {
                stmt.first.mockResolvedValue({ id: 'variant_1' });
            } else if (sql.includes('SELECT image_id FROM variant_images')) {
                stmt.all.mockResolvedValue({
                    results: Array.from({ length: 60 }, (_, index) => ({ image_id: `file_${index}` })),
                });
            } else if (sql.includes('MAX(sort_order)')) {
                stmt.first.mockResolvedValue({ max_sort_order: 2 });
            } else if (sql.includes('UPDATE variant_images')) {
                stmt.run.mockResolvedValue({ meta: { changes: 1 } });
            }
            statements.push(stmt);
            return stmt;
        });

        await repo.sortImages({
            productId: 'product_1',
            variantId: 'variant_1',
            imageIds: Array.from({ length: 60 }, (_, index) => `file_${index}`),
        });

        expect(db.batch).toHaveBeenCalledTimes(2);
        expect(db.batch.mock.calls.map(([batch]) => batch.length)).toEqual([100, 20]);
    });
});

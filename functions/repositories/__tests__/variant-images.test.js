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

    it('sets primary image atomically', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('FROM product_variants')) {
                stmt.first.mockResolvedValue({ id: 'variant_1' });
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

    it('sorts variant images with provided order', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('FROM product_variants')) {
                stmt.first.mockResolvedValue({ id: 'variant_1' });
            } else if (sql.includes('UPDATE variant_images')) {
                stmt.run.mockResolvedValue({ meta: { changes: 1 } });
            }
            return stmt;
        });

        await repo.sortImages({
            productId: 'product_1',
            variantId: 'variant_1',
            imageIds: ['file_2', 'file_1', 'file_3'],
        });

        expect(db.batch).toHaveBeenCalledTimes(1);
        const updates = db.batch.mock.calls[0][0];
        expect(updates).toHaveLength(3);
        expect(updates[0].params.slice(0, 2)).toEqual([0, expect.any(Number)]);
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
});

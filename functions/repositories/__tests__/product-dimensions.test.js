import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductDimensionRepository } from '../ProductDimensionRepository.js';

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
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
    };
    return statement;
}

function createMockDb() {
    const db = {
        prepare: vi.fn((sql) => createPreparedStatement(sql)),
        batch: vi.fn(async () => []),
    };
    return { db };
}

describe('ProductDimensionRepository', () => {
    let db;
    let repo;

    beforeEach(() => {
        ({ db } = createMockDb());
        repo = new ProductDimensionRepository(db);
    });

    it('updateDimension should record alias when name changed', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.trim() === 'SELECT * FROM product_dimensions WHERE id = ? AND product_id = ?') {
                stmt.first.mockResolvedValue({
                    id: 'dim-color',
                    product_id: 'prod-1',
                    name: 'Color',
                    sort_order: 0,
                });
            }
            if (sql.trim() === 'SELECT * FROM product_dimensions WHERE id = ?') {
                stmt.first.mockResolvedValue({
                    id: 'dim-color',
                    product_id: 'prod-1',
                    name: 'Colour',
                    sort_order: 0,
                });
            }
            return stmt;
        });

        await repo.updateDimension('prod-1', 'dim-color', { name: 'Colour' });

        expect(db.prepare).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO product_dimension_aliases')
        );
    });

    it('mergeKeepByDimensionRemoval should archive deduped active variants', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes("SELECT * FROM product_variants WHERE product_id = ? AND status = 'active'")) {
                stmt.all.mockResolvedValue({
                    results: [
                        {
                            id: 'v1',
                            options_values: JSON.stringify({ 'dim-color': 'Red', 'dim-size': 'S' }),
                        },
                        {
                            id: 'v2',
                            options_values: JSON.stringify({ 'dim-color': 'Blue', 'dim-size': 'S' }),
                        },
                    ],
                });
            }
            return stmt;
        });

        const result = await repo.mergeKeepByDimensionRemoval('prod-1', 'dim-color');

        expect(result.deduped).toBe(1);
        expect(db.batch).toHaveBeenCalledTimes(1);
        const statements = db.batch.mock.calls[0][0];
        expect(statements).toHaveLength(2);
        const archiveStmt = statements.find((item) => item.sql.includes("SET status = 'archived'"));
        expect(archiveStmt).toBeTruthy();
    });
});

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
        batchCalls: [],
        prepare: vi.fn((sql) => createPreparedStatement(sql)),
        batch: vi.fn(async function batch(statements = []) {
            this.batchCalls.push(statements);
            return [];
        }),
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

    it('createDimension should reject duplicate active dimension names on the same product', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes("SELECT COUNT(*) AS total FROM product_dimensions WHERE product_id = ? AND status = 'active'")) {
                stmt.first.mockResolvedValue({ total: 1 });
            }
            if (sql.includes("SELECT id FROM product_dimensions WHERE product_id = ? AND status = 'active' AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1")) {
                stmt.first.mockResolvedValue({ id: 'dim-color' });
            }
            return stmt;
        });

        await expect(
            repo.createDimension('prod-1', { name: '  Color  ' })
        ).rejects.toThrow('duplicate dimension names are not supported');
    });

    it('updateDimension should reject renaming to another active dimension name on the same product', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.trim() === 'SELECT * FROM product_dimensions WHERE id = ? AND product_id = ?') {
                stmt.first.mockResolvedValue({
                    id: 'dim-size',
                    product_id: 'prod-1',
                    name: 'Size',
                    sort_order: 1,
                });
            }
            if (sql.includes("SELECT id FROM product_dimensions WHERE product_id = ? AND status = 'active' AND LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id <> ? LIMIT 1")) {
                stmt.first.mockResolvedValue({ id: 'dim-color' });
            }
            return stmt;
        });

        await expect(
            repo.updateDimension('prod-1', 'dim-size', { name: ' color ' })
        ).rejects.toThrow('duplicate dimension names are not supported');
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

    it('restoreSnapshot should restore dimensions/values and archive extras', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('SELECT * FROM product_dimensions WHERE product_id = ?')) {
                stmt.all.mockResolvedValue({
                    results: [
                        {
                            id: 'dim-color',
                            product_id: 'prod-1',
                            name: 'Colour',
                            status: 'active',
                            sort_order: 0,
                            created_at: 1,
                        },
                        {
                            id: 'dim-size',
                            product_id: 'prod-1',
                            name: 'Size',
                            status: 'active',
                            sort_order: 1,
                            created_at: 1,
                        },
                    ],
                });
            }
            if (sql.includes('SELECT * FROM product_dimension_values WHERE dimension_id IN')) {
                stmt.all.mockResolvedValue({
                    results: [
                        { id: 'val-red', dimension_id: 'dim-color', value: 'Red', status: 'active', sort_order: 0, created_at: 1, meta: null },
                        { id: 'val-xl', dimension_id: 'dim-size', value: 'XL', status: 'active', sort_order: 0, created_at: 1, meta: null },
                    ],
                });
            }
            if (sql.includes('SELECT * FROM product_dimension_aliases WHERE dimension_id IN')) {
                stmt.all.mockResolvedValue({ results: [] });
            }
            return stmt;
        });

        await repo.restoreSnapshot('prod-1', [
            {
                id: 'dim-color',
                product_id: 'prod-1',
                name: 'Color',
                status: 'active',
                sort_order: 0,
                created_at: 1,
                values: [
                    { id: 'val-red', dimension_id: 'dim-color', value: 'Red', status: 'active', sort_order: 0, created_at: 1, meta: null },
                ],
            },
        ]);

        expect(db.batch).toHaveBeenCalledTimes(1);
        const statements = db.batch.mock.calls[0][0];
        expect(statements.some((stmt) => stmt.sql.includes('INSERT INTO product_dimensions'))).toBe(true);
        expect(statements.some((stmt) => stmt.sql.includes('INSERT INTO product_dimension_values'))).toBe(true);
        expect(statements.some((stmt) => stmt.sql.includes("UPDATE product_dimensions SET status = 'archived'"))).toBe(true);
    });

    it('archiveVariantsByValue should reject ambiguous duplicate labels', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('SELECT v.id, v.value, v.dimension_id')) {
                stmt.all.mockResolvedValue({
                    results: [
                        { id: 'val-red-1', value: 'Red', dimension_id: 'dim-color' },
                        { id: 'val-red-2', value: 'Red', dimension_id: 'dim-color' },
                    ],
                });
            }
            return stmt;
        });

        await expect(repo.archiveVariantsByValue('prod-1', 'val-red-1')).rejects.toThrow(
            'duplicate dimension values with same label are not supported'
        );
    });

    it('archiveDimension should cascade active values under the archived dimension', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.trim() === 'SELECT * FROM product_dimensions WHERE id = ? AND product_id = ?') {
                stmt.first.mockResolvedValue({
                    id: 'dim-color',
                    product_id: 'prod-1',
                    name: 'Color',
                    status: 'active',
                });
            }
            if (sql.includes('SELECT id FROM product_dimension_values WHERE dimension_id = ? AND status = \'active\'')) {
                stmt.all.mockResolvedValue({
                    results: [{ id: 'val-red' }, { id: 'val-blue' }],
                });
            }
            return stmt;
        });

        await repo.archiveDimension('prod-1', 'dim-color');

        expect(db.batch).toHaveBeenCalledTimes(1);
        const statements = db.batch.mock.calls[0][0];
        expect(statements.some((stmt) => stmt.sql.includes("UPDATE product_dimensions SET status = 'archived'"))).toBe(true);
        expect(statements.filter((stmt) => stmt.sql.includes("UPDATE product_dimension_values SET status = 'archived'"))).toHaveLength(2);
    });

    it('restoreValue should reject values whose parent dimension is archived', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('SELECT v.*, d.product_id, d.status AS dimension_status')) {
                stmt.first.mockResolvedValue({
                    id: 'val-red',
                    value: 'Red',
                    dimension_id: 'dim-color',
                    product_id: 'prod-1',
                    dimension_status: 'archived',
                    status: 'archived',
                });
            }
            return stmt;
        });

        await expect(repo.restoreValue('prod-1', 'val-red')).rejects.toThrow(
            'cannot restore value for archived dimension'
        );
    });

    it('restoreSnapshot chunks large snapshot writes into D1-safe sizes', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes('SELECT * FROM product_dimensions WHERE product_id = ?')) {
                stmt.all.mockResolvedValue({ results: [] });
            }
            if (sql.includes('SELECT * FROM product_dimension_values WHERE dimension_id IN')) {
                stmt.all.mockResolvedValue({ results: [] });
            }
            if (sql.includes('SELECT * FROM product_dimension_aliases WHERE dimension_id IN')) {
                stmt.all.mockResolvedValue({ results: [] });
            }
            return stmt;
        });

        await repo.restoreSnapshot('prod-1', Array.from({ length: 60 }, (_, index) => ({
            id: `dim-${index + 1}`,
            product_id: 'prod-1',
            name: `Dimension ${index + 1}`,
            status: 'active',
            sort_order: index,
            created_at: 1,
            values: [
                {
                    id: `val-${index + 1}`,
                    dimension_id: `dim-${index + 1}`,
                    value: `Value ${index + 1}`,
                    status: 'active',
                    sort_order: 0,
                    created_at: 1,
                    meta: null,
                },
            ],
        })));

        expect(db.batch.mock.calls.length).toBeGreaterThan(1);
        expect(Math.max(...db.batchCalls.map((statements) => statements.length))).toBeLessThanOrEqual(100);
    });

    it('mergeKeepByDimensionRemoval chunks large variant rewrites into D1-safe sizes', async () => {
        db.prepare.mockImplementation((sql) => {
            const stmt = createPreparedStatement(sql);
            if (sql.includes("SELECT * FROM product_variants WHERE product_id = ? AND status = 'active'")) {
                stmt.all.mockResolvedValue({
                    results: Array.from({ length: 120 }, (_, index) => ({
                        id: `v${index + 1}`,
                        options_values: JSON.stringify({
                            'dim-color': `Color ${index + 1}`,
                            'dim-size': `Size ${index + 1}`,
                        }),
                    })),
                });
            }
            return stmt;
        });

        await repo.mergeKeepByDimensionRemoval('prod-1', 'dim-color');

        expect(db.batch.mock.calls.length).toBeGreaterThan(1);
        expect(Math.max(...db.batchCalls.map((statements) => statements.length))).toBeLessThanOrEqual(100);
    });
});

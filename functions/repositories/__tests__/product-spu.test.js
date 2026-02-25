import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductRepository } from '../ProductRepository.js';

// 模拟 D1 prepared statement
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

// 模拟 D1 database
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

describe('ProductRepository — SPU 重构', () => {
    let db;
    let statements;
    let repo;

    beforeEach(() => {
        ({ db, statements } = createMockDb());
        repo = new ProductRepository(db);
        // 模拟 crypto.randomUUID
        vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'test-uuid') });
    });

    // ---------------------------------------------------------------
    // 创建商品 (spu 可选)
    // ---------------------------------------------------------------
    describe('create — spu 可选', () => {
        it('创建商品时 spu 缺省应成功', async () => {
            db.prepare.mockImplementation((sql) => {
                const stmt = createPreparedStatement(sql);
                if (sql.includes('INSERT INTO products')) {
                    stmt.run.mockResolvedValue({ meta: { changes: 1 } });
                }
                return stmt;
            });

            const product = await repo.create({ name: 'Test Product' });

            // 产品应成功创建
            expect(product).toBeTruthy();
            expect(product.name).toBe('Test Product');
            // spu 字段应存在且为 null 或空
            expect(product).toHaveProperty('spu');
        });

        it('创建商品时可指定 spu', async () => {
            db.prepare.mockImplementation((sql) => {
                const stmt = createPreparedStatement(sql);
                if (sql.includes('INSERT INTO products')) {
                    stmt.run.mockResolvedValue({ meta: { changes: 1 } });
                }
                if (sql.includes('FROM products p') && sql.includes('WHERE p.id = ?')) {
                    stmt.first.mockResolvedValue({
                        id: 'test-uuid',
                        name: 'Test',
                        spu: 'SPU-001',
                        product_code: 'PTESTUUID0000',
                        images: '[]',
                        specifications: '{}',
                        options: '[]',
                    });
                }
                return stmt;
            });

            const product = await repo.create({ name: 'Test', spu: 'SPU-001' });
            expect(product.spu).toBe('SPU-001');
        });

        it('创建商品后应返回数据库生成的 product_code', async () => {
            db.prepare.mockImplementation((sql) => {
                const stmt = createPreparedStatement(sql);
                if (sql.includes('INSERT INTO products')) {
                    stmt.run.mockResolvedValue({ meta: { changes: 1 } });
                }
                if (sql.includes('FROM products p') && sql.includes('WHERE p.id = ?')) {
                    stmt.first.mockResolvedValue({
                        id: 'test-uuid',
                        name: 'Code Product',
                        spu: null,
                        product_code: 'PTESTUUID0000',
                        images: '[]',
                        specifications: '{}',
                        options: '[]',
                    });
                }
                return stmt;
            });

            const product = await repo.create({ name: 'Code Product' });
            expect(product.product_code).toBe('PTESTUUID0000');
        });
    });

    // ---------------------------------------------------------------
    // findBySpu 方法
    // ---------------------------------------------------------------
    describe('findBySpu', () => {
        it('应通过 spu 查找产品', async () => {
            db.prepare.mockImplementation((sql) => {
                const stmt = createPreparedStatement(sql);
                if (sql.includes('FROM products p') && sql.includes('WHERE p.spu = ?')) {
                    stmt.first.mockResolvedValue({
                        id: 'test-id',
                        name: 'Test',
                        spu: 'SPU-001',
                        images: '[]',
                        specifications: '{}',
                        options: '[]',
                    });
                }
                return stmt;
            });

            const product = await repo.findBySpu('SPU-001');
            expect(product).toBeTruthy();
            expect(product.spu).toBe('SPU-001');
        });
    });

    // ---------------------------------------------------------------
    // search — 返回 spu 字段
    // ---------------------------------------------------------------
    describe('search — spu 搜索', () => {
        it('搜索结果应包含 spu 字段', async () => {
            db.prepare.mockImplementation((sql) => {
                const stmt = createPreparedStatement(sql);
                if (sql.includes('FROM products p')) {
                    stmt.all.mockResolvedValue({
                        results: [{
                            id: 'test-id',
                            name: 'Test',
                            spu: 'SPU-001',
                            images: '[]',
                            specifications: '{}',
                            options: '[]',
                        }]
                    });
                }
                if (sql.includes('COUNT(*)')) {
                    stmt.first.mockResolvedValue({ total: 1 });
                }
                return stmt;
            });

            const result = await repo.search({ search: 'SPU-001' });
            expect(result.items[0]).toHaveProperty('spu');
            // 搜索 SQL 应引用 spu 而不是 sku
            const searchSql = db.prepare.mock.calls.find(c => c[0].includes('LIKE'));
            expect(searchSql[0]).toContain('spu LIKE');
            expect(searchSql[0]).not.toContain('sku LIKE');
        });
    });

    // ---------------------------------------------------------------
    // update — allowedFields 包含 spu
    // ---------------------------------------------------------------
    describe('updateWithMeta — spu', () => {
        it('应允许更新 spu 字段', async () => {
            db.prepare.mockImplementation((sql) => {
                const stmt = createPreparedStatement(sql);
                if (sql.includes('UPDATE products')) {
                    stmt.run.mockResolvedValue({ success: true, meta: { changes: 1 } });
                }
                return stmt;
            });

            const result = await repo.updateWithMeta('test-id', { spu: 'SPU-002' });
            expect(result.success).toBe(true);
            // SQL 应包含 spu =
            const updateCall = db.prepare.mock.calls.find(c => c[0].includes('UPDATE'));
            expect(updateCall[0]).toContain('spu =');
        });
    });

    // ---------------------------------------------------------------
    // createBatch — spu 可选
    // ---------------------------------------------------------------
    describe('createBatch — spu 可选', () => {
        it('批量创建时只要 name 必填, spu 可选', async () => {
            db.prepare.mockImplementation((sql) => {
                const stmt = createPreparedStatement(sql);
                stmt.run.mockResolvedValue({ meta: { changes: 1 } });
                return stmt;
            });
            db.batch.mockResolvedValue([
                { success: true, meta: { changes: 1 } }
            ]);

            const result = await repo.createBatch([{ name: 'Product A' }]);
            // 应成功而不是因缺少 sku 而报错
            expect(result.success).toBe(true);
            expect(result.count).toBe(1);
        });
    });
});

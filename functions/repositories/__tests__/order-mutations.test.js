import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateComposite, updateData, updateStatus, create, batchUpdateStatus } from '../order/mutations.js';

function createBatchAwareDb({
    allHandler = async () => ({ results: [] }),
    firstHandler = async () => null,
} = {}) {
    const sqlCalls = [];
    const batchCalls = [];
    const allCalls = [];

    return {
        sqlCalls,
        batchCalls,
        allCalls,
        prepare: vi.fn((sql) => {
            sqlCalls.push(String(sql || ''));
            const statement = {
                sql: String(sql || ''),
                params: [],
                bind: vi.fn((...params) => {
                    statement.params = params;
                    return statement;
                }),
                first: vi.fn(async () => firstHandler(statement)),
                all: vi.fn(async () => {
                    allCalls.push({ sql: statement.sql, params: statement.params });
                    return allHandler(statement);
                }),
                run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
            };
            return statement;
        }),
        batch: vi.fn(async (statements = []) => {
            batchCalls.push(statements);
            return statements.map(() => ({ success: true, meta: { changes: 1 } }));
        }),
    };
}

describe('Order Mutations SQL Binding', () => {
    let db;
    let timelineRepo;

    beforeEach(() => {
        vi.clearAllMocks();
        db = {
            prepare: vi.fn().mockReturnThis(),
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ success: true }),
            batch: vi.fn().mockResolvedValue([]),
        };
        timelineRepo = {
            createInsertStatement: vi.fn().mockReturnValue({}),
        };
    });

    describe('updateData()', () => {
        it('should bind product_id to SQL when productId is provided', async () => {
            const orderId = 'test-order-123';
            const newData = { name: 'test item' };
            const actorType = 'admin';
            const productId = 'prod-abc';

            await updateData(db, orderId, newData, actorType, productId);

            // Verify parepare was called with product_id in SET clause
            expect(db.prepare.mock.calls.length).toBeGreaterThanOrEqual(2);
            const sql = db.prepare.mock.calls[0][0];
            expect(sql).toContain('product_id = ?');

            // Verify bind parameters include the productId
            // Bind params order: [JSON.stringify(newData), timestamp, productId, orderId]
            expect(db.bind.mock.calls.length).toBeGreaterThanOrEqual(2);
            const bindArgs = db.bind.mock.calls[0];
            expect(bindArgs).toContain(productId);
            expect(bindArgs[bindArgs.length - 1]).toBe(orderId);
        });

        it('should NOT bind product_id when productId is undefined', async () => {
            const orderId = 'test-order-123';
            const newData = { name: 'test item' };
            const actorType = 'sales';

            await updateData(db, orderId, newData, actorType, undefined);

            expect(db.prepare.mock.calls.length).toBeGreaterThanOrEqual(2);
            const sql = db.prepare.mock.calls[0][0];
            expect(sql).not.toContain('product_id = ?');

            expect(db.bind.mock.calls.length).toBeGreaterThanOrEqual(2);
            const bindArgs = db.bind.mock.calls[0];
            expect(bindArgs).not.toContain(undefined);
        });

        it('should handle quantity column update specifically', async () => {
            const orderId = 'test-order-123';
            const newData = { name: 'test item', quantity: 15 };
            const actorType = 'admin';

            await updateData(db, orderId, newData, actorType);

            const sql = db.prepare.mock.calls[0][0];
            expect(sql).toContain('quantity = ?');

            const bindArgs = db.bind.mock.calls[0];
            expect(bindArgs).toContain(15);
        });
    });

    describe('create()', () => {
        it('should include product_id in the INSERT statement', async () => {
            const params = {
                id: 'o_1',
                orderNo: 'no_1',
                salespersonId: 's_1',
                data: { name: 'New Item' },
                status: 'pending',
                quantity: 5,
                productId: 'p_999'
            };

            await create(db, timelineRepo, params);

            // Extract the order insert prepare call (first statement in batch)
            const insertOrderSql = db.prepare.mock.calls[0][0];
            expect(insertOrderSql).toContain('product_id');

            // Check bind arguments for the order insert
            const bindArgs = db.bind.mock.calls[0];
            expect(bindArgs).toContain('p_999');
        });

        it('should include variant_id in the INSERT statement when provided', async () => {
            const params = {
                id: 'o_2',
                orderNo: 'no_2',
                salespersonId: 's_1',
                data: { name: 'Variant Item' },
                status: 'pending',
                quantity: 1,
                productId: 'p_999',
                variantId: 'v_001'
            };

            await create(db, timelineRepo, params);

            const insertOrderSql = db.prepare.mock.calls[0][0];
            expect(insertOrderSql).toContain('variant_id');

            const bindArgs = db.bind.mock.calls[0];
            expect(bindArgs).toContain('v_001');
        });

        it('should create an order_lines row with the display snapshot when a single-line order is created', async () => {
            const params = {
                id: 'o_line',
                orderNo: 'no_line',
                salespersonId: 's_sales',
                data: {
                    name: 'Snapshot Item',
                    sku: 'SKU-987',
                    category: 'Outerwear',
                    size: 'L',
                    color: 'Blue',
                    brand: 'Acme',
                    material: 'Metal',
                    series: 'Alpha',
                    remark: '',
                    deadline: '2026-07-01'
                },
                status: 'pending',
                quantity: 3,
                productId: 'p_line',
                variantId: 'v_line',
                mainImageId: 'img-main'
            };

            await create(db, timelineRepo, params);

            // The second prepared statement should insert into order_lines
            const orderLineSql = db.prepare.mock.calls[1][0];
            expect(orderLineSql).toContain('INSERT INTO order_lines');

            const bindArgs = db.bind.mock.calls[1];
            expect(bindArgs[1]).toBe(params.id); // order_id
            expect(bindArgs[2]).toBe(params.productId);
            expect(bindArgs[3]).toBe(params.variantId);
            expect(bindArgs[4]).toBe(params.data.name);
            expect(bindArgs[5]).toBe(params.data.sku);
            expect(bindArgs[7]).toBe(params.mainImageId);
            expect(bindArgs[8]).toBe(3);
            expect(bindArgs[9]).toBe(0);
            expect(bindArgs[14]).toBe('unprocured');

            const snapshotSpecs = JSON.parse(bindArgs[6]);
            expect(snapshotSpecs).toEqual({
                category: 'Outerwear',
                size: 'L',
                color: 'Blue',
                brand: 'Acme',
                material: 'Metal',
                series: 'Alpha',
                deadline: '2026-07-01'
            });
        });

        it('normalizes quantity consistently for the order row and order_lines row', async () => {
            const params = {
                id: 'o_qty',
                orderNo: 'no_qty',
                salespersonId: 's_1',
                data: { name: 'Qty Item' },
                status: 'pending',
                quantity: 1.9,
            };

            await create(db, timelineRepo, params);

            const orderBindArgs = db.bind.mock.calls[0];
            const orderLineBindArgs = db.bind.mock.calls[1];

            expect(orderBindArgs[7]).toBe(1);
            expect(orderLineBindArgs[8]).toBe(1);
        });

        it('seeds arrived orders with ready line progress instead of unprocured defaults', async () => {
            const params = {
                id: 'o_arrived',
                orderNo: 'no_arrived',
                salespersonId: 's_1',
                data: { name: 'Arrived Item' },
                status: 'arrived',
                quantity: 2,
            };

            await create(db, timelineRepo, params);

            const orderLineBindArgs = db.bind.mock.calls[1];
            expect(orderLineBindArgs[8]).toBe(2);
            expect(orderLineBindArgs[9]).toBe(2);
            expect(orderLineBindArgs[10]).toBe(2);
            expect(orderLineBindArgs[11]).toBe(0);
            expect(orderLineBindArgs[12]).toBe(0);
            expect(orderLineBindArgs[13]).toBe(0);
            expect(orderLineBindArgs[14]).toBe('ready');
        });

        it('chunks large order create batches into D1-safe sizes when many files are attached', async () => {
            const batchDb = createBatchAwareDb();
            const fileIds = Array.from({ length: 205 }, (_, index) => `file-${index + 1}`);

            await create(batchDb, timelineRepo, {
                id: 'o-many-files',
                orderNo: 'no-many-files',
                salespersonId: 's-1',
                data: { name: 'Many Files' },
                status: 'pending',
                quantity: 1,
                fileIds,
            });

            expect(batchDb.batch).toHaveBeenCalledTimes(3);
            expect(Math.max(...batchDb.batchCalls.map((statements) => statements.length))).toBeLessThanOrEqual(100);
        });
    });

    describe('compatibility line sync', () => {
        it('updateComposite keeps the compatibility order_line snapshot in sync with edited order data', async () => {
            const inventoryService = {
                assertSufficient: vi.fn(),
                applyMutation: vi.fn(),
            };
            db.first.mockResolvedValueOnce({ id: 'line-1', line_count: 1 });

            await updateComposite(db, {
                id: 'o-sync',
                actorType: 'admin',
                newData: {
                    name: 'Updated Item',
                    sku: 'SKU-2',
                    category: 'Archive Outerwear',
                    quantity: 4,
                    size: 'XL',
                    color: 'Black',
                    material: 'Leather',
                },
                productId: 'prod-2',
                variantId: 'var-2',
                fileIds: ['img-2'],
                inventoryService,
            });

            const lineUpdateIndex = db.prepare.mock.calls.findIndex(([sql]) => sql.includes('UPDATE order_lines'));
            expect(lineUpdateIndex).toBeGreaterThanOrEqual(0);

            const bindArgs = db.bind.mock.calls[lineUpdateIndex];
            expect(bindArgs).toContain('prod-2');
            expect(bindArgs).toContain('var-2');
            expect(bindArgs).toContain('Updated Item');
            expect(bindArgs).toContain('SKU-2');
            expect(bindArgs).toContain('img-2');
            expect(bindArgs).toContain(4);
            expect(bindArgs[bindArgs.length - 1]).toBe('o-sync');

            const snapshotSpecsArg = bindArgs.find((value) => typeof value === 'string' && value.includes('"size":"XL"'));
            expect(JSON.parse(snapshotSpecsArg)).toEqual({
                category: 'Archive Outerwear',
                size: 'XL',
                color: 'Black',
                material: 'Leather',
            });
        });

        it('updateComposite persists salesperson reassignment on the order header', async () => {
            const inventoryService = {
                assertSufficient: vi.fn(),
                applyMutation: vi.fn(),
            };
            db.first.mockResolvedValueOnce({ id: 'line-1', line_count: 1 });

            await updateComposite(db, {
                id: 'o-salesperson',
                actorType: 'admin',
                newData: {
                    name: 'Updated Item',
                },
                salespersonId: 'sp-2',
                inventoryService,
            });

            const orderUpdateIndex = db.prepare.mock.calls.findIndex(([sql]) => sql.includes('UPDATE orders SET'));
            expect(orderUpdateIndex).toBeGreaterThanOrEqual(0);
            expect(db.prepare.mock.calls[orderUpdateIndex][0]).toContain('salesperson_id = ?');

            const bindArgs = db.bind.mock.calls[orderUpdateIndex];
            expect(bindArgs).toContain('sp-2');
            expect(bindArgs[bindArgs.length - 1]).toBe('o-salesperson');
        });

        it('updateStatus also persists compatibility progress back into order_lines', async () => {
            const inventoryService = {
                assertSufficient: vi.fn(async () => true),
                applyMutation: vi.fn(async () => true),
            };
            db.first
                .mockResolvedValueOnce({ status: 'arrived', variant_id: 'v-1', quantity: 3 })
                .mockResolvedValueOnce({ id: 'line-1', line_count: 1 })
                .mockResolvedValueOnce({ line_count: 1 })
                .mockResolvedValueOnce({
                    id: 'line-1',
                    line_count: 1,
                    ordered_qty: 3,
                    procured_qty: 3,
                    received_qty: 3,
                    reserved_qty: 0,
                    shipped_qty: 0,
                    cancelled_qty: 0,
                });

            await updateStatus(db, 'o-1', 'delivered', 'admin', { inventoryService });

            const lineUpdateIndex = db.prepare.mock.calls.findIndex(([sql]) => sql.includes('UPDATE order_lines'));
            expect(lineUpdateIndex).toBeGreaterThanOrEqual(0);

            const bindArgs = db.bind.mock.calls[lineUpdateIndex];
            expect(bindArgs).toContain(3);
            expect(bindArgs).toContain('completed');
            expect(db.prepare.mock.calls[lineUpdateIndex][0]).toContain('WHERE id = ? AND order_id = ?');
            expect(bindArgs[bindArgs.length - 2]).toBe('line-1');
            expect(bindArgs[bindArgs.length - 1]).toBe('o-1');
        });
    });

    describe('cutover guardrails', () => {
        it('chunks large batch status updates and order lookups into D1-safe sizes', async () => {
            const ids = Array.from({ length: 205 }, (_, index) => `o-${index + 1}`);
            const batchDb = createBatchAwareDb({
                allHandler: async (statement) => ({
                    results: statement.params.map((id) => ({
                        id,
                        status: 'pending',
                        variant_id: null,
                        quantity: 1,
                    })),
                }),
                firstHandler: async (statement) => {
                    if (statement.sql.includes('SELECT id,') && statement.sql.includes('line_count')) {
                        return { id: `line-${statement.params[0]}`, line_count: 1 };
                    }
                    if (statement.sql.includes('SELECT COUNT(*) AS line_count')) {
                        return { line_count: 1 };
                    }
                    if (statement.sql.includes('SELECT id FROM order_lines')) {
                        return { id: `line-${statement.params[0]}` };
                    }
                    return null;
                },
            });

            await batchUpdateStatus(batchDb, timelineRepo, ids, 'confirmed', null);

            expect(batchDb.allCalls).toHaveLength(3);
            expect(Math.max(...batchDb.allCalls.map((call) => call.params.length))).toBeLessThanOrEqual(100);
            expect(batchDb.batch).toHaveBeenCalledTimes(5);
            expect(Math.max(...batchDb.batchCalls.map((statements) => statements.length))).toBeLessThanOrEqual(100);
        });

        it('does not keep direct product_variants stock update SQL in order mutations', () => {
            const filePath = path.resolve(process.cwd(), 'functions/repositories/order/mutations.js');
            const source = fs.readFileSync(filePath, 'utf8');

            expect(source).not.toContain('UPDATE product_variants');
            expect(source).not.toContain('SET stock_quantity = MAX(0, stock_quantity + ?)');
        });
    });
});

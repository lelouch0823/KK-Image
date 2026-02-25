import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateData, create } from '../order/mutations.js';

describe('Order Mutations SQL Binding', () => {
    let db;
    let timelineRepo;

    beforeEach(() => {
        vi.clearAllMocks();
        db = {
            prepare: vi.fn().mockReturnThis(),
            bind: vi.fn().mockReturnThis(),
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
            expect(db.prepare).toHaveBeenCalledTimes(1);
            const sql = db.prepare.mock.calls[0][0];
            expect(sql).toContain('product_id = ?');

            // Verify bind parameters include the productId
            // Bind params order: [JSON.stringify(newData), timestamp, productId, orderId]
            expect(db.bind).toHaveBeenCalledTimes(1);
            const bindArgs = db.bind.mock.calls[0];
            expect(bindArgs).toContain(productId);
            expect(bindArgs[bindArgs.length - 1]).toBe(orderId);
        });

        it('should NOT bind product_id when productId is undefined', async () => {
            const orderId = 'test-order-123';
            const newData = { name: 'test item' };
            const actorType = 'sales';

            await updateData(db, orderId, newData, actorType, undefined);

            expect(db.prepare).toHaveBeenCalledTimes(1);
            const sql = db.prepare.mock.calls[0][0];
            expect(sql).not.toContain('product_id = ?');

            expect(db.bind).toHaveBeenCalledTimes(1);
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
    });
});

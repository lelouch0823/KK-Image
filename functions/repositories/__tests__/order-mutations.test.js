import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateComposite,
  updateData,
  updateStatus,
  create,
  batchUpdateStatus,
} from '../order/mutations.js';

function isOrderLinePrefetchSql(sql = '') {
  return sql.includes('ROW_NUMBER() OVER') && sql.includes('COUNT(*) OVER');
}

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

function createSequentialGuardDb({
  orderUpdateChanges = 0,
  allHandler = async () => ({ results: [] }),
  firstHandler = async () => null,
} = {}) {
  const executedSql = [];

  const db = {
    executedSql,
    prepare: vi.fn((sql) => {
      const statement = {
        sql: String(sql || ''),
        params: [],
        bind: vi.fn((...params) => {
          statement.params = params;
          return statement;
        }),
        first: vi.fn(async () => firstHandler(statement)),
        all: vi.fn(async () => allHandler(statement)),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      };
      return statement;
    }),
    batch: vi.fn(async (statements = []) => {
      const results = [];
      let previousChanges = 1;

      for (const statement of statements) {
        const sql = String(statement?.sql || '');
        if (sql.includes("json_extract(CASE WHEN changes() = 1 THEN '{}' ELSE 'not-json' END")) {
          executedSql.push(sql);
          if (previousChanges !== 1) {
            throw new Error('malformed JSON');
          }
          previousChanges = 1;
          results.push({ success: true, meta: { changes: 1 } });
          continue;
        }

        executedSql.push(sql);
        if (sql.includes('UPDATE orders')) {
          previousChanges = orderUpdateChanges;
          results.push({ success: true, meta: { changes: orderUpdateChanges } });
          continue;
        }

        previousChanges = 1;
        results.push({ success: true, meta: { changes: 1 } });
      }

      return results;
    }),
  };

  return db;
}

describe('Order Mutations SQL Binding', () => {
  let db;
  let timelineRepo;

  beforeEach(() => {
    vi.clearAllMocks();
    db = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
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
      const orderUpdateIndex = db.prepare.mock.calls.findIndex(([sql]) =>
        sql.includes('UPDATE orders')
      );
      const sql = db.prepare.mock.calls[orderUpdateIndex][0];
      expect(sql).toContain('product_id = ?');
      expect(sql).toContain('archived_at IS NULL');

      // Verify bind parameters include the productId
      // Bind params order: [JSON.stringify(newData), timestamp, productId, orderId]
      expect(db.bind.mock.calls.length).toBeGreaterThanOrEqual(2);
      const bindArgs = db.bind.mock.calls[orderUpdateIndex];
      expect(bindArgs).toContain(productId);
      expect(bindArgs[bindArgs.length - 1]).toBe(orderId);
    });

    it('should NOT bind product_id when productId is undefined', async () => {
      const orderId = 'test-order-123';
      const newData = { name: 'test item' };
      const actorType = 'sales';

      await updateData(db, orderId, newData, actorType, undefined);

      expect(db.prepare.mock.calls.length).toBeGreaterThanOrEqual(2);
      const orderUpdateIndex = db.prepare.mock.calls.findIndex(([sql]) =>
        sql.includes('UPDATE orders')
      );
      const sql = db.prepare.mock.calls[orderUpdateIndex][0];
      expect(sql).not.toContain('product_id = ?');

      expect(db.bind.mock.calls.length).toBeGreaterThanOrEqual(2);
      const bindArgs = db.bind.mock.calls[orderUpdateIndex];
      expect(bindArgs).not.toContain(undefined);
    });

    it('should handle quantity column update specifically', async () => {
      const orderId = 'test-order-123';
      const newData = { name: 'test item', quantity: 15 };
      const actorType = 'admin';

      await updateData(db, orderId, newData, actorType);

      const orderUpdateIndex = db.prepare.mock.calls.findIndex(([sql]) =>
        sql.includes('UPDATE orders')
      );
      const sql = db.prepare.mock.calls[orderUpdateIndex][0];
      expect(sql).toContain('quantity = ?');

      const bindArgs = db.bind.mock.calls[orderUpdateIndex];
      expect(bindArgs).toContain(15);
    });

    it('upserts order_payloads and summary fields together when editing data', async () => {
      const orderId = 'test-order-payload';
      const newData = { name: 'Edited Item', brand: 'KK', sku: 'SKU-2' };

      await updateData(db, orderId, newData, 'admin');

      const orderUpdateIndex = db.prepare.mock.calls.findIndex(([sql]) =>
        sql.includes('UPDATE orders')
      );
      expect(db.prepare.mock.calls[orderUpdateIndex][0]).toContain('summary_name = ?');
      expect(db.prepare.mock.calls[orderUpdateIndex][0]).toContain('summary_brand = ?');
      expect(db.prepare.mock.calls[orderUpdateIndex][0]).toContain('summary_sku = ?');
      expect(db.prepare.mock.calls.some(([sql]) => sql.includes('INSERT INTO order_payloads'))).toBe(
        true
      );

      const headerBindArgs = db.bind.mock.calls[orderUpdateIndex];
      expect(headerBindArgs).toContain('Edited Item');
      expect(headerBindArgs).toContain('KK');
      expect(headerBindArgs).toContain('SKU-2');
    });

    it('rejects archived orders before updateData writes sidecars', async () => {
      db.first.mockResolvedValueOnce({ archived_at: 1710000000000 });

      await expect(updateData(db, 'o-archived', { name: 'Blocked' }, 'admin')).rejects.toThrow(
        '订单已归档'
      );

      expect(db.batch).not.toHaveBeenCalled();
    });

    it('aborts before updateData sidecars when the active order update changes no rows', async () => {
      const guardedDb = createSequentialGuardDb({ orderUpdateChanges: 0 });

      await expect(
        updateData(guardedDb, 'o-raced-archive', { name: 'Blocked' }, 'admin')
      ).rejects.toThrow();

      expect(
        guardedDb.executedSql.some((sql) => sql.includes('INSERT INTO order_payloads'))
      ).toBe(false);
      expect(
        guardedDb.executedSql.some((sql) => sql.includes('UPDATE order_lines'))
      ).toBe(false);
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
        productId: 'p_999',
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
        variantId: 'v_001',
      };

      await create(db, timelineRepo, params);

      const insertOrderSql = db.prepare.mock.calls[0][0];
      expect(insertOrderSql).toContain('variant_id');

      const bindArgs = db.bind.mock.calls[0];
      expect(bindArgs).toContain('v_001');
    });

    it('writes sidecar payload and lightweight summary columns on create', async () => {
      const params = {
        id: 'o_payload',
        orderNo: 'no_payload',
        salespersonId: 's_1',
        data: { name: 'Payload Item', brand: 'KK', sku: 'SKU-1' },
        status: 'pending',
        quantity: 1,
      };

      await create(db, timelineRepo, params);

      const insertOrderSql = db.prepare.mock.calls[0][0];
      expect(insertOrderSql).toContain('summary_name');
      expect(insertOrderSql).toContain('summary_brand');
      expect(insertOrderSql).toContain('summary_sku');

      const payloadInsertIndex = db.prepare.mock.calls.findIndex(([sql]) =>
        sql.includes('INSERT INTO order_payloads')
      );
      expect(payloadInsertIndex).toBeGreaterThanOrEqual(0);

      const orderBindArgs = db.bind.mock.calls[0];
      expect(orderBindArgs).toContain('Payload Item');
      expect(orderBindArgs).toContain('KK');
      expect(orderBindArgs).toContain('SKU-1');
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
          deadline: '2026-07-01',
        },
        status: 'pending',
        quantity: 3,
        productId: 'p_line',
        variantId: 'v_line',
        mainImageId: 'img-main',
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
        deadline: '2026-07-01',
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

      expect(orderBindArgs[8]).toBe(1);
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
      expect(
        Math.max(...batchDb.batchCalls.map((statements) => statements.length))
      ).toBeLessThanOrEqual(100);
    });

    it('creates multiple order_lines rows and rolls total quantity into the order header when lines are provided', async () => {
      const batchDb = createBatchAwareDb();

      await create(batchDb, timelineRepo, {
        id: 'o_multi',
        orderNo: 'no_multi',
        salespersonId: 's_multi',
        data: {
          name: 'Header Placeholder',
          lines: [
            { name: 'Line A', sku: 'SKU-A', quantity: 2, color: 'Red' },
            { name: 'Line B', sku: 'SKU-B', quantity: 3, size: 'L' },
          ],
        },
        status: 'pending',
        quantity: 999,
      });

      const orderBindArgs = batchDb.batchCalls[0][0].params;
      expect(orderBindArgs[8]).toBe(5);

      const lineInsertStatements = batchDb.batchCalls[0].filter((statement) =>
        statement.sql.includes('INSERT INTO order_lines')
      );

      expect(lineInsertStatements).toHaveLength(2);
      expect(lineInsertStatements[0].params[4]).toBe('Line A');
      expect(lineInsertStatements[0].params[5]).toBe('SKU-A');
      expect(lineInsertStatements[0].params[8]).toBe(2);
      expect(lineInsertStatements[1].params[4]).toBe('Line B');
      expect(lineInsertStatements[1].params[5]).toBe('SKU-B');
      expect(lineInsertStatements[1].params[8]).toBe(3);
    });
  });

  describe('compatibility line sync', () => {
    it('updateComposite keeps the compatibility order_line snapshot in sync with edited order data', async () => {
      const inventoryService = {
        assertSufficient: vi.fn(),
        applyMutation: vi.fn(),
      };
      db.all.mockResolvedValueOnce({
        results: [
          {
            order_id: 'o-sync',
            id: 'line-1',
            product_id: 'prod-1',
            variant_id: 'var-1',
            ordered_qty: 3,
            procured_qty: 0,
            received_qty: 0,
            reserved_qty: 0,
            shipped_qty: 0,
            cancelled_qty: 0,
            line_count: 1,
            total_ordered_qty: 3,
            total_shipped_qty: 0,
            total_cancelled_qty: 0,
            row_num: 1,
          },
        ],
      });

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

      const lineUpdateIndex = db.prepare.mock.calls.findIndex(([sql]) =>
        sql.includes('UPDATE order_lines')
      );
      expect(lineUpdateIndex).toBeGreaterThanOrEqual(0);

      const orderUpdateIndex = db.prepare.mock.calls.findIndex(
        ([sql]) => sql.includes('UPDATE orders') && sql.includes('current_data = ?')
      );
      expect(orderUpdateIndex).toBeGreaterThanOrEqual(0);
      expect(db.prepare.mock.calls[orderUpdateIndex][0]).toContain('archived_at IS NULL');

      const bindArgs = db.bind.mock.calls.find(
        (args) =>
          args.includes('prod-2') &&
          args.includes('var-2') &&
          args.includes('Updated Item') &&
          args.includes('SKU-2') &&
          args[args.length - 2] === 'line-1' &&
          args[args.length - 1] === 'o-sync'
      );
      expect(bindArgs).toBeTruthy();
      expect(bindArgs).toContain('prod-2');
      expect(bindArgs).toContain('var-2');
      expect(bindArgs).toContain('Updated Item');
      expect(bindArgs).toContain('SKU-2');
      expect(bindArgs).toContain('img-2');
      expect(bindArgs).toContain(4);
      expect(bindArgs[bindArgs.length - 1]).toBe('o-sync');

      const snapshotSpecsArg = bindArgs.find(
        (value) =>
          typeof value === 'string' &&
          value.includes('"size":"XL"') &&
          !value.includes('"name":"Updated Item"')
      );
      expect(JSON.parse(snapshotSpecsArg)).toEqual({
        category: 'Archive Outerwear',
        size: 'XL',
        color: 'Black',
        material: 'Leather',
      });
    });

    it('rejects archived orders before updateComposite writes sidecars', async () => {
      db.first.mockResolvedValueOnce({ archived_at: 1710000000000 });

      await expect(
        updateComposite(db, {
          id: 'o-archived',
          actorType: 'admin',
          newData: { name: 'Blocked' },
        })
      ).rejects.toThrow('订单已归档');

      expect(db.batch).not.toHaveBeenCalled();
    });

    it('aborts before updateComposite sidecars when the active order update changes no rows', async () => {
      const guardedDb = createSequentialGuardDb({ orderUpdateChanges: 0 });

      await expect(
        updateComposite(guardedDb, {
          id: 'o-raced-archive',
          actorType: 'admin',
          newData: { name: 'Blocked', quantity: 2 },
          fileIds: ['file-1'],
        })
      ).rejects.toThrow();

      expect(
        guardedDb.executedSql.some((sql) => sql.includes('INSERT INTO order_payloads'))
      ).toBe(false);
      expect(
        guardedDb.executedSql.some((sql) => sql.includes('DELETE FROM order_files'))
      ).toBe(false);
      expect(
        guardedDb.executedSql.some((sql) => sql.includes('INSERT INTO order_files'))
      ).toBe(false);
    });

    it('updateComposite batches order_payloads upsert with header updates', async () => {
      const inventoryService = {
        assertSufficient: vi.fn(),
        applyMutation: vi.fn(),
      };
      db.all.mockResolvedValueOnce({
        results: [
          {
            order_id: 'o-sidecar-sync',
            id: 'line-1',
            ordered_qty: 1,
            procured_qty: 0,
            received_qty: 0,
            reserved_qty: 0,
            shipped_qty: 0,
            cancelled_qty: 0,
            line_count: 1,
            total_ordered_qty: 1,
            total_shipped_qty: 0,
            total_cancelled_qty: 0,
            row_num: 1,
          },
        ],
      });

      await updateComposite(db, {
        id: 'o-sidecar-sync',
        actorType: 'admin',
        newData: {
          name: 'Updated Item',
          brand: 'KK',
          sku: 'SKU-9',
        },
        inventoryService,
      });

      const payloadInsertIndex = db.prepare.mock.calls.findIndex(([sql]) =>
        sql.includes('INSERT INTO order_payloads')
      );
      expect(payloadInsertIndex).toBeGreaterThanOrEqual(0);

      const orderUpdateIndex = db.prepare.mock.calls.findIndex(([sql]) =>
        sql.includes('UPDATE orders SET')
      );
      expect(orderUpdateIndex).toBeGreaterThanOrEqual(0);
      expect(db.prepare.mock.calls[orderUpdateIndex][0]).toContain('summary_name = ?');
      expect(db.prepare.mock.calls[orderUpdateIndex][0]).toContain('summary_brand = ?');
      expect(db.prepare.mock.calls[orderUpdateIndex][0]).toContain('summary_sku = ?');
    });

    it('updateComposite keeps single-line current_data.lines quantity and binding aligned during ordinary edits', async () => {
      const inventoryService = {
        assertSufficient: vi.fn(),
        applyMutation: vi.fn(),
      };
      db.all.mockResolvedValueOnce({
        results: [
          {
            order_id: 'o-json-sync',
            id: 'line-1',
            product_id: 'prod-1',
            variant_id: 'var-1',
            ordered_qty: 1,
            procured_qty: 0,
            received_qty: 0,
            reserved_qty: 0,
            shipped_qty: 0,
            cancelled_qty: 0,
            line_count: 1,
            total_ordered_qty: 1,
            total_shipped_qty: 0,
            total_cancelled_qty: 0,
            row_num: 1,
          },
        ],
      });

      await updateComposite(db, {
        id: 'o-json-sync',
        actorType: 'admin',
        newData: {
          name: 'Updated Item',
          brand: 'KK',
          sku: 'SKU-2',
          quantity: 2,
          lines: [
            {
              name: 'Updated Item',
              quantity: 1,
              productId: 'prod-1',
              variantId: 'var-1',
            },
          ],
        },
        productId: 'prod-1',
        variantId: 'var-1',
        inventoryService,
        explicitLineMutation: false,
      });

      const orderUpdateIndex = db.prepare.mock.calls.findIndex(([sql]) =>
        sql.includes('UPDATE orders SET')
      );
      expect(orderUpdateIndex).toBeGreaterThanOrEqual(0);

      const orderBindArgs = db.bind.mock.calls[orderUpdateIndex];
      const persistedData = JSON.parse(orderBindArgs[0]);
      expect(persistedData.quantity).toBe(2);
      expect(persistedData.lines).toEqual([
        expect.objectContaining({
          quantity: 2,
          productId: 'prod-1',
          variantId: 'var-1',
        }),
      ]);
    });

    it('updateComposite rewrites order_lines and rolls up header quantity when multiple lines are provided', async () => {
      const batchDb = createBatchAwareDb({
        allHandler: async (statement) => ({
          results: isOrderLinePrefetchSql(statement.sql)
            ? [
                {
                  order_id: 'o-multi-update',
                  id: 'line-existing',
                  product_id: null,
                  variant_id: null,
                  ordered_qty: 1,
                  procured_qty: 0,
                  received_qty: 0,
                  reserved_qty: 0,
                  shipped_qty: 0,
                  cancelled_qty: 0,
                  line_count: 1,
                  total_ordered_qty: 1,
                  total_shipped_qty: 0,
                  total_cancelled_qty: 0,
                  row_num: 1,
                },
              ]
            : [],
        }),
      });

      await updateComposite(batchDb, {
        id: 'o-multi-update',
        actorType: 'admin',
        newData: {
          lines: [
            { name: 'Line A', sku: 'SKU-A', quantity: 2, color: 'Red' },
            { name: 'Line B', sku: 'SKU-B', quantity: 3, size: 'L' },
          ],
        },
      });

      const statements = batchDb.batchCalls.flat();
      const orderUpdateStatement = statements.find((statement) =>
        statement.sql.includes('UPDATE orders SET')
      );
      const deleteLineStatement = statements.find((statement) =>
        statement.sql.includes('DELETE FROM order_lines WHERE order_id = ?')
      );
      const lineInsertStatements = statements.filter((statement) =>
        statement.sql.includes('INSERT INTO order_lines')
      );

      expect(orderUpdateStatement).toBeTruthy();
      expect(orderUpdateStatement.params).toContain(5);
      expect(deleteLineStatement).toBeTruthy();
      expect(deleteLineStatement.params).toEqual(['o-multi-update']);
      expect(lineInsertStatements).toHaveLength(2);
      expect(lineInsertStatements[0].params[4]).toBe('Line A');
      expect(lineInsertStatements[0].params[5]).toBe('SKU-A');
      expect(lineInsertStatements[0].params[8]).toBe(2);
      expect(lineInsertStatements[1].params[4]).toBe('Line B');
      expect(lineInsertStatements[1].params[5]).toBe('SKU-B');
      expect(lineInsertStatements[1].params[8]).toBe(3);
    });

    it('updateComposite persists salesperson reassignment on the order header', async () => {
      const inventoryService = {
        assertSufficient: vi.fn(),
        applyMutation: vi.fn(),
      };
      db.all.mockResolvedValueOnce({
        results: [
          {
            order_id: 'o-salesperson',
            id: 'line-1',
            ordered_qty: 1,
            procured_qty: 0,
            received_qty: 0,
            reserved_qty: 0,
            shipped_qty: 0,
            cancelled_qty: 0,
            line_count: 1,
            total_ordered_qty: 1,
            total_shipped_qty: 0,
            total_cancelled_qty: 0,
            row_num: 1,
          },
        ],
      });

      await updateComposite(db, {
        id: 'o-salesperson',
        actorType: 'admin',
        newData: {
          name: 'Updated Item',
        },
        salespersonId: 'sp-2',
        inventoryService,
      });

      const orderUpdateIndex = db.prepare.mock.calls.findIndex(([sql]) =>
        sql.includes('UPDATE orders SET')
      );
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
      db.all.mockResolvedValueOnce({
        results: [
          {
            order_id: 'o-1',
            id: 'line-1',
            ordered_qty: 3,
            procured_qty: 3,
            received_qty: 3,
            reserved_qty: 0,
            shipped_qty: 3,
            cancelled_qty: 0,
            line_count: 1,
            total_ordered_qty: 3,
            total_shipped_qty: 3,
            total_cancelled_qty: 0,
            row_num: 1,
          },
        ],
      });
      db.first
        .mockResolvedValueOnce({ status: 'arrived', variant_id: 'v-1', quantity: 3 })
        .mockResolvedValueOnce(null);
      db.run.mockResolvedValueOnce({ meta: { changes: 1 } });

      await updateStatus(db, 'o-1', 'delivered', 'admin', { inventoryService });

      const lineUpdateIndex = db.prepare.mock.calls.findIndex(([sql]) =>
        sql.includes('UPDATE order_lines')
      );
      expect(lineUpdateIndex).toBeGreaterThanOrEqual(0);

      const orderUpdateIndex = db.prepare.mock.calls.findIndex(
        ([sql]) => sql.includes('UPDATE orders') && sql.includes('SET status = ?')
      );
      expect(orderUpdateIndex).toBeGreaterThanOrEqual(0);
      expect(db.bind.mock.calls[orderUpdateIndex][0]).toBe('fulfilled');

      const bindArgs = db.bind.mock.calls[lineUpdateIndex];
      expect(bindArgs).toContain(3);
      expect(bindArgs).toContain('completed');
      expect(db.prepare.mock.calls[lineUpdateIndex][0]).toContain('WHERE id = ? AND order_id = ?');
      expect(bindArgs[bindArgs.length - 2]).toBe('line-1');
      expect(bindArgs[bindArgs.length - 1]).toBe('o-1');
    });

    it('updateStatus guards the order write with the previously read status', async () => {
      db.all.mockResolvedValueOnce({
        results: [
          {
            order_id: 'o-cas',
            id: 'line-cas',
            ordered_qty: 1,
            procured_qty: 0,
            received_qty: 0,
            reserved_qty: 0,
            shipped_qty: 0,
            cancelled_qty: 0,
            line_count: 1,
            total_ordered_qty: 1,
            total_shipped_qty: 0,
            total_cancelled_qty: 0,
            row_num: 1,
          },
        ],
      });
      db.first.mockResolvedValueOnce({ status: 'pending', variant_id: null, quantity: 1 });
      db.run.mockResolvedValueOnce({ meta: { changes: 1 } });

      await updateStatus(db, 'o-cas', 'confirmed', 'admin');

      const orderUpdateIndex = db.prepare.mock.calls.findIndex(
        ([sql]) => sql.includes('UPDATE orders') && sql.includes('SET status = ?')
      );
      expect(orderUpdateIndex).toBeGreaterThanOrEqual(0);
      expect(db.prepare.mock.calls[orderUpdateIndex][0]).toContain('WHERE id = ? AND status = ?');
      expect(db.prepare.mock.calls[orderUpdateIndex][0]).toContain('archived_at IS NULL');
      expect(db.bind.mock.calls[orderUpdateIndex]).toEqual(
        expect.arrayContaining(['confirmed', 'o-cas', 'pending'])
      );
    });

    it('updateStatus rejects archived orders before issuing status writes', async () => {
      db.all.mockResolvedValueOnce({ results: [] });
      db.first.mockResolvedValueOnce({
        status: 'pending',
        variant_id: null,
        quantity: 1,
        archived_at: 1710000000000,
      });

      await expect(updateStatus(db, 'o-archived', 'confirmed', 'admin')).rejects.toThrow(
        '订单已归档'
      );

      const orderUpdateIndex = db.prepare.mock.calls.findIndex(
        ([sql]) => sql.includes('UPDATE orders') && sql.includes('SET status = ?')
      );
      expect(orderUpdateIndex).toBe(-1);
      expect(db.batch).not.toHaveBeenCalled();
    });

    it('updateStatus stops before compatibility side effects when the status CAS fails', async () => {
      db.all.mockResolvedValueOnce({
        results: [
          {
            order_id: 'o-stale',
            id: 'line-stale',
            ordered_qty: 1,
            procured_qty: 0,
            received_qty: 0,
            reserved_qty: 0,
            shipped_qty: 0,
            cancelled_qty: 0,
            line_count: 1,
            total_ordered_qty: 1,
            total_shipped_qty: 0,
            total_cancelled_qty: 0,
            row_num: 1,
          },
        ],
      });
      db.first.mockResolvedValueOnce({ status: 'pending', variant_id: null, quantity: 1 });
      db.run.mockResolvedValueOnce({ meta: { changes: 0 } });

      await expect(updateStatus(db, 'o-stale', 'confirmed', 'admin')).rejects.toMatchObject({
        statusCode: 409,
      });

      const lineUpdateIndex = db.prepare.mock.calls.findIndex(([sql]) =>
        sql.includes('UPDATE order_lines')
      );
      expect(lineUpdateIndex).toBe(-1);
      expect(db.batch).not.toHaveBeenCalled();
    });

    it('batchUpdateStatus persists fulfilled when legacy delivered input is requested', async () => {
      const batchDb = createBatchAwareDb({
        allHandler: async (statement) => ({
          results: isOrderLinePrefetchSql(statement.sql)
            ? [
                {
                  order_id: 'o-legacy',
                  id: 'line-legacy',
                  ordered_qty: 2,
                  procured_qty: 2,
                  received_qty: 2,
                  reserved_qty: 0,
                  shipped_qty: 2,
                  cancelled_qty: 0,
                  line_count: 1,
                  total_ordered_qty: 2,
                  total_shipped_qty: 2,
                  total_cancelled_qty: 0,
                  row_num: 1,
                },
              ]
            : [
                {
                  id: 'o-legacy',
                  status: 'shipping',
                  variant_id: null,
                  quantity: 2,
                },
              ],
        }),
      });

      await batchUpdateStatus(batchDb, timelineRepo, ['o-legacy'], 'delivered', null);

      const orderUpdateStatement = batchDb.batchCalls
        .flat()
        .find(
          (statement) =>
            statement.sql.includes('UPDATE orders') && statement.sql.includes('SET status = ?')
        );

      expect(orderUpdateStatement).toBeTruthy();
      expect(orderUpdateStatement.params[0]).toBe('fulfilled');
      expect(orderUpdateStatement.sql).toContain('archived_at IS NULL');
    });

    it('batchUpdateStatus rejects archived orders before issuing updates', async () => {
      const batchDb = createBatchAwareDb({
        allHandler: async () => ({
          results: [
            {
              id: 'o-archived',
              status: 'pending',
              variant_id: null,
              quantity: 1,
              archived_at: 1710000000000,
            },
          ],
        }),
      });

      await expect(
        batchUpdateStatus(batchDb, timelineRepo, ['o-archived'], 'confirmed', null)
      ).rejects.toThrow('订单已归档');

      expect(batchDb.batch).not.toHaveBeenCalled();
    });

    it('aborts before batchUpdateStatus line and timeline sidecars when an active order update changes no rows', async () => {
      const guardedDb = createSequentialGuardDb({
        orderUpdateChanges: 0,
        allHandler: async (statement) => ({
          results: isOrderLinePrefetchSql(statement.sql)
            ? [
                {
                  order_id: 'o-raced-archive',
                  id: 'line-raced-archive',
                  ordered_qty: 1,
                  procured_qty: 0,
                  received_qty: 0,
                  reserved_qty: 0,
                  shipped_qty: 0,
                  cancelled_qty: 0,
                  line_count: 1,
                  total_ordered_qty: 1,
                  total_shipped_qty: 0,
                  total_cancelled_qty: 0,
                  row_num: 1,
                },
              ]
            : [
                {
                  id: 'o-raced-archive',
                  status: 'pending',
                  variant_id: null,
                  quantity: 1,
                  archived_at: null,
                },
              ],
        }),
      });
      const guardedTimelineRepo = {
        createInsertStatement: vi.fn((id) =>
          guardedDb
            .prepare('INSERT INTO order_timeline (order_id, action_type) VALUES (?, ?)')
            .bind(id, 'status_changed')
        ),
      };

      await expect(
        batchUpdateStatus(
          guardedDb,
          guardedTimelineRepo,
          ['o-raced-archive'],
          'confirmed',
          { actionType: 'status_changed' }
        )
      ).rejects.toThrow();

      expect(
        guardedDb.executedSql.some((sql) => sql.includes('UPDATE order_lines'))
      ).toBe(false);
      expect(
        guardedDb.executedSql.some((sql) => sql.includes('INSERT INTO order_timeline'))
      ).toBe(false);
    });

    it('keeps batchUpdateStatus guarded order updates and assertions in the same D1 batch chunk', async () => {
      const ids = Array.from({ length: 34 }, (_, index) => `o-${index + 1}`);
      const batchDb = createBatchAwareDb({
        allHandler: async (statement) => ({
          results: isOrderLinePrefetchSql(statement.sql)
            ? ids.map((id) => ({
                order_id: id,
                id: `line-${id}`,
                ordered_qty: 1,
                procured_qty: 0,
                received_qty: 0,
                reserved_qty: 0,
                shipped_qty: 0,
                cancelled_qty: 0,
                line_count: 1,
                total_ordered_qty: 1,
                total_shipped_qty: 0,
                total_cancelled_qty: 0,
                row_num: 1,
              }))
            : ids.map((id) => ({
                id,
                status: 'pending',
                variant_id: null,
                quantity: 1,
                archived_at: null,
              })),
        }),
      });

      await batchUpdateStatus(batchDb, timelineRepo, ids, 'confirmed', null);

      expect(batchDb.batchCalls.length).toBeGreaterThan(1);
      for (const batch of batchDb.batchCalls) {
        batch.forEach((statement, index) => {
          const sql = String(statement?.sql || '');
          if (!sql.includes('UPDATE orders SET status = ?')) return;

          expect(String(batch[index + 1]?.sql || '')).toContain(
            "json_extract(CASE WHEN changes() = 1 THEN '{}' ELSE 'not-json' END"
          );
        });
      }
    });

    it('updateStatus reuses one prefetched order-line state instead of separate totals and primary-line scans', async () => {
      const batchDb = createBatchAwareDb({
        allHandler: async (statement) => ({
          results: isOrderLinePrefetchSql(statement.sql)
            ? [
                {
                  order_id: 'o-prefetch',
                  id: 'line-prefetch',
                  ordered_qty: 3,
                  procured_qty: 3,
                  received_qty: 3,
                  reserved_qty: 0,
                  shipped_qty: 3,
                  cancelled_qty: 0,
                  line_count: 1,
                  total_ordered_qty: 3,
                  total_shipped_qty: 3,
                  total_cancelled_qty: 0,
                  row_num: 1,
                },
              ]
            : [],
        }),
        firstHandler: async (statement) => {
          if (
            statement.sql.includes(
              'SELECT status, variant_id, quantity, archived_at FROM orders WHERE id = ?'
            )
          ) {
            return { status: 'arrived', variant_id: null, quantity: 3 };
          }
          return null;
        },
      });

      await updateStatus(batchDb, 'o-prefetch', 'delivered', 'admin');

      expect(
        batchDb.sqlCalls.some((sql) => sql.includes('COALESCE(SUM(ordered_qty), 0) AS ordered_qty'))
      ).toBe(false);
      expect(
        batchDb.sqlCalls.some((sql) =>
          sql.includes('SELECT id FROM order_lines WHERE order_id = ?')
        )
      ).toBe(false);
      expect(batchDb.sqlCalls.filter((sql) => isOrderLinePrefetchSql(sql))).toHaveLength(1);
    });

    it('batchUpdateStatus prefetches line totals and primary snapshots once per chunk instead of per order', async () => {
      const ids = ['o-1', 'o-2', 'o-3'];
      const batchDb = createBatchAwareDb({
        allHandler: async (statement) => ({
          results: isOrderLinePrefetchSql(statement.sql)
            ? statement.params.map((orderId) => ({
                order_id: orderId,
                id: `line-${orderId}`,
                ordered_qty: 1,
                procured_qty: 1,
                received_qty: 0,
                reserved_qty: 0,
                shipped_qty: 0,
                cancelled_qty: 0,
                line_count: 1,
                total_ordered_qty: 1,
                total_shipped_qty: 0,
                total_cancelled_qty: 0,
                row_num: 1,
              }))
            : statement.params.map((id) => ({
                id,
                status: 'pending',
                variant_id: null,
                quantity: 1,
              })),
        }),
      });

      await batchUpdateStatus(batchDb, timelineRepo, ids, 'confirmed', null);

      expect(
        batchDb.sqlCalls.some((sql) => sql.includes('COALESCE(SUM(ordered_qty), 0) AS ordered_qty'))
      ).toBe(false);
      expect(
        batchDb.sqlCalls.some((sql) =>
          sql.includes('SELECT id FROM order_lines WHERE order_id = ?')
        )
      ).toBe(false);
      expect(batchDb.sqlCalls.filter((sql) => isOrderLinePrefetchSql(sql))).toHaveLength(1);
    });
  });

  describe('cutover guardrails', () => {
    it('chunks large batch status updates and order lookups into D1-safe sizes', async () => {
      const ids = Array.from({ length: 205 }, (_, index) => `o-${index + 1}`);
      const batchDb = createBatchAwareDb({
        allHandler: async (statement) => ({
          results: isOrderLinePrefetchSql(statement.sql)
            ? statement.params.map((orderId) => ({
                order_id: orderId,
                id: `line-${orderId}`,
                ordered_qty: 1,
                procured_qty: 0,
                received_qty: 0,
                reserved_qty: 0,
                shipped_qty: 0,
                cancelled_qty: 0,
                line_count: 1,
                total_ordered_qty: 1,
                total_shipped_qty: 0,
                total_cancelled_qty: 0,
                row_num: 1,
              }))
            : statement.params.map((id) => ({
                id,
                status: 'pending',
                variant_id: null,
                quantity: 1,
              })),
        }),
      });

      await batchUpdateStatus(batchDb, timelineRepo, ids, 'confirmed', null);

      expect(batchDb.allCalls).toHaveLength(6);
      expect(Math.max(...batchDb.allCalls.map((call) => call.params.length))).toBeLessThanOrEqual(
        100
      );
      expect(batchDb.batch).toHaveBeenCalledTimes(7);
      expect(
        Math.max(...batchDb.batchCalls.map((statements) => statements.length))
      ).toBeLessThanOrEqual(100);
    });

    it('does not keep direct product_variants stock update SQL in order mutations', () => {
      const filePath = path.resolve(process.cwd(), 'functions/repositories/order/mutations.js');
      const source = fs.readFileSync(filePath, 'utf8');

      expect(source).not.toContain('UPDATE product_variants');
      expect(source).not.toContain('SET stock_quantity = MAX(0, stock_quantity + ?)');
    });
  });
});

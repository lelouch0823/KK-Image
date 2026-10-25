import { describe, expect, it, vi } from 'vitest';
import { PaymentRepository } from '../PaymentRepository.js';
import { ConflictError } from '../../lib/hono/errors.js';

function createStatement(result = {}) {
  const statement = {
    bind: vi.fn(() => statement),
    first: vi.fn(async () => result),
    all: vi.fn(async () => ({ results: [] })),
  };
  return statement;
}

describe('PaymentRepository receivable amounts', () => {
  it('creates payments with an active-order and remaining-balance guard in the insert statement', async () => {
    const run = vi.fn(async () => ({ meta: { changes: 1 } }));
    const statement = {
      bind: vi.fn(() => ({ run })),
    };
    const db = { prepare: vi.fn(() => statement) };
    const repo = new PaymentRepository(db);

    const payment = await repo.createIfWithinRemaining({
      orderId: 'order-1',
      amount: 80,
      method: 'bank',
      referenceNo: 'R-1',
      notes: 'partial',
      createdBy: 'admin-1',
    });

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('INSERT INTO payments');
    expect(sql).toContain('SELECT');
    expect(sql).toContain('orders');
    expect(sql).toContain('archived_at IS NULL');
    expect(sql).toContain("status NOT IN ('void', 'rejected')");
    // B9：净额（ordered - cancelled）× 单价快照（unit_price 回退当前售价）
    expect(sql).toContain('COALESCE(ol.unit_price, pv.price, 0)');
    expect(sql).toContain('ol.cancelled_qty');
    // B10：浮点边界舍入到 2 位小数后再比较，杜绝 1 分级漂移误判
    expect(sql).toContain('HAVING ROUND(COALESCE(SUM(p.amount), 0) + ?, 2) <= ROUND(order_amounts.total_amount, 2)');
    expect(sql).toContain('order_amounts.total_amount');
    expect(statement.bind).toHaveBeenCalledWith(
      expect.any(String),
      'order-1',
      80,
      'bank',
      'R-1',
      'partial',
      expect.any(Number),
      'admin-1',
      'order-1',
      80
    );
    expect(payment).toEqual(
      expect.objectContaining({
        orderId: 'order-1',
        amount: 80,
        method: 'bank',
        referenceNo: 'R-1',
        notes: 'partial',
        createdBy: 'admin-1',
      })
    );
  });

  it('returns null when the guarded payment insert writes no row', async () => {
    const run = vi.fn(async () => ({ meta: { changes: 0 } }));
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({ run })),
      })),
    };
    const repo = new PaymentRepository(db);

    await expect(
      repo.createIfWithinRemaining({
        orderId: 'order-1',
        amount: 120,
      })
    ).resolves.toBeNull();
  });

  it('calculates order amount from order lines and variant prices', async () => {
    const statement = createStatement({ total: 240 });
    const db = { prepare: vi.fn(() => statement) };
    const repo = new PaymentRepository(db);

    await expect(repo.getOrderAmount('order-1')).resolves.toBe(240);

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('FROM order_lines');
    expect(sql).toContain('product_variants');
    expect(sql).toMatch(/ordered_qty[\s\S]*price/i);
    expect(sql).not.toContain('orders.quantity');
  });

  it('uses monetary totals instead of order quantity in receivables summary', async () => {
    const statement = createStatement({ order_count: 1, total_amount: 240, total_paid: 40 });
    const db = { prepare: vi.fn(() => statement) };
    const repo = new PaymentRepository(db);

    await repo.getReceivablesSummary();

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('order_amounts');
    expect(sql).toContain('total_amount');
    expect(sql).toContain('o.archived_at IS NULL');
    expect(sql).not.toContain('SUM(o.quantity)');

    const agingSql = db.prepare.mock.calls[1][0];
    expect(agingSql).toContain('o.archived_at IS NULL');
  });

  it('uses monetary totals instead of order quantity for top debtors', async () => {
    const statement = createStatement();
    const db = { prepare: vi.fn(() => statement) };
    const repo = new PaymentRepository(db);

    await repo.getTopDebtors();

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('order_amounts');
    expect(sql).toContain('total_amount');
    expect(sql).toContain('o.archived_at IS NULL');
    expect(sql).not.toContain('SUM(o.quantity)');
    expect(sql).not.toContain('total_quantity');
  });
});

describe('PaymentRepository delete net guard (审查 R1 / F1)', () => {
  it('deletes with a post-delete net amount guard in the statement', async () => {
    const run = vi.fn(async () => ({ meta: { changes: 1 } }));
    const statements = [];
    const db = {
      prepare: vi.fn((sql) => {
        const statement = { bind: vi.fn(() => ({ run })), first: vi.fn() };
        statements.push({ sql, statement });
        return statement;
      }),
    };
    const repo = new PaymentRepository(db);

    await expect(repo.delete('pay-1', 'order-1')).resolves.toBe(true);

    const { sql, statement } = statements[0];
    expect(sql).toContain('DELETE FROM payments WHERE id = ? AND order_id = ?');
    // R1：删除后剩余净额 >= 0 的条件子查询
    expect(sql).toContain('p2.order_id = ?');
    expect(sql).toContain('p2.id != ?');
    expect(sql).toContain('>= 0');
    expect(statement.bind).toHaveBeenCalledWith('pay-1', 'order-1', 'order-1', 'pay-1');
  });

  it('throws 409 when the row exists but deleting it would make the net amount negative', async () => {
    const run = vi.fn(async () => ({ meta: { changes: 0 } }));
    const db = {
      prepare: vi.fn((sql) => {
        if (sql.startsWith('SELECT id FROM payments')) {
          return { bind: vi.fn(() => ({ first: vi.fn(async () => ({ id: 'pay-1' })) })) };
        }
        return { bind: vi.fn(() => ({ run })) };
      }),
    };
    const repo = new PaymentRepository(db);

    await expect(repo.delete('pay-1', 'order-1')).rejects.toThrow(ConflictError);
    await expect(repo.delete('pay-1', 'order-1')).rejects.toThrow(/净已付为负/);
  });

  it('returns false when the row does not exist (route maps to 404)', async () => {
    const run = vi.fn(async () => ({ meta: { changes: 0 } }));
    const db = {
      prepare: vi.fn((sql) => {
        if (sql.startsWith('SELECT id FROM payments')) {
          return { bind: vi.fn(() => ({ first: vi.fn(async () => null) })) };
        }
        return { bind: vi.fn(() => ({ run })) };
      }),
    };
    const repo = new PaymentRepository(db);

    await expect(repo.delete('pay-missing', 'order-1')).resolves.toBe(false);
  });
});

describe('PaymentRepository reference_no unique conflict mapping (审查 R1 / F11)', () => {
  function buildUniqueViolationDb(violationMessage) {
    const uniqueError = new Error(
      violationMessage || 'UNIQUE constraint failed: payments.order_id, payments.reference_no'
    );
    return {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          run: vi.fn(async () => {
            throw uniqueError;
          }),
        })),
      })),
    };
  }

  it('maps payment insert unique violation to 409 ConflictError', async () => {
    const repo = new PaymentRepository(buildUniqueViolationDb());

    await expect(
      repo.createIfWithinRemaining({ orderId: 'order-1', amount: 10, referenceNo: 'R-1' })
    ).rejects.toThrow(ConflictError);
    await expect(
      repo.createIfWithinRemaining({ orderId: 'order-1', amount: 10, referenceNo: 'R-1' })
    ).rejects.toThrow(/参考号已存在/);
  });

  it('maps refund insert unique violation to 409 ConflictError', async () => {
    const repo = new PaymentRepository(buildUniqueViolationDb());

    await expect(
      repo.createRefundIfWithinPaid({ orderId: 'order-1', amount: 10, referenceNo: 'R-1' })
    ).rejects.toThrow(ConflictError);
  });

  it('rethrows non-reference unique violations unchanged', async () => {
    const repo = new PaymentRepository(
      buildUniqueViolationDb('UNIQUE constraint failed: payments.id')
    );

    await expect(
      repo.createIfWithinRemaining({ orderId: 'order-1', amount: 10 })
    ).rejects.toThrow(/payments\.id/);
  });
});

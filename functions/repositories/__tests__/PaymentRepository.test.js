import { describe, expect, it, vi } from 'vitest';
import { PaymentRepository } from '../PaymentRepository.js';

function createStatement(result = {}) {
  const statement = {
    bind: vi.fn(() => statement),
    first: vi.fn(async () => result),
    all: vi.fn(async () => ({ results: [] })),
  };
  return statement;
}

describe('PaymentRepository receivable amounts', () => {
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

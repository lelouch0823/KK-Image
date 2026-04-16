import { describe, expect, it, vi } from 'vitest';
import { listForAdmin } from '../order/queries.js';

describe('order queries progress-status filtering', () => {
  it('filters admin list queries by resolved display status instead of legacy procurement_status', async () => {
    const countStmt = {
      bind: vi.fn(() => countStmt),
      first: vi.fn(async () => ({ total: 0 })),
    };
    const listStmt = {
      bind: vi.fn(() => listStmt),
      all: vi.fn(async () => ({ results: [] })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt),
    };

    await listForAdmin(db, {
      procurementStatus: 'partially_received',
      page: 1,
      limit: 20,
    });

    expect(db.prepare.mock.calls[0][0]).toContain("COALESCE(order_summary.display_status, '') IN (?, ?)");
    expect(db.prepare.mock.calls[0][0]).toContain("COALESCE(o.procurement_status, 'none') IN (?, ?)");
    expect(db.prepare.mock.calls[1][0]).toContain("COALESCE(order_summary.display_status, '') IN (?, ?)");
    expect(db.prepare.mock.calls[1][0]).toContain("COALESCE(o.procurement_status, 'none') IN (?, ?)");
    expect(countStmt.bind).toHaveBeenCalledWith(
      'partially_received',
      'partially_arrived',
      'partially_received',
      'partially_arrived'
    );
    expect(listStmt.bind).toHaveBeenCalledWith(
      'partially_received',
      'partially_arrived',
      'partially_received',
      'partially_arrived',
      20,
      0
    );
  });

  it('expands canonical unprocured filter to include legacy none status', async () => {
    const countStmt = {
      bind: vi.fn(() => countStmt),
      first: vi.fn(async () => ({ total: 0 })),
    };
    const listStmt = {
      bind: vi.fn(() => listStmt),
      all: vi.fn(async () => ({ results: [] })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt),
    };

    await listForAdmin(db, {
      procurementStatus: 'unprocured',
      page: 1,
      limit: 20,
    });

    expect(db.prepare.mock.calls[0][0]).toContain("COALESCE(order_summary.display_status, '') IN (?, ?)");
    expect(db.prepare.mock.calls[0][0]).toContain("COALESCE(o.procurement_status, 'none') IN (?, ?)");
    expect(countStmt.bind).toHaveBeenCalledWith('unprocured', 'none', 'unprocured', 'none');
    expect(listStmt.bind).toHaveBeenCalledWith('unprocured', 'none', 'unprocured', 'none', 20, 0);
  });
});
